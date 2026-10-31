// ==============================================
// utils/recruitStore.js
// 募集データと各メンバーの「募集DM通知」受け取り設定を管理する
// ==============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { buildClosedRecruitEmbed, buildRecruitButtons, buildRecruitCloseButton } from './recruitEmbed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR      = path.join(__dirname, '..', 'data');
const PREF_FILE      = path.join(DATA_DIR, 'dm_preferences.json');
const PROMPT_FILE    = path.join(DATA_DIR, 'dm_prompted.json');
const RECRUIT_FILE   = path.join(DATA_DIR, 'recruitments.json');

// デフォルトの募集有効期限 (24時間)
export const DEFAULT_RECRUIT_DURATION_MS = 24 * 60 * 60 * 1000;

// ==============================================
// 共通: JSON読み書き
// ==============================================
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function loadJson(file) {
    try {
        ensureDataDir();
        if (fs.existsSync(file)) {
            const raw = fs.readFileSync(file, 'utf8');
            return raw.trim() ? JSON.parse(raw) : {};
        }
    } catch (err) {
        console.error(`[ERROR] JSON読み込み失敗 (${file}):`, err);
    }
    return {};
}

function saveJson(file, data) {
    try {
        ensureDataDir();
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error(`[ERROR] JSON保存失敗 (${file}):`, err);
    }
}

// ==============================================
// 募集DM通知の受け取り設定
// ==============================================
export function getDmPreference(guildId, userId) {
    const data = loadJson(PREF_FILE);
    return data?.[guildId]?.[userId] ?? null;
}

export function setDmPreference(guildId, userId, value) {
    const data = loadJson(PREF_FILE);
    if (!data[guildId]) data[guildId] = {};
    data[guildId][userId] = value;
    saveJson(PREF_FILE, data);
    clearDmPrompted(guildId, userId);
}

// 初期案内DMを送信済みのメンバーを記録し、未回答でも同じ案内を何度も送らない。
export function getAllDmPrompts(guildId) {
    const data = loadJson(PROMPT_FILE);
    return data?.[guildId] || {};
}

export function markDmPrompted(guildId, userId) {
    const data = loadJson(PROMPT_FILE);
    if (!data[guildId]) data[guildId] = {};
    data[guildId][userId] = Date.now();
    saveJson(PROMPT_FILE, data);
}

export function clearDmPrompted(guildId, userId) {
    const data = loadJson(PROMPT_FILE);
    if (!data[guildId]?.[userId]) return;
    delete data[guildId][userId];
    if (Object.keys(data[guildId]).length === 0) delete data[guildId];
    saveJson(PROMPT_FILE, data);
}

export function getAllPreferences(guildId) {
    const data = loadJson(PREF_FILE);
    return data?.[guildId] || {};
}

// ==============================================
// 募集データ
// ==============================================
export function createRecruitment(id, recruitment) {
    const data = loadJson(RECRUIT_FILE);
    data[id] = recruitment;
    saveJson(RECRUIT_FILE, data);
    return recruitment;
}

export function getRecruitment(id) {
    const data = loadJson(RECRUIT_FILE);
    return data[id] || null;
}

export function updateRecruitment(id, updaterFn) {
    const data = loadJson(RECRUIT_FILE);
    if (!data[id]) return null;
    updaterFn(data[id]);
    saveJson(RECRUIT_FILE, data);
    return data[id];
}

export function deleteRecruitment(id) {
    const data = loadJson(RECRUIT_FILE);
    if (!(id in data)) return false;
    delete data[id];
    saveJson(RECRUIT_FILE, data);
    return true;
}

export function getAllRecruitments(guildId) {
    const data = loadJson(RECRUIT_FILE);
    if (!guildId) return data;
    return Object.fromEntries(
        Object.entries(data).filter(([, r]) => r.guildId === guildId)
    );
}

// ==============================================
// 募集を終了する
// - チャンネルのメッセージボタンを無効化・Embedを終了状態に更新
// - DMメッセージも同様に更新
// - 募集データを削除
// ==============================================
export async function closeRecruitment(recruitId, client, reason = '手動終了') {
    const recruit = getRecruitment(recruitId);
    if (!recruit) return false;

    const closedEmbed = buildClosedRecruitEmbed(recruit, reason);

    // チャンネルの元メッセージを更新
    try {
        const channel = await client.channels.fetch(recruit.channelId).catch(() => null);
        if (channel) {
            const message = await channel.messages.fetch(recruit.messageId).catch(() => null);
            if (message) {
                await message.edit({
                    embeds: [closedEmbed],
                    components: [] // ボタン全削除
                });
            }
        }
    } catch (err) {
        console.error(`[ERROR] 募集終了メッセージ更新失敗 (チャンネル): ${err.message}`);
    }

    // DMメッセージも更新
    if (recruit.dmMessages) {
        for (const [userId, dmInfo] of Object.entries(recruit.dmMessages)) {
            try {
                const dmChannel = await client.channels.fetch(dmInfo.channelId).catch(() => null);
                if (dmChannel) {
                    const dmMessage = await dmChannel.messages.fetch(dmInfo.messageId).catch(() => null);
                    if (dmMessage) {
                        await dmMessage.edit({
                            embeds: [buildClosedRecruitEmbed(recruit, reason)],
                            components: []
                        });
                    }
                }
            } catch {
                // DM更新失敗は無視
            }
        }
    }

    // 募集データを削除
    deleteRecruitment(recruitId);
    console.log(`[INFO] 募集終了: ${recruitId} | 理由: ${reason} | ゲーム: ${recruit.game}`);
    return true;
}

// ==============================================
// 期限切れの募集を一括クリーンアップする
// index.js の ready イベント後に定期実行する
// ==============================================
export async function cleanupExpiredRecruitments(client) {
    const data = loadJson(RECRUIT_FILE);
    const now = Date.now();
    let closed = 0;

    for (const [id, recruit] of Object.entries(data)) {
        if (!recruit.expiresAt) continue;
        if (recruit.expiresAt > now) continue;

        try {
            await closeRecruitment(id, client, '有効期限切れ');
            closed++;
        } catch (err) {
            console.error(`[ERROR] 期限切れ募集のクリーンアップ失敗 (${id}):`, err.message);
        }
    }

    if (closed > 0) {
        console.log(`[INFO] 期限切れ募集をクリーンアップしました: ${closed}件`);
    }

    return closed;
}

// ==============================================
// 定期クリーンアップを開始する (5分ごと)
// ==============================================
export function startRecruitmentCleanupScheduler(client) {
    const INTERVAL_MS = 5 * 60 * 1000; // 5分

    // 起動直後に1回実行
    cleanupExpiredRecruitments(client).catch(err => {
        console.error('[ERROR] 初回募集クリーンアップ失敗:', err);
    });

    // 以降は5分ごとに実行
    setInterval(() => {
        cleanupExpiredRecruitments(client).catch(err => {
            console.error('[ERROR] 定期募集クリーンアップ失敗:', err);
        });
    }, INTERVAL_MS);

    console.log(`[INFO] 募集クリーンアップスケジューラー起動 (間隔: ${INTERVAL_MS / 60000}分)`);
}
