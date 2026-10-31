// ==============================================
// handlers/statusHandler.js
// メンバーのステータス（お風呂中・ご飯中など）を管理する
// ステータスパネル（ボタン）と常時更新ボードをセットで提供する
// ==============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, '..', 'data');

const STATUSES_FILE = path.join(DATA_DIR, 'user_statuses.json');
const PANEL_FILE    = path.join(DATA_DIR, 'status_panel.json');

// ==============================================
// プリセット定義
// key は customId のサフィックスとして使用 (status:<key>)
// ==============================================
export const STATUS_PRESETS = [
    { key: 'bath',  emoji: '🛁', label: 'お風呂'       },
    { key: 'meal',  emoji: '🍚', label: 'ご飯'         },
    { key: 'sleep', emoji: '😴', label: '就寝'         },
    { key: 'nap',   emoji: '💤', label: '昼寝'         },
    { key: 'out',   emoji: '💼', label: '外出'         },
    { key: 'away',  emoji: '🚶', label: 'ちょっと離席' },
    { key: 'afk',   emoji: '📵', label: '放置中'       },
];

// ==============================================
// データ永続化ユーティリティ
// ==============================================

function ensureDir() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadStatuses() {
    ensureDir();
    try {
        if (!fs.existsSync(STATUSES_FILE)) return {};
        const raw = fs.readFileSync(STATUSES_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    } catch {
        return {};
    }
}

function saveStatuses(data) {
    ensureDir();
    const tmp = `${STATUSES_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, STATUSES_FILE);
}

function loadPanelConfig() {
    ensureDir();
    try {
        if (!fs.existsSync(PANEL_FILE)) return {};
        const raw = fs.readFileSync(PANEL_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    } catch {
        return {};
    }
}

function savePanelConfig(data) {
    ensureDir();
    const tmp = `${PANEL_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, PANEL_FILE);
}

// ==============================================
// ステータス操作
// ==============================================

/**
 * ステータスをセット。同じキーを再度押したらクリア（トグル）。
 * @returns {{ changed: boolean, cleared: boolean, preset: object }}
 */
export function toggleUserStatus(guildId, userId, statusKey) {
    const all = loadStatuses();
    const guildData = all[guildId] || {};
    const current = guildData[userId];
    const preset = STATUS_PRESETS.find(p => p.key === statusKey);
    if (!preset) throw new Error(`不明なステータスキー: ${statusKey}`);

    if (current?.key === statusKey) {
        // 同じボタンを押したのでクリア
        delete guildData[userId];
    } else {
        // 新しいステータスをセット（既存は上書き）
        guildData[userId] = { key: statusKey, setAt: Date.now() };
    }

    all[guildId] = guildData;
    saveStatuses(all);

    const cleared = !guildData[userId];
    return { cleared, preset };
}

export function clearUserStatus(guildId, userId) {
    const all = loadStatuses();
    const guildData = all[guildId] || {};
    delete guildData[userId];
    all[guildId] = guildData;
    saveStatuses(all);
}

export function getGuildStatuses(guildId) {
    const all = loadStatuses();
    return all[guildId] || {};
}

// ==============================================
// パネル設定の保存・取得
// ==============================================

export function savePanelMessageIds(guildId, channelId, panelMessageId, boardMessageId) {
    const cfg = loadPanelConfig();
    cfg[guildId] = { channelId, panelMessageId, boardMessageId, updatedAt: Date.now() };
    savePanelConfig(cfg);
}

export function getPanelConfig(guildId) {
    const cfg = loadPanelConfig();
    return cfg[guildId] || null;
}

// ==============================================
// メッセージ構築
// ==============================================

/**
 * ステータスボードの Embed を生成する
 */
export function buildBoardEmbed(guild, guildStatuses) {
    const now = Date.now();

    // ステータスごとにメンバーをグループ化
    const groups = {};
    for (const [userId, info] of Object.entries(guildStatuses)) {
        const member = guild.members.cache.get(userId);
        if (!member) continue; // 退出済みメンバーは無視

        const preset = STATUS_PRESETS.find(p => p.key === info.key);
        if (!preset) continue;

        if (!groups[info.key]) groups[info.key] = [];
        const elapsedMin = Math.floor((now - info.setAt) / 60_000);
        const elapsed = elapsedMin < 1 ? 'たった今' :
                        elapsedMin < 60 ? `${elapsedMin}分前` :
                        `${Math.floor(elapsedMin / 60)}時間${elapsedMin % 60}分前`;
        groups[info.key].push({ member, elapsed });
    }

    const embed = new EmbedBuilder()
        .setTitle('📋 みんなの今')
        .setColor('#5865F2')
        .setTimestamp()
        .setFooter({ text: '最終更新' });

    const keys = STATUS_PRESETS.map(p => p.key).filter(k => groups[k]);

    if (keys.length === 0) {
        embed.setDescription('現在ステータスを設定しているメンバーはいません。');
        return embed;
    }

    embed.setDescription(null);
    for (const key of keys) {
        const preset = STATUS_PRESETS.find(p => p.key === key);
        const lines = groups[key].map(({ member, elapsed }) =>
            `・${member.displayName}　(${elapsed})`
        );
        embed.addFields({
            name: `${preset.emoji} ${preset.label}`,
            value: lines.join('\n'),
            inline: false
        });
    }

    return embed;
}

/**
 * ステータスパネルの Embed を生成する
 */
export function buildPanelEmbed() {
    return new EmbedBuilder()
        .setTitle('📍 ステータスパネル')
        .setDescription(
            'ボタンをタップしてステータスを設定。\nもう一度押すとクリアされます。'
        )
        .setColor('#57F287');
}

/**
 * ステータスパネルのボタン行を生成する（Discord は 1行5個まで、最大5行）
 */
export function buildPanelComponents(guildStatuses, userId) {
    const currentKey = guildStatuses[userId]?.key ?? null;

    const rows = [];
    // 2行に分けて配置（7個 → 4+3）
    const presets = STATUS_PRESETS;
    const chunks = [presets.slice(0, 4), presets.slice(4)];

    for (const chunk of chunks) {
        const row = new ActionRowBuilder();
        for (const preset of chunk) {
            const isActive = currentKey === preset.key;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`status:${preset.key}`)
                    .setLabel(`${preset.emoji} ${preset.label}`)
                    .setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary)
            );
        }
        rows.push(row);
    }

    return rows;
}

// ==============================================
// ボードメッセージの更新（全ハンドラーから呼び出す）
// ==============================================

/**
 * guildId のボードメッセージを最新状態に編集する。
 * パネルメッセージのボタンも押した人のものだけ色を更新する。
 */
export async function refreshStatusBoard(client, guildId, triggerUserId = null) {
    const cfg = getPanelConfig(guildId);
    if (!cfg) return;

    const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel) return;

    const guild = channel.guild;
    await guild.members.fetch(); // メンバーキャッシュを最新化

    const guildStatuses = getGuildStatuses(guildId);

    // ボードメッセージを更新
    try {
        const boardMsg = await channel.messages.fetch(cfg.boardMessageId);
        await boardMsg.edit({ embeds: [buildBoardEmbed(guild, guildStatuses)] });
    } catch (err) {
        console.warn('[StatusHandler] ボードメッセージの更新に失敗:', err.message);
    }

    // パネルのボタン色を更新（押した本人のステータスが反映されるように）
    if (triggerUserId) {
        try {
            const panelMsg = await channel.messages.fetch(cfg.panelMessageId);
            await panelMsg.edit({
                embeds: [buildPanelEmbed()],
                components: buildPanelComponents(guildStatuses, triggerUserId)
            });
        } catch (err) {
            console.warn('[StatusHandler] パネルメッセージの更新に失敗:', err.message);
        }
    }
}

// ==============================================
// ボタンインタラクション処理
// ==============================================

export async function handleStatusButton(interaction) {
    const { customId, guild, user } = interaction;
    const statusKey = customId.split(':')[1];

    // まず deferReply（ephemeral）で処理中を示す
    await interaction.deferReply({ flags: 64 });

    try {
        const { cleared, preset } = toggleUserStatus(guild.id, user.id, statusKey);

        const msg = cleared
            ? `ステータスをクリアしました。`
            : `**${preset.emoji} ${preset.label}** をセットしました。`;

        await interaction.editReply({ content: msg });

        // ボードとパネルを非同期で更新（ユーザーへの返答後）
        await refreshStatusBoard(interaction.client, guild.id, user.id);

    } catch (err) {
        console.error('[StatusHandler] ステータスボタン処理エラー:', err);
        await interaction.editReply({ content: 'エラーが発生しました。もう一度お試しください。' });
    }
}
