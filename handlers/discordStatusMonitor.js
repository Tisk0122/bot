// ==============================================
// handlers/discordStatusMonitor.js
// Discord公式ステータス監視
// 画像付きのステータスボードを1件だけ維持し、障害イベントだけを通知する。
// 状態は data/discord_status_state.json に保存し、再起動時の重複通知を抑止する。
// ==============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import {
    buildDiscordStatusImage,
    DISCORD_STATUS_IMAGE_NAME,
    DISCORD_STATUS_IMPACT_LABELS,
} from '../utils/discordStatusImage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'discord_status_state.json');
const NOTIFY_CHANNEL_ID = process.env.DISCORD_STATUS_CHANNEL_ID || '1566125669627461852';
const POLL_INTERVAL_MS = Math.max(30_000, Number(process.env.DISCORD_STATUS_POLL_INTERVAL_MS) || 60_000);
const API_BASE = (process.env.DISCORD_STATUS_API_BASE_URL || 'https://discordstatus.com/api/v2').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.DISCORD_STATUS_REQUEST_TIMEOUT_MS) || 12_000);
const retrySetting = Number(process.env.DISCORD_STATUS_REQUEST_RETRIES ?? 2);
const REQUEST_RETRIES = Number.isInteger(retrySetting) ? Math.max(0, Math.min(4, retrySetting)) : 2;
const FAILURE_ALERT_THRESHOLD = Math.max(1, Number(process.env.DISCORD_STATUS_FAILURE_ALERT_THRESHOLD) || 2);

const STATUS_API = {
    summary: `${API_BASE}/summary.json`,
    status: `${API_BASE}/status.json`,
    components: `${API_BASE}/components.json`,
    unresolvedIncidents: `${API_BASE}/incidents/unresolved.json`,
    incidents: `${API_BASE}/incidents.json`,
    maintenances: `${API_BASE}/scheduled-maintenances.json`,
    activeMaintenances: `${API_BASE}/scheduled-maintenances/active.json`,
    upcomingMaintenances: `${API_BASE}/scheduled-maintenances/upcoming.json`,
};

const INDICATOR_INFO = {
    none:        { label: '正常', color: 0x35D399 },
    minor:       { label: '一部で問題', color: 0xF5C45E },
    major:       { label: '大規模障害', color: 0xF36B76 },
    critical:    { label: '重大な障害', color: 0xEF5367 },
    maintenance: { label: 'メンテナンス', color: 0x8B9BFF },
    unknown: { label: '状態を確認できません', color: 0x9AA8BD },
};

const STATUS_JP = {
    operational: '正常',
    degraded_performance: '性能低下',
    partial_outage: '一部障害',
    major_outage: '大規模障害',
    under_maintenance: 'メンテナンス中',
};

const UPDATE_STATUS_JP = {
    investigating: '調査中', identified: '原因特定', monitoring: '経過観察',
    resolved: '解決済み', update: '更新', scheduled: '予定',
    in_progress: '対応中', verifying: '確認中', completed: '完了',
};

const COMP_JP = {
    API: 'API', CloudFlare: 'CloudFlare', Desktop: 'デスクトップ', Atlanta: 'Atlanta',
    Brazil: 'Brazil', iOS: 'iOS', Android: 'Android', Rotterdam: 'Rotterdam',
    'Media Proxy': 'メディアプロキシ', 'Tax Calculation Service': '税額計算サービス',
    'Creator Payouts': 'クリエイター支払い', 'Game Voice': 'ゲーム音声',
    Gateway: 'ゲートウェイ', Voice: '音声通話', 'Push Notifications': 'プッシュ通知',
    Search: '検索', Payments: '決済', CDN: 'CDN', 'Server Listing': 'サーバー一覧',
};

let client = null;
let pollingTimer = null;
let startupTimer = null;
let pollRunning = false;
let state = null;

const RESOLVED_STATUSES = new Set(['resolved', 'postmortem', 'completed']);
const COMPONENT_SEVERITY = {
    operational: 0,
    under_maintenance: 0,
    degraded_performance: 1,
    partial_outage: 1,
    major_outage: 2,
};
const INDICATOR_SEVERITY = { none: 0, minor: 1, major: 2, critical: 3, maintenance: 0 };
const SEVERITY_INDICATOR = ['none', 'minor', 'major', 'critical'];

function normalizeStatus(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function defaultState() {
    return {
        version: 4,
        initialized: false,
        indicator: null,
        summaryMessageId: null,
        incidents: {},
        components: {},
        apiFailureCount: 0,
        apiUnavailableNotified: false,
        lastSuccessfulPollAt: null,
    };
}

function loadState() {
    try {
        const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('状態ファイルの形式が不正です');
        }
        return {
            ...defaultState(),
            ...parsed,
            version: 4,
            incidents: parsed.incidents && typeof parsed.incidents === 'object' ? parsed.incidents : {},
            components: parsed.components && typeof parsed.components === 'object' ? parsed.components : {},
            apiFailureCount: Number(parsed.apiFailureCount || 0),
            apiUnavailableNotified: Boolean(parsed.apiUnavailableNotified),
        };
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('[DiscordStatus] 状態ファイルを読み込めません。初期状態で開始します:', error.message);
        }
        return defaultState();
    }
}

function saveState() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tempFile, STATE_FILE);
}

function jst(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    }).format(date) + ' JST';
}

function truncate(value, max = 220) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function fetchJson(url) {
    let lastError;
    for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
        try {
            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'DiscordBot-StatusMonitor/4.0 (+https://discordstatus.com)',
                    'Cache-Control': 'no-cache, no-store, max-age=0',
                    Pragma: 'no-cache',
                },
                cache: 'no-store',
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
            if (!response.ok) {
                const retryable = response.status === 429 || response.status >= 500;
                const error = new Error(`HTTP ${response.status} (${url})`);
                error.retryable = retryable;
                if (!retryable || attempt >= REQUEST_RETRIES) throw error;
                const retryHeader = response.headers.get('retry-after');
                const retrySeconds = Number(retryHeader);
                const retryDate = retryHeader && Number.isNaN(retrySeconds) ? Date.parse(retryHeader) : NaN;
                const waitMs = Number.isFinite(retrySeconds) && retrySeconds > 0
                    ? Math.min(retrySeconds * 1000, 8_000)
                    : Number.isFinite(retryDate) && retryDate > Date.now()
                        ? Math.min(retryDate - Date.now(), 8_000)
                        : Math.min(750 * (2 ** attempt), 5_000);
                await new Promise(resolve => setTimeout(resolve, waitMs));
                lastError = error;
                continue;
            }
            const data = await response.json();
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error(`JSON形式が不正です (${url})`);
            }
            return data;
        } catch (error) {
            lastError = error;
            if (attempt >= REQUEST_RETRIES || error.retryable === false) break;
            await new Promise(resolve => setTimeout(resolve, Math.min(750 * (2 ** attempt), 5_000)));
        }
    }
    throw lastError || new Error(`API取得失敗: ${url}`);
}

async function optionalFetch(url, key, label) {
    try {
        const data = await fetchJson(url);
        if (key && !Array.isArray(data[key])) throw new Error(`${label}: ${key} 配列がありません`);
        return { data, list: key ? data[key] : null, error: null };
    } catch (error) {
        console.warn(`[DiscordStatus] ${label} の取得に失敗: ${error.message}`);
        return { data: null, list: null, error };
    }
}

function isResolved(incident) {
    return RESOLVED_STATUSES.has(normalizeStatus(incident?.status)) || Boolean(incident?.resolved_at);
}

function isActiveIncident(incident) {
    return Boolean(incident?.id) && !isResolved(incident);
}

function newestRecord(first, second) {
    if (!first) return second;
    const firstTime = Date.parse(first.updated_at || first.created_at || 0) || 0;
    const secondTime = Date.parse(second.updated_at || second.created_at || 0) || 0;
    return secondTime >= firstTime ? second : first;
}

function mergeById(...lists) {
    const records = new Map();
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (!item?.id) continue;
            records.set(item.id, newestRecord(records.get(item.id), item));
        }
    }
    return [...records.values()];
}

function computeEffectiveIndicator(summary, activeIncidents, components, activeMaintenances) {
    const official = normalizeStatus(summary.status?.indicator) || 'unknown';
    let severity = Object.hasOwn(INDICATOR_SEVERITY, official) ? INDICATOR_SEVERITY[official] : -1;
    let hasMaintenance = false;
    let hasUnknownComponent = false;

    for (const component of components) {
        const status = normalizeStatus(component.status);
        if (status === 'under_maintenance') hasMaintenance = true;
        if (!Object.hasOwn(COMPONENT_SEVERITY, status)) hasUnknownComponent = true;
        severity = Math.max(severity, COMPONENT_SEVERITY[status] ?? 0);
    }

    for (const incident of activeIncidents) {
        // 集約indicatorより現在の未解決インシデントを優先して評価する。
        const impact = normalizeStatus(incident.impact);
        const incidentSeverity = Object.hasOwn(INDICATOR_SEVERITY, impact)
            ? INDICATOR_SEVERITY[impact]
            : 1;
        severity = Math.max(severity, incidentSeverity, 1);
    }

    if (severity > 0) return SEVERITY_INDICATOR[Math.min(severity, SEVERITY_INDICATOR.length - 1)];
    if (hasMaintenance || activeMaintenances.length > 0) return 'maintenance';
    if (hasUnknownComponent || !Object.hasOwn(INDICATOR_SEVERITY, official)) return 'unknown';
    return official;
}

async function fetchStatusSnapshot() {
    const [summaryResult, statusResult, componentsResult, unresolvedResult, incidentsResult,
        maintenanceResult, activeMaintenanceResult, upcomingMaintenanceResult] = await Promise.all([
        optionalFetch(STATUS_API.summary, null, 'summary.json'),
        optionalFetch(STATUS_API.status, null, 'status.json'),
        optionalFetch(STATUS_API.components, 'components', 'components.json'),
        optionalFetch(STATUS_API.unresolvedIncidents, 'incidents', 'incidents/unresolved.json'),
        optionalFetch(STATUS_API.incidents, 'incidents', 'incidents.json'),
        optionalFetch(STATUS_API.maintenances, 'scheduled_maintenances', 'scheduled-maintenances.json'),
        optionalFetch(STATUS_API.activeMaintenances, 'scheduled_maintenances', 'scheduled-maintenances/active.json'),
        optionalFetch(STATUS_API.upcomingMaintenances, 'scheduled_maintenances', 'scheduled-maintenances/upcoming.json'),
    ]);

    const rawSummary = summaryResult.data;
    const statusData = statusResult.data;
    if (!rawSummary && !statusData) throw new Error('summary.json / status.json を取得できません');

    const componentList = componentsResult.list?.length
        ? componentsResult.list
        : Array.isArray(rawSummary?.components) ? rawSummary.components : null;
    if (!componentList?.length) throw new Error('サービス状態を確認できません（components情報がありません）');

    const summary = {
        ...(rawSummary || {}),
        page: rawSummary?.page || statusData?.page || {},
        status: { ...(statusData?.status || {}), ...(rawSummary?.status || {}) },
        components: componentList,
    };

    const summaryIncidents = Array.isArray(rawSummary?.incidents) ? rawSummary.incidents : [];
    const allIncidents = incidentsResult.list || [];
    const unresolvedIncidents = unresolvedResult.list;
    // unresolved.json が取得できた場合は、専用一覧をアクティブ判定の基準にする。
    // 古い summary/incidents.json の内容を混ぜると解決済み障害が復活するため。
    const activeIncidents = unresolvedIncidents !== null
        ? mergeById(unresolvedIncidents).filter(isActiveIncident)
        : mergeById(summaryIncidents.filter(isActiveIncident), allIncidents.filter(isActiveIncident));

    const resolvedHistory = mergeById(allIncidents, summaryIncidents).filter(isResolved);
    const incidentRecordMap = new Map(resolvedHistory.map(item => [item.id, item]));
    // unresolved.json のレコードは、同じIDの履歴APIが古いresolvedを返しても必ず優先する。
    for (const item of activeIncidents) incidentRecordMap.set(item.id, item);
    const incidentRecords = [...incidentRecordMap.values()];
    if (unresolvedIncidents === null && !summaryIncidents.length && incidentsResult.list === null) {
        throw new Error('未解決インシデント情報を取得できません。正常とは判定しません');
    }

    const allMaintenances = mergeById(
        maintenanceResult.list || [],
        rawSummary?.scheduled_maintenances || [],
        activeMaintenanceResult.list || [],
        upcomingMaintenanceResult.list || [],
    );
    const activeMaintenances = allMaintenances.filter(item =>
        ['in_progress', 'verifying'].includes(normalizeStatus(item.status))
    );

    const indicator = computeEffectiveIndicator(summary, activeIncidents, componentList, activeMaintenances);
    summary.status = {
        ...summary.status,
        indicator,
        description: indicator === 'none' ? 'All Systems Operational' :
            indicator === 'maintenance' ? 'Scheduled Maintenance' :
            indicator === 'minor' ? 'Minor Service Issue' :
            indicator === 'major' ? 'Major Service Outage' :
            indicator === 'critical' ? 'Critical Service Outage' : 'Status unavailable',
    };

    return {
        summary, incidents: incidentRecords, activeIncidents,
        maintenances: allMaintenances, activeMaintenances,
        sources: {
            summary: Boolean(rawSummary), status: Boolean(statusData),
            components: Boolean(componentsResult.list),
            unresolvedIncidents: unresolvedIncidents !== null,
            allIncidents: incidentsResult.list !== null,
            maintenances: maintenanceResult.list !== null,
            activeMaintenances: activeMaintenanceResult.list !== null,
            upcomingMaintenances: upcomingMaintenanceResult.list !== null,
        },
    };
}

function latestUpdate(incident) {
    const updates = Array.isArray(incident.incident_updates) ? incident.incident_updates : [];
    return updates.reduce((latest, item) => {
        if (!latest) return item;
        const a = Date.parse(latest.updated_at || latest.created_at || latest.display_at || 0) || 0;
        const b = Date.parse(item.updated_at || item.created_at || item.display_at || 0) || 0;
        return b > a ? item : latest;
    }, null) || {};
}

function incidentFingerprint(incident) {
    const latest = latestUpdate(incident);
    return [normalizeStatus(incident.status), normalizeStatus(latest.status), latest.id || '',
        latest.updated_at || latest.created_at || latest.display_at || '', latest.body || '',
        incident.updated_at || ''].join('|');
}

function buildSummaryEmbed(summary, incidents = [], maintenances = []) {
    const indicator = summary.status?.indicator || 'none';
    const info = INDICATOR_INFO[indicator] || INDICATOR_INFO.unknown;
    const components = summary.components || [];
    const activeIncidents = incidents.filter(incident => !isResolved(incident));
    const activeMaintenanceCount = maintenances.filter(item => ['in_progress', 'verifying'].includes(normalizeStatus(item.status))).length;
    const serviceLines = components.filter(component => !component.group).map(component =>
        `**${COMP_JP[component.name] || component.name}**　${STATUS_JP[normalizeStatus(component.status)] || component.status || '不明'}`
    );

    const embed = new EmbedBuilder()
        .setTitle('Discord 公式ステータス')
        .setDescription([`**全体状態：${info.label}**`, 'サービス別の詳細は画像をご確認ください。', `現在のインシデント：**${activeIncidents.length}件**`, activeMaintenanceCount ? `実施中のメンテナンス：**${activeMaintenanceCount}件**` : null].filter(Boolean).join('\n'))
        .setColor(info.color)
        .setURL('https://discordstatus.com')
        .setImage(`attachment://${DISCORD_STATUS_IMAGE_NAME}`)
        .setTimestamp()
        .setFooter({ text: 'Discord Status ・ 公式情報を定期取得' });

    if (serviceLines.length) {
        const text = serviceLines.join('\n');
        embed.addFields({
            name: 'サービス別の状態（テキスト表示）',
            value: text.length > 1024 ? `${text.slice(0, 1018)}……` : text,
        });
    }
    return embed;
}

function buildIncidentEmbed(incident, updated = false) {
    const resolved = isResolved(incident);
    const impact = DISCORD_STATUS_IMPACT_LABELS[incident.impact] || incident.impact || '不明';
    const color = resolved ? 0x35D399 :
        incident.impact === 'critical' || incident.impact === 'major' ? 0xF36B76 :
        incident.impact === 'maintenance' ? 0x8B9BFF : 0xF5C45E;
    const updates = [...(incident.incident_updates || [])].sort((a, b) =>
        (Date.parse(b.updated_at || b.created_at || b.display_at || 0) || 0) -
        (Date.parse(a.updated_at || a.created_at || a.display_at || 0) || 0)
    ).slice(0, 4);
    const updateText = updates.map(update => {
        const status = UPDATE_STATUS_JP[normalizeStatus(update.status)] || update.status || '更新';
        return `**${status}**　${jst(update.created_at)}\n${truncate(update.body, 240)}`;
    }).join('\n\n');
    const titlePrefix = resolved ? 'Discord障害が解決しました' : updated ? 'Discord障害情報が更新されました' : 'Discordで障害が発生しました';
    const embed = new EmbedBuilder()
        .setTitle(`${titlePrefix}：${truncate(incident.name, 150)}`)
        .setDescription(updateText || '詳細情報は公式ステータスページを確認してください。')
        .addFields(
            { name: '影響度', value: String(impact), inline: true },
            { name: '現在の状態', value: UPDATE_STATUS_JP[normalizeStatus(incident.status)] || String(incident.status || '不明'), inline: true },
            { name: '発生時刻', value: jst(incident.created_at), inline: true },
        )
        .setColor(color)
        .setURL(incident.shortlink || 'https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: resolved ? '解決通知' : updated ? '障害情報の更新通知' : '新規障害通知' });

    if (resolved) {
        embed.addFields({ name: '解決時刻', value: jst(incident.resolved_at || incident.updated_at), inline: true });
    }
    return embed;
}

async function getNotifyChannel() {
    try {
        const channel = await client.channels.fetch(NOTIFY_CHANNEL_ID);
        if (!channel?.isTextBased() || !channel.messages || typeof channel.send !== 'function') {
            console.error('[DiscordStatus] 通知先がテキストチャンネルではありません。');
            return null;
        }
        return channel;
    } catch (error) {
        console.error('[DiscordStatus] 通知チャンネル取得失敗:', error.message);
        return null;
    }
}

async function buildSummaryPayload(summary, incidents, maintenances = []) {
    const image = await buildDiscordStatusImage(summary, incidents, Date.now(), maintenances);
    return {
        embeds: [buildSummaryEmbed(summary, incidents, maintenances)],
        files: [new AttachmentBuilder(image, { name: DISCORD_STATUS_IMAGE_NAME })],
    };
}

async function updateSummary(channel, summary, incidents, maintenances = []) {
    const payload = await buildSummaryPayload(summary, incidents, maintenances);
    if (state.summaryMessageId) {
        try {
            const message = await channel.messages.fetch(state.summaryMessageId);
            // 旧画像を削除してから新しい添付画像を付け直し、添付ファイルが増殖しないようにする。
            await message.edit({ ...payload, attachments: [] });
            return;
        } catch (error) {
            console.warn('[DiscordStatus] 既存のステータス投稿を編集できません。新しい投稿を作成します:', error.message);
            state.summaryMessageId = null;
            saveState();
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
        .setTitle(recovered ? 'Discordの障害が改善しました' : 'Discordの状態が変化しました')
        .setDescription(`**${before.label}** から **${after.label}** に変化しました。\n詳細は最新のステータス画像をご確認ください。`)
        .setColor(after.color)
        .setURL('https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: 'Discord公式ステータス' });
    await channel.send({ embeds: [embed] });
}

async function processIncidents(channel, incidents) {
    const seen = new Set();
    let sentEventNotification = false;

    for (const incident of incidents) {
        if (!incident?.id) continue;
        seen.add(incident.id);
        const previous = state.incidents[incident.id];
        const fingerprint = incidentFingerprint(incident);
        const resolved = isResolved(incident);

        if (!previous) {
            const record = {
                messageId: null, fingerprint, resolved, updatedAt: Date.now(),
                notificationSent: !resolved,
            };
            state.incidents[incident.id] = record;
            saveState();
            // 初回導入時点ですでに進行中の障害も、初回に一度だけ検出通知する。
            if (!resolved) {
                try {
                    const message = await channel.send({ embeds: [buildIncidentEmbed(incident)] });
                    record.messageId = message.id;
                    record.notificationSent = true;
                    saveState();
                    sentEventNotification = true;
                } catch (error) {
                    record.notificationSent = false;
                    saveState();
                    console.error(`[DiscordStatus] 初回障害通知失敗 (${incident.id}):`, error.message);
                }
            }
            continue;
        }

        // 旧バージョンから移行したレコードで、進行中障害の通知履歴がない場合は一度検出する。
        if (!resolved && previous.notificationSent !== true) {
            previous.notificationSent = true;
            previous.fingerprint = fingerprint;
            previous.resolved = false;
            previous.updatedAt = Date.now();
            saveState();
            try {
                const message = await channel.send({ embeds: [buildIncidentEmbed(incident)] });
                previous.messageId = message.id;
                saveState();
                sentEventNotification = true;
            } catch (error) {
                previous.notificationSent = false;
                saveState();
                console.error(`[DiscordStatus] 既存障害の検出通知失敗 (${incident.id}):`, error.message);
            }
            continue;
        }

        const becameResolved = resolved && !previous.resolved;
        const reopened = !resolved && previous.resolved;
        const fingerprintChanged = previous.fingerprint !== fingerprint;
        if (!becameResolved && !reopened && !fingerprintChanged) continue;

        const oldFingerprint = previous.fingerprint;
        const oldResolved = previous.resolved;
        previous.fingerprint = fingerprint;
        previous.resolved = resolved;
        previous.updatedAt = Date.now();
        saveState();

        // 詳細投稿は編集し、更新通知は別投稿として送る。
        if (previous.messageId) {
            try {
                const oldMessage = await channel.messages.fetch(previous.messageId);
                await oldMessage.edit({ embeds: [buildIncidentEmbed(incident, true)] });
            } catch (error) {
                console.warn(`[DiscordStatus] 案件メッセージ更新失敗 (${incident.id}):`, error.message);
            }
        }

        try {
            if (becameResolved) {
                await channel.send({ embeds: [buildIncidentEmbed(incident, true)] });
                sentEventNotification = true;
            } else if (reopened) {
                await channel.send({ embeds: [buildIncidentEmbed(incident)] });
                sentEventNotification = true;
            } else if (!resolved) {
                const update = latestUpdate(incident);
                const embed = new EmbedBuilder()
                    .setTitle('Discord障害情報が更新されました')
                    .setDescription(`**${truncate(incident.name, 180)}**\n\n${truncate(update.body, 1200)}`)
                    .addFields({
                        name: '現在の状態',
                        value: UPDATE_STATUS_JP[normalizeStatus(incident.status)] || String(incident.status || '不明'),
                        inline: true,
                    })
                    .setColor(0xF5C45E)
                    .setURL(incident.shortlink || 'https://discordstatus.com')
                    .setTimestamp()
                    .setFooter({ text: 'Discord公式ステータス・更新通知' });
                await channel.send({ embeds: [embed] });
                sentEventNotification = true;
            }
        } catch (error) {
            previous.fingerprint = oldFingerprint;
            previous.resolved = oldResolved;
            saveState();
            console.error(`[DiscordStatus] 障害イベント通知失敗 (${incident.id}):`, error.message);
        }
    }

    // Statuspageの全履歴は直近50件なので、一定期間を過ぎたローカル履歴のみ整理する。
    const cutoff = Date.now() - 30 * 24 * 60 * 60_000;
    for (const [id, item] of Object.entries(state.incidents)) {
        if (!seen.has(id) && Number(item.updatedAt || 0) < cutoff) delete state.incidents[id];
    }
    return sentEventNotification;
}

async function processComponentChanges(channel, components) {
    let sent = false;
    const next = {};
    const failed = new Set();
    for (const component of components) {
        if (!component?.id || component.group) continue;
        const key = component.id;
        const status = normalizeStatus(component.status) || 'unknown';
        const previous = state.components[key];
        next[key] = { name: component.name, status, updatedAt: Date.now() };
        if (!previous || previous.status === status) continue;

        const beforeSeverity = COMPONENT_SEVERITY[previous.status] ?? 0;
        const afterSeverity = COMPONENT_SEVERITY[status] ?? 0;
        const improved = afterSeverity < beforeSeverity;
        const worsened = afterSeverity > beforeSeverity;
        const startedMaintenance = previous.status !== 'under_maintenance' && status === 'under_maintenance';
        const endedMaintenance = previous.status === 'under_maintenance' && status !== 'under_maintenance';
        const changedIssue = beforeSeverity > 0 && afterSeverity === beforeSeverity && status !== previous.status;
        if (!improved && !worsened && !startedMaintenance && !endedMaintenance && !changedIssue) continue;

        const name = COMP_JP[component.name] || component.name || 'サービス';
        const title = improved || endedMaintenance
            ? 'Discordサービスの状態が改善しました'
            : startedMaintenance
                ? 'Discordサービスのメンテナンスが開始しました'
                : 'Discordサービスで問題を検出しました';
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(`**${name}** の状態が **${STATUS_JP[previous.status] || previous.status}** から **${STATUS_JP[status] || status}** に変化しました。`)
            .setColor(improved || endedMaintenance ? 0x35D399 : startedMaintenance ? 0x8B9BFF : 0xF36B76)
            .setURL('https://discordstatus.com')
            .setTimestamp()
            .setFooter({ text: 'Discord公式コンポーネント状態' });
        try {
            await channel.send({ embeds: [embed] });
            state.components[key] = next[key];
            saveState();
            sent = true;
        } catch (error) {
            failed.add(key);
            console.error(`[DiscordStatus] サービス状態通知失敗 (${component.name}):`, error.message);
        }
    }
    for (const [key, value] of Object.entries(next)) {
        if (!failed.has(key)) state.components[key] = value;
    }
    saveState();
    return sent;
}

async function sendApiUnavailableNotice(channel, error) {
    const embed = new EmbedBuilder()
        .setTitle('Discord公式ステータスを取得できません')
        .setDescription(`公式APIの取得に **${state.apiFailureCount}回連続** で失敗しています。誤って正常と表示しないよう、前回の取得状態を保持しています。\n\n${truncate(error.message, 700)}`)
        .setColor(0xF5C45E)
        .setURL('https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: 'Bot監視機能の通信状態' });
    await channel.send({ embeds: [embed] });
}

async function sendApiRecoveredNotice(channel) {
    const embed = new EmbedBuilder()
        .setTitle('Discord公式ステータスの取得が復旧しました')
        .setDescription('公式APIからの情報取得が再開しました。最新のステータス画像を更新しています。')
        .setColor(0x35D399)
        .setURL('https://discordstatus.com')
        .setTimestamp()
        .setFooter({ text: 'Bot監視機能の通信状態' });
    await channel.send({ embeds: [embed] });
}

async function recordApiFetchFailure(error) {
    state.apiFailureCount = Number(state.apiFailureCount || 0) + 1;
    const shouldNotify = state.apiFailureCount >= FAILURE_ALERT_THRESHOLD && !state.apiUnavailableNotified;
    if (shouldNotify) state.apiUnavailableNotified = true;
    saveState();
    console.error(`[DiscordStatus] API取得失敗 (${state.apiFailureCount}回連続):`, error.message);
    if (!shouldNotify) return;
    const channel = await getNotifyChannel();
    if (!channel) {
        state.apiUnavailableNotified = false;
        saveState();
        return;
    }
    try {
        await sendApiUnavailableNotice(channel, error);
    } catch (sendError) {
        state.apiUnavailableNotified = false;
        saveState();
        console.error('[DiscordStatus] API取得失敗通知も送信できませんでした:', sendError.message);
    }
}

async function recordApiFetchRecovery(channel) {
    const wasUnavailable = state.apiUnavailableNotified;
    state.apiFailureCount = 0;
    state.apiUnavailableNotified = false;
    saveState();
    if (!wasUnavailable || !channel) return;
    try {
        await sendApiRecoveredNotice(channel);
    } catch (error) {
        console.error('[DiscordStatus] API復旧通知の送信失敗:', error.message);
    }
}

async function poll() {
    if (pollRunning || !client?.isReady() || !state) return;
    pollRunning = true;
    try {
        let snapshot;
        try {
            snapshot = await fetchStatusSnapshot();
        } catch (fetchError) {
            await recordApiFetchFailure(fetchError);
            return;
        }

        const channel = await getNotifyChannel();
        if (!channel) return;
        await recordApiFetchRecovery(channel);

        const { summary, incidents, activeIncidents, maintenances } = snapshot;
        await updateSummary(channel, summary, activeIncidents, maintenances);
        const incidentNotified = await processIncidents(channel, incidents);
        const componentNotified = await processComponentChanges(channel, summary.components || []);
        const previousIndicator = state.indicator || 'none';
        const currentIndicator = summary.status.indicator || 'unknown';

        if (previousIndicator !== currentIndicator) {
            if (!incidentNotified && !componentNotified) await sendIndicatorChange(channel, previousIndicator, currentIndicator);
        }
        state.indicator = currentIndicator;

        state.initialized = true;
        state.lastSuccessfulPollAt = new Date().toISOString();
        saveState();
        console.log(`[DiscordStatus] 更新完了: ${currentIndicator}; active=${activeIncidents.length}; sources=${JSON.stringify(snapshot.sources)}`);
    } catch (error) {
        console.error('[DiscordStatus] 監視処理エラー（前回状態を保持）:', error.message);
    } finally {
        pollRunning = false;
    }
}

export async function fetchCurrentStatus() {
    const snapshot = await fetchStatusSnapshot();
    const { summary, incidents, activeIncidents } = snapshot;
    const payload = await buildSummaryPayload(summary, activeIncidents, snapshot.maintenances);
    return {
        ...payload,
        embeds: [payload.embeds[0], ...activeIncidents.slice(0, 3).map(item => buildIncidentEmbed(item))],
        indicator: summary.status.indicator,
        info: INDICATOR_INFO[summary.status.indicator] || INDICATOR_INFO.unknown,
        activeCount: activeIncidents.length,
        sources: snapshot.sources,
    };
}

export function startDiscordStatusMonitor(discordClient) {
    if (pollingTimer) return;
    client = discordClient;
    state = loadState();
    console.log('[DiscordStatus] 公式ステータス監視を開始');
    console.log(`[DiscordStatus] 通知先: ${NOTIFY_CHANNEL_ID} / 間隔: ${POLL_INTERVAL_MS / 1000}秒`);
    startupTimer = setTimeout(() => void poll(), 5_000);
    pollingTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
}

export function stopDiscordStatusMonitor() {
    if (startupTimer) clearTimeout(startupTimer);
    if (pollingTimer) clearInterval(pollingTimer);
    startupTimer = null;
    pollingTimer = null;
    pollRunning = false;
}
