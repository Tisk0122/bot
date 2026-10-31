// ==============================================
// handlers/discordStatusMonitor.js
// Discord公式ステータス監視
// 状態を data/discord_status_state.json に永続化し、再起動による重複通知を防止。
// ==============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmbedBuilder } from 'discord.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'discord_status_state.json');
const NOTIFY_CHANNEL_ID = process.env.DISCORD_STATUS_CHANNEL_ID || '1566125669627461852';
const POLL_INTERVAL_MS = Math.max(30_000, Number(process.env.DISCORD_STATUS_POLL_INTERVAL_MS) || 60_000);

const STATUS_API = {
    summary: 'https://discordstatus.com/api/v2/summary.json',
    incidents: 'https://discordstatus.com/api/v2/incidents.json',
};

const INDICATOR_INFO = {
    none:        { label: '正常', emoji: '🟢', color: 0x23a55a },
    minor:       { label: '一部で問題', emoji: '🟡', color: 0xf5a623 },
    major:       { label: '大規模障害', emoji: '🟠', color: 0xed4245 },
    critical:    { label: '重大な障害', emoji: '🔴', color: 0xed4245 },
    maintenance: { label: 'メンテナンス', emoji: '🔵', color: 0x5865f2 },
};
const STATUS_JP = {
    operational: '正常',
    degraded_performance: '性能低下',
    partial_outage: '一部障害',
    major_outage: '大規模障害',
    under_maintenance: 'メンテナンス中',
};
const IMPACT_JP = { none: '情報', minor: '軽微', major: '重大', critical: '緊急', maintenance: 'メンテナンス' };
const UPDATE_STATUS_JP = {
    investigating: '調査中', identified: '原因特定', monitoring: '経過観察',
    resolved: '解決済み', update: '更新', scheduled: '予定',
    in_progress: '対応中', verifying: '確認中', completed: '完了',
};
const COMP_JP = {
    API: 'API', CloudFlare: 'CloudFlare', Gateway: 'ゲートウェイ',
    'Media Proxy': 'メディアプロキシ', Voice: '音声通話',
    'Push Notifications': 'プッシュ通知', Search: '検索',
    'Third-party': '外部サービス', Payments: '決済', CDN: 'CDN',
    'Server Listing': 'サーバー一覧',
};

let client = null;
let pollingTimer = null;
let pollRunning = false;
let state = null;

function defaultState() {
    return { version: 1, initialized: false, indicator: null, summaryMessageId: null, incidents: {} };
}
function loadState() {
    try {
        const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        return { ...defaultState(), ...parsed, incidents: parsed.incidents || {} };
    } catch {
        return defaultState();
    }
}
function saveState() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = `${STATE_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temp, STATE_FILE);
}
function jst(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    }) + ' JST';
}
function truncate(value, max = 220) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max)}…` : text;
}
async function fetchJson(url) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'DiscordBot-StatusMonitor/2.0' },
        signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Discord Status API HTTP ${response.status}`);
    return response.json();
}
function isResolved(incident) {
    return incident.status === 'resolved' || incident.status === 'completed';
}
function latestUpdate(incident) {
    const updates = incident.incident_updates || [];
    const latest = updates[0] || {};
    return `${latest.id || ''}:${latest.status || ''}:${latest.created_at || ''}`;
}
function incidentFingerprint(incident) {
    return `${incident.status || ''}|${latestUpdate(incident)}`;
}
function buildSummaryEmbed(summary) {
    const indicator = summary.status?.indicator || 'none';
    const info = INDICATOR_INFO[indicator] || INDICATOR_INFO.none;
    const components = (summary.components || []).slice(0, 12);
    const embed = new EmbedBuilder()
        .setTitle(`${info.emoji} Discord 公式ステータス`)
        .setDescription(`**全体状態：${info.label}**`)
        .setColor(info.color)
        .setURL('https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: 'Discord Status ・ 定期更新' });
    if (components.length) {
        embed.addFields({
            name: 'サービス別の状態',
            value: components.map(component =>
                `**${COMP_JP[component.name] || component.name}**　${STATUS_JP[component.status] || component.status}`
            ).join('\n').slice(0, 1024),
        });
    }
    return embed;
}
function buildIncidentEmbed(incident, updated = false) {
    const resolved = isResolved(incident);
    const impact = IMPACT_JP[incident.impact] || incident.impact || '不明';
    const color = resolved ? 0x23a55a :
        incident.impact === 'critical' || incident.impact === 'major' ? 0xed4245 :
        incident.impact === 'maintenance' ? 0x5865f2 : 0xf5a623;
    const updates = (incident.incident_updates || []).slice(0, 4);
    const updateText = updates.map(update => {
        const status = UPDATE_STATUS_JP[update.status] || update.status || '更新';
        return `**${status}**　${jst(update.created_at)}\n${truncate(update.body, 240)}`;
    }).join('\n\n');
    const embed = new EmbedBuilder()
        .setTitle(`${resolved ? '🟢' : '⚠️'} ${truncate(incident.name, 180)}`)
        .setDescription(updateText || '詳細情報は公式ステータスページを確認してください。')
        .addFields(
            { name: '影響度', value: String(impact), inline: true },
            { name: '現在の状態', value: UPDATE_STATUS_JP[incident.status] || String(incident.status || '不明'), inline: true },
            { name: '発生時刻', value: jst(incident.created_at), inline: true },
        )
        .setColor(color)
        .setURL(incident.shortlink || 'https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: updated ? 'インシデント更新' : resolved ? '解決通知' : '新規インシデント' });
    if (resolved) embed.addFields({ name: '解決時刻', value: jst(incident.resolved_at || incident.updated_at), inline: true });
    return embed;
}
async function getNotifyChannel() {
    try {
        const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
        if (!channel?.isTextBased() || !channel.messages) {
            console.error('[DiscordStatus] 通知先がテキストチャンネルではありません。');
            return null;
        }
        return channel;
    } catch (error) {
        console.error('[DiscordStatus] 通知チャンネル取得失敗:', error.message);
        return null;
    }
}
async function updateSummary(channel, summary) {
    const payload = { embeds: [buildSummaryEmbed(summary)] };
    if (state.summaryMessageId) {
        try {
            const message = await channel.messages.fetch(state.summaryMessageId);
            await message.edit(payload);
            return;
        } catch {
            state.summaryMessageId = null;
        }
    }
    const message = await channel.send(payload);
    state.summaryMessageId = message.id;
    saveState();
}
async function sendIndicatorChange(channel, previous, current) {
    const before = INDICATOR_INFO[previous] || INDICATOR_INFO.none;
    const after = INDICATOR_INFO[current] || INDICATOR_INFO.none;
    const recovered = current === 'none' && previous !== 'none';
    const embed = new EmbedBuilder()
        .setTitle(recovered ? '🟢 Discordの障害が改善しました' : '⚠️ Discordの状態が変化しました')
        .setDescription(`**${before.label}** から **${after.label}** に変化しました。`)
        .setColor(after.color)
        .setURL('https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: 'Discord公式ステータス' });
    await channel.send({ embeds: [embed] });
}
async function processIncidents(channel, incidents, initializing) {
    const active = incidents.filter(incident => !isResolved(incident));
    const seen = new Set();

    for (const incident of incidents) {
        if (!incident.id) continue;
        seen.add(incident.id);
        const previous = state.incidents[incident.id];
        const fingerprint = incidentFingerprint(incident);
        const resolved = isResolved(incident);

        if (!previous) {
            if (!initializing) {
                const message = await channel.send({ embeds: [buildIncidentEmbed(incident)] });
                state.incidents[incident.id] = {
                    messageId: message.id, fingerprint, resolved, updatedAt: Date.now(),
                };
            } else {
                // 初回起動時の既存案件は基準値として記録し、再起動通知を発生させない。
                state.incidents[incident.id] = { messageId: null, fingerprint, resolved, updatedAt: Date.now() };
            }
            saveState();
            continue;
        }

        if (previous.fingerprint === fingerprint && previous.resolved === resolved) continue;

        // 既存メッセージがある場合は最新情報に差し替える。
        if (previous.messageId) {
            try {
                const message = await channel.messages.fetch(previous.messageId);
                await message.edit({ embeds: [buildIncidentEmbed(incident, true)] });
            } catch (error) {
                console.warn(`[DiscordStatus] 案件メッセージ更新失敗 (${incident.id}):`, error.message);
            }
        }

        if (resolved && !previous.resolved) {
            await channel.send({ embeds: [buildIncidentEmbed(incident, true)] });
        } else if (!resolved && previous.fingerprint !== fingerprint) {
            const update = (incident.incident_updates || [])[0];
            // API側の更新内容が変わった場合のみ、更新通知を送る。
            if (update) {
                const embed = new EmbedBuilder()
                    .setTitle('📢 Discord障害情報が更新されました')
                    .setDescription(`**${truncate(incident.name, 180)}**\n\n${truncate(update.body, 1200)}`)
                    .addFields({ name: '現在の状態', value: UPDATE_STATUS_JP[incident.status] || String(incident.status || '不明'), inline: true })
                    .setColor(0xf5a623)
                    .setURL(incident.shortlink || 'https://discordstatus.com')
                    .setTimestamp();
                await channel.send({ embeds: [embed] });
            }
        }
        state.incidents[incident.id] = {
            ...previous, fingerprint, resolved, updatedAt: Date.now(),
        };
        saveState();
    }

    // APIから消えた古い案件を無期限に保持しない（直近30日分を目安に整理）。
    const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
    for (const [id, item] of Object.entries(state.incidents)) {
        if (!seen.has(id) && item.updatedAt < cutoff) delete state.incidents[id];
    }
}
async function poll() {
    if (pollRunning || !client?.isReady()) return;
    pollRunning = true;
    try {
        const [summary, incidentData] = await Promise.all([
            fetchJson(STATUS_API.summary), fetchJson(STATUS_API.incidents),
        ]);
        const channel = await getNotifyChannel();
        if (!channel) return;

        const indicator = summary.status?.indicator || 'none';
        const incidents = incidentData.incidents || [];
        const initializing = !state.initialized;

        await updateSummary(channel, summary);

        if (initializing) {
            // 初回だけ現在値を基準として保存。初回の異常は一度だけ通知する。
            if (indicator !== 'none') {
                const normal = 'none';
                await sendIndicatorChange(channel, normal, indicator);
            }
            state.indicator = indicator;
            await processIncidents(channel, incidents, true);
            state.initialized = true;
            saveState();
            console.log('[DiscordStatus] 初回状態を保存しました。次回起動以降は重複通知しません。');
            return;
        }

        if (state.indicator !== indicator) {
            await sendIndicatorChange(channel, state.indicator || 'none', indicator);
            state.indicator = indicator;
            saveState();
        }
        await processIncidents(channel, incidents, false);
        saveState();
    } catch (error) {
        console.error('[DiscordStatus] 監視処理エラー:', error.message);
    } finally {
        pollRunning = false;
    }
}

export async function fetchCurrentStatus() {
    const [summary, incidentData] = await Promise.all([
        fetchJson(STATUS_API.summary), fetchJson(STATUS_API.incidents),
    ]);
    const indicator = summary.status?.indicator || 'none';
    const info = INDICATOR_INFO[indicator] || INDICATOR_INFO.none;
    const active = (incidentData.incidents || []).filter(item => !isResolved(item));
    return {
        embeds: [buildSummaryEmbed(summary), ...active.slice(0, 3).map(item => buildIncidentEmbed(item))],
        indicator, info, activeCount: active.length,
    };
}

export function startDiscordStatusMonitor(discordClient) {
    if (pollingTimer) return;
    client = discordClient;
    state = loadState();
    console.log('[DiscordStatus] 公式ステータス監視を開始');
    console.log(`[DiscordStatus] 通知先: ${NOTIFY_CHANNEL_ID} / 間隔: ${POLL_INTERVAL_MS / 1000}秒`);
    // 起動時は保存済み状態と照合。変化がない限り通知は送らない。
    setTimeout(() => void poll(), 5_000);
    pollingTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
}
export function stopDiscordStatusMonitor() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = null;
}
