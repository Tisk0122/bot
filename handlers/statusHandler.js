// ==============================================
// handlers/statusHandler.js
// メンバーのステータス（お風呂中・ご飯中など）を管理する
// ステータスパネル（ボタン）と常時更新ボードをセットで提供する
//
// ※ guild.members.fetch() は一切使用しない。
//    表示名はステータスセット時にインタラクションから取得して保存する。
//    これにより GatewayRateLimitError (opcode 8) を完全に回避する。
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
// color はボードの field カラーインジケーター用
// ==============================================
export const STATUS_PRESETS = [
    { key: 'bath',  label: 'お風呂',       color: '#5DADE2', description: '入浴中です'       },
    { key: 'meal',  label: 'ご飯',         color: '#F39C12', description: '食事中です'       },
    { key: 'sleep', label: '就寝',         color: '#8E44AD', description: '就寝しています'   },
    { key: 'nap',   label: '昼寝',         color: '#9B59B6', description: '昼寝中です'       },
    { key: 'out',   label: '外出',         color: '#27AE60', description: '外出しています'   },
    { key: 'away',  label: 'ちょっと離席', color: '#E67E22', description: '少し席を外してます' },
    { key: 'afk',   label: '放置中',       color: '#95A5A6', description: 'PCから離れています' },
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
        return JSON.parse(fs.readFileSync(STATUSES_FILE, 'utf8') || '{}');
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
        return JSON.parse(fs.readFileSync(PANEL_FILE, 'utf8') || '{}');
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
 * 経過時間を読みやすい文字列に変換
 */
function formatElapsed(setAt) {
    const elapsedMin = Math.floor((Date.now() - setAt) / 60_000);
    if (elapsedMin < 1)   return 'たった今';
    if (elapsedMin < 60)  return `${elapsedMin}分`;
    const h = Math.floor(elapsedMin / 60);
    const m = elapsedMin % 60;
    return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

/**
 * ステータスをトグル。同じキーを再度押したらクリア。
 * displayName はインタラクションから渡す（メンバー取得不要にするため）。
 * @returns {{ cleared: boolean, preset: object }}
 */
export function toggleUserStatus(guildId, userId, displayName, statusKey) {
    const all = loadStatuses();
    const guildData = all[guildId] || {};
    const preset = STATUS_PRESETS.find(p => p.key === statusKey);
    if (!preset) throw new Error(`不明なステータスキー: ${statusKey}`);

    if (guildData[userId]?.key === statusKey) {
        delete guildData[userId];
    } else {
        guildData[userId] = { key: statusKey, displayName, setAt: Date.now() };
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
    return loadPanelConfig()[guildId] || null;
}

// ==============================================
// メッセージ構築
// ==============================================

/**
 * ステータスボードの Embed を生成する（大幅改善版）。
 * - カテゴリ別に整理されたフィールド
 * - 経過時間を簡潔に表示
 * - アクティブ人数サマリーをタイトルに表示
 * - 空の状態も明確に表示
 */
export function buildBoardEmbed(guildStatuses) {
    const groups = {};
    let totalActive = 0;

    for (const [, info] of Object.entries(guildStatuses)) {
        const preset = STATUS_PRESETS.find(p => p.key === info.key);
        if (!preset || !info.displayName) continue;

        if (!groups[info.key]) groups[info.key] = [];
        groups[info.key].push({
            displayName: info.displayName,
            elapsed: formatElapsed(info.setAt),
            setAt: info.setAt,
        });
        totalActive++;
    }

    // カテゴリ内を設定時刻の古い順に並べ替え（長く居る人が上）
    for (const key of Object.keys(groups)) {
        groups[key].sort((a, b) => a.setAt - b.setAt);
    }

    const activeKeys = STATUS_PRESETS.map(p => p.key).filter(k => groups[k]);

    // ─── Embed 本体 ───
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTimestamp()
        .setFooter({ text: '最終更新' });

    if (totalActive === 0) {
        embed
            .setTitle('みんなの今')
            .setDescription('現在ステータスを設定しているメンバーはいません。');
        return embed;
    }

    embed
        .setTitle('みんなの今')
        .setDescription(`ステータス設定中：**${totalActive}人**`);

    for (const key of activeKeys) {
        const preset  = STATUS_PRESETS.find(p => p.key === key);
        const members = groups[key];
        const count   = members.length;

        // メンバー1人ずつ「名前  |  経過時間」の形式で整形
        const lines = members.map(({ displayName, elapsed }) => {
            // 名前は最大14文字に切り詰め（長い名前でも崩れない）
            const name = displayName.length > 14
                ? displayName.slice(0, 13) + '…'
                : displayName;
            // スペースで右端に経過時間を寄せる（等幅フォント想定）
            return `　${name}　（${elapsed}）`;
        });

        const fieldName  = count > 1 ? `${preset.label} ・ ${count}人` : preset.label;
        const fieldValue = lines.join('\n') || '（なし）';

        embed.addFields({ name: fieldName, value: fieldValue, inline: false });
    }

    return embed;
}

/**
 * ステータスパネルの Embed を生成する（改善版）
 */
export function buildPanelEmbed(guildStatuses = {}, userId = null) {
    const currentKey = userId ? (guildStatuses[userId]?.key ?? null) : null;
    const currentPreset = currentKey ? STATUS_PRESETS.find(p => p.key === currentKey) : null;

    const statusLine = currentPreset
        ? `あなたのステータス：**${currentPreset.label}**\n同じボタンをもう一度押すと解除できます。`
        : 'ボタンを選ぶと、ステータスを設定できます。\n設定中のボタンをもう一度押すと解除できます。';

    return new EmbedBuilder()
        .setTitle('ステータスパネル')
        .setDescription(statusLine)
        .setColor(currentPreset ? currentPreset.color : '#57F287')
        .setFooter({ text: '選択して設定 ・ もう一度押して解除' });
}

/**
 * ステータスパネルのボタン行を生成する（7個 → 4+3）
 * userId が null のときはどのボタンもハイライトしない（setup 時など）
 */
export function buildPanelComponents(guildStatuses, userId) {
    const currentKey = userId ? (guildStatuses[userId]?.key ?? null) : null;
    const chunks = [STATUS_PRESETS.slice(0, 4), STATUS_PRESETS.slice(4)];

    return chunks.map(chunk => {
        const row = new ActionRowBuilder();
        for (const preset of chunk) {
            const isActive = currentKey === preset.key;
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`status:${preset.key}`)
                    .setLabel(preset.label)
                    .setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary)
            );
        }
        return row;
    });
}

// ==============================================
// ボードメッセージの更新
// guild.members.fetch() を一切呼ばない
// ==============================================

export async function refreshStatusBoard(client, guildId, triggerUserId = null) {
    const cfg = getPanelConfig(guildId);
    if (!cfg) return;

    const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
    if (!channel) return;

    const guildStatuses = getGuildStatuses(guildId);

    // ボードを更新
    try {
        const boardMsg = await channel.messages.fetch(cfg.boardMessageId);
        await boardMsg.edit({ embeds: [buildBoardEmbed(guildStatuses)] });
    } catch (err) {
        console.warn('[StatusHandler] ボードメッセージの更新に失敗:', err.message);
    }

    // パネルのボタン色とembedを更新
    try {
        const panelMsg = await channel.messages.fetch(cfg.panelMessageId);
        await panelMsg.edit({
            embeds: [buildPanelEmbed(guildStatuses, triggerUserId)],
            components: buildPanelComponents(guildStatuses, triggerUserId)
        });
    } catch (err) {
        console.warn('[StatusHandler] パネルメッセージの更新に失敗:', err.message);
    }
}

// ==============================================
// ボタンインタラクション処理
// ==============================================

export async function handleStatusButton(interaction) {
    const { customId, guild, user, member } = interaction;
    const statusKey = customId.split(':')[1];

    // displayName はインタラクションの member から取得（API呼び出し不要）
    const displayName = member?.displayName ?? user.username;

    await interaction.deferReply({ flags: 64 });

    try {
        const { cleared, preset } = toggleUserStatus(guild.id, user.id, displayName, statusKey);

        const msg = cleared
            ? `**${preset.label}** のステータスを解除しました。`
            : `**${preset.label}** に設定しました。\nボードを更新しました。`;

        await interaction.editReply({ content: msg });

        // ユーザーへの返答後にボード更新
        await refreshStatusBoard(interaction.client, guild.id, user.id);

    } catch (err) {
        console.error('[StatusHandler] ステータスボタン処理エラー:', err);
        await interaction.editReply({ content: 'エラーが発生しました。時間をおいてもう一度お試しください。' });
    }
}
