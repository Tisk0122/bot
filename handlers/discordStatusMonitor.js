// ==============================================
// handlers/discordStatusMonitor.js
// Discordの公式ステータス（discordstatus.com）を
// リアルタイムに監視し、異常があれば通知チャンネルに投稿する
//
// 動作仕様:
//  - 60秒ごとにDiscord公式APIをポーリング
//  - 前回との差分を検出して新規インシデントのみ通知
//  - 障害中は同じメッセージを編集してリアルタイム更新
//  - 解決時は解決通知を追加投稿
// ==============================================

import { EmbedBuilder } from 'discord.js';

// 通知先チャンネルID
const NOTIFY_CHANNEL_ID = '1566125669627461852';

// ポーリング間隔（ミリ秒）
const POLL_INTERVAL_MS = 60_000;

// Discord公式ステータスAPI
const STATUS_API = {
    summary:   'https://discordstatus.com/api/v2/summary.json',
    incidents: 'https://discordstatus.com/api/v2/incidents.json',
};

// ===== 日本語マッピング =====
const INDICATOR_INFO = {
    none:        { label: '全システム正常', emoji: '✅', color: 0x23a55a },
    minor:       { label: '一部で問題が発生', emoji: '⚠️', color: 0xf5a623 },
    major:       { label: '大規模な障害が発生', emoji: '🚨', color: 0xed4245 },
    critical:    { label: '重大な障害が発生', emoji: '🔴', color: 0xed4245 },
    maintenance: { label: 'メンテナンス中', emoji: '🔧', color: 0x5865f2 },
};

const STATUS_JP = {
    operational:          '🟢 正常稼働中',
    degraded_performance: '🟡 パフォーマンス低下',
    partial_outage:       '🟠 一部障害',
    major_outage:         '🔴 大規模障害',
    under_maintenance:    '🔵 メンテナンス中',
};

const IMPACT_JP = {
    none:        '情報',
    minor:       '軽微',
    major:       '重大',
    critical:    '緊急',
    maintenance: 'メンテ',
};

const UPDATE_STATUS_JP = {
    investigating: '🔍 調査中',
    identified:    '🎯 原因特定',
    monitoring:    '👁️ 経過観察中',
    resolved:      '✅ 解決済み',
    update:        '📢 更新',
    scheduled:     '📅 予定',
    in_progress:   '⚙️ 進行中',
    verifying:     '🔎 確認中',
    completed:     '✅ 完了',
};

const COMP_JP = {
    'API': 'API', 'CloudFlare': 'CloudFlare',
    'Gateway': 'ゲートウェイ', 'Media Proxy': 'メディアプロキシ',
    'Voice': '音声通話', 'Push Notifications': 'プッシュ通知',
    'Search': '検索', 'Third-party': 'サードパーティ連携',
    'Payments': '決済', 'CDN': 'CDN',
    'Server Listing': 'サーバーリスト',
};

// ===== 状態管理 =====
// インシデントID → { messageId, resolved } のマッピング
const trackedIncidents = new Map();
let lastIndicator = 'none';
let summaryMessageId = null; // 全体ステータスサマリーメッセージのID
let client = null;
let pollingTimer = null;

// ===== ユーティリティ =====

function jst(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    }) + ' JST';
}

function truncate(str, len = 200) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'DiscordBot-StatusMonitor/1.0' },
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ===== Embed 生成 =====

/**
 * 全体ステータスサマリーEmbedを生成
 */
function buildSummaryEmbed(summary) {
    const ind = summary.status?.indicator || 'none';
    const info = INDICATOR_INFO[ind] || INDICATOR_INFO.none;
    const components = (summary.components || []).slice(0, 8);

    const embed = new EmbedBuilder()
        .setTitle(`${info.emoji} Discord ステータス：${info.label}`)
        .setColor(info.color)
        .setURL('https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: '最終更新 ・ discordstatus.com' });

    if (components.length > 0) {
        const lines = components.map(c => {
            const name = COMP_JP[c.name] || c.name;
            const st = STATUS_JP[c.status] || c.status;
            return `**${name}** — ${st}`;
        });
        embed.addFields({ name: 'コンポーネント別ステータス', value: lines.join('\n'), inline: false });
    }

    return embed;
}

/**
 * インシデント通知Embedを生成
 */
function buildIncidentEmbed(incident, isUpdate = false) {
    const impact = IMPACT_JP[incident.impact] || incident.impact;
    const info = incident.impact === 'critical' || incident.impact === 'major'
        ? INDICATOR_INFO.major
        : incident.impact === 'maintenance'
        ? INDICATOR_INFO.maintenance
        : incident.impact === 'minor'
        ? INDICATOR_INFO.minor
        : INDICATOR_INFO.none;

    const isResolved = incident.status === 'resolved' || incident.status === 'completed';
    const emoji = isResolved ? '✅' : info.emoji;
    const color = isResolved ? 0x23a55a : info.color;

    const updates = (incident.incident_updates || []).slice(0, 5);
    const updateText = updates.map(u => {
        const st = UPDATE_STATUS_JP[u.status] || u.status;
        const time = jst(u.created_at);
        return `**${st}** *(${time})*\n${truncate(u.body, 150)}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setTitle(`${emoji} [${impact}] ${incident.name}`)
        .setColor(color)
        .setURL(incident.shortlink || 'https://discordstatus.com')
        .setDescription(truncate(updateText || 'インシデントの詳細を確認中…', 1800))
        .addFields(
            { name: '現在のステータス', value: UPDATE_STATUS_JP[incident.status] || incident.status, inline: true },
            { name: '深刻度', value: impact, inline: true },
            { name: '開始', value: jst(incident.created_at), inline: true },
        )
        .setTimestamp()
        .setFooter({ text: isUpdate ? '📡 リアルタイム更新 ・ discordstatus.com' : '🚨 新規インシデント ・ discordstatus.com' });

    if (isResolved) {
        embed.addFields({ name: '解決時刻', value: jst(incident.resolved_at || incident.updated_at), inline: true });
    }

    return embed;
}

// ===== チャンネル・メッセージ操作 =====

async function getNotifyChannel() {
    try {
        return await client.channels.fetch(NOTIFY_CHANNEL_ID);
    } catch (err) {
        console.error('[StatusMonitor] 通知チャンネルの取得に失敗:', err.message);
        return null;
    }
}

async function sendOrUpdateSummary(channel, summary) {
    const embed = buildSummaryEmbed(summary);

    if (summaryMessageId) {
        try {
            const msg = await channel.messages.fetch(summaryMessageId);
            await msg.edit({ embeds: [embed] });
            return;
        } catch {
            // メッセージが消えていた場合は再送
            summaryMessageId = null;
        }
    }

    try {
        const msg = await channel.send({ embeds: [embed] });
        summaryMessageId = msg.id;
    } catch (err) {
        console.error('[StatusMonitor] サマリーメッセージ送信失敗:', err.message);
    }
}

async function notifyNewIncident(channel, incident) {
    const embed = buildIncidentEmbed(incident, false);
    try {
        const msg = await channel.send({ embeds: [embed] });
        trackedIncidents.set(incident.id, { messageId: msg.id, resolved: false });
        console.log(`[StatusMonitor] 新規インシデント通知: ${incident.name} (${incident.id})`);
    } catch (err) {
        console.error('[StatusMonitor] インシデント通知送信失敗:', err.message);
    }
}

async function updateIncidentMessage(channel, incident) {
    const tracked = trackedIncidents.get(incident.id);
    if (!tracked || tracked.resolved) return;

    const isResolved = incident.status === 'resolved' || incident.status === 'completed';
    const embed = buildIncidentEmbed(incident, !isResolved);

    try {
        const msg = await channel.messages.fetch(tracked.messageId);
        await msg.edit({ embeds: [embed] });

        if (isResolved) {
            trackedIncidents.set(incident.id, { ...tracked, resolved: true });
            // 解決通知を別途送信
            const resolveEmbed = new EmbedBuilder()
                .setTitle('✅ インシデント解決のお知らせ')
                .setColor(0x23a55a)
                .setDescription(`**${incident.name}** が解決しました。\n\nDiscordサービスは正常に戻っています。`)
                .addFields({ name: '解決時刻', value: jst(incident.resolved_at || incident.updated_at), inline: true })
                .setURL(incident.shortlink || 'https://discordstatus.com')
                .setTimestamp()
                .setFooter({ text: 'discordstatus.com' });
            await channel.send({ embeds: [resolveEmbed] });
            console.log(`[StatusMonitor] インシデント解決通知: ${incident.name}`);
        }
    } catch (err) {
        console.error('[StatusMonitor] インシデントメッセージ更新失敗:', err.message);
    }
}

// ===== メインポーリング処理 =====

async function poll() {
    try {
        const [summary, incData] = await Promise.all([
            fetchJson(STATUS_API.summary),
            fetchJson(STATUS_API.incidents),
        ]);

        const currentIndicator = summary.status?.indicator || 'none';
        const incidents = incData.incidents || [];

        const channel = await getNotifyChannel();
        if (!channel) return;

        // 1. 全体ステータスサマリーを更新（常時更新）
        await sendOrUpdateSummary(channel, summary);

        // 2. インジケーターが変化した場合、変化通知
        if (currentIndicator !== lastIndicator) {
            const prevInfo = INDICATOR_INFO[lastIndicator] || INDICATOR_INFO.none;
            const currInfo = INDICATOR_INFO[currentIndicator] || INDICATOR_INFO.none;

            // none→問題のある状態、または問題のある状態→noneへの遷移のみ通知
            if (lastIndicator !== 'none' || currentIndicator !== 'none') {
                const changeEmbed = new EmbedBuilder()
                    .setTitle('📡 Discordステータス変化')
                    .setColor(currInfo.color)
                    .setDescription(`${prevInfo.emoji} **${prevInfo.label}** → ${currInfo.emoji} **${currInfo.label}**`)
                    .setTimestamp()
                    .setFooter({ text: 'discordstatus.com' });
                await channel.send({ embeds: [changeEmbed] });
            }

            lastIndicator = currentIndicator;
        }

        // 3. アクティブなインシデントを処理
        const activeIncidents = incidents.filter(i =>
            i.status !== 'resolved' && i.status !== 'completed'
        );
        const recentResolved = incidents.filter(i =>
            (i.status === 'resolved' || i.status === 'completed') &&
            Date.now() - new Date(i.updated_at).getTime() < 30 * 60_000 // 30分以内に解決
        );

        for (const incident of [...activeIncidents, ...recentResolved]) {
            if (trackedIncidents.has(incident.id)) {
                // 既知のインシデント→更新
                await updateIncidentMessage(channel, incident);
            } else if (activeIncidents.includes(incident)) {
                // 新規アクティブインシデント→通知
                await notifyNewIncident(channel, incident);
            }
        }

        // 4. 解決済みで追跡中のものが一覧にない場合、終了処理
        for (const [id, tracked] of trackedIncidents.entries()) {
            if (tracked.resolved) continue;
            const stillActive = incidents.find(i => i.id === id);
            if (!stillActive) {
                // APIから消えた（古いインシデント）
                trackedIncidents.delete(id);
            }
        }

    } catch (err) {
        console.error('[StatusMonitor] ポーリングエラー:', err.message);
    }
}

// ===== 外部API =====

/**
 * 現在のステータスを即時取得してEmbedを返す（/discord-status コマンド用）
 */
export async function fetchCurrentStatus() {
    const [summary, incData] = await Promise.all([
        fetchJson(STATUS_API.summary),
        fetchJson(STATUS_API.incidents),
    ]);

    const ind = summary.status?.indicator || 'none';
    const info = INDICATOR_INFO[ind] || INDICATOR_INFO.none;
    const components = summary.components || [];
    const incidents = incData.incidents || [];
    const activeInc = incidents.filter(i => i.status !== 'resolved' && i.status !== 'completed');

    const embeds = [buildSummaryEmbed(summary)];

    // アクティブなインシデントがあれば追加
    for (const inc of activeInc.slice(0, 3)) {
        embeds.push(buildIncidentEmbed(inc, false));
    }

    return { embeds, indicator: ind, info, activeCount: activeInc.length };
}

/**
 * モニターを起動する
 * @param {Client} discordClient - discord.jsのClientインスタンス
 */
export function startDiscordStatusMonitor(discordClient) {
    client = discordClient;

    console.log('[StatusMonitor] Discord公式ステータス監視を開始します');
    console.log(`[StatusMonitor] 通知チャンネル: ${NOTIFY_CHANNEL_ID}`);
    console.log(`[StatusMonitor] ポーリング間隔: ${POLL_INTERVAL_MS / 1000}秒`);

    // 起動時に即時チェック
    setTimeout(() => poll(), 5_000);

    // 定期ポーリング
    pollingTimer = setInterval(() => poll(), POLL_INTERVAL_MS);
}

/**
 * モニターを停止する
 */
export function stopDiscordStatusMonitor() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
        console.log('[StatusMonitor] Discord公式ステータス監視を停止しました');
    }
}
