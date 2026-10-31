import sharp from 'sharp';

const WIDTH = 1400;
const PAD = 64;
const GAP = 24;
const HEADER_HEIGHT = 190;
const OVERVIEW_HEIGHT = 166;
const METRIC_HEIGHT = 108;
const SERVICE_HEADER_HEIGHT = 82;
const SERVICE_ROW_HEIGHT = 66;
const INCIDENT_ROW_HEIGHT = 78;
const MAINTENANCE_ROW_HEIGHT = 70;
const IMAGE_MAX_COMPONENTS = 30;
const IMAGE_MAX_INCIDENTS = 5;

const STATUS = {
    operational: { label: '正常', color: '#35D399', background: '#35D399' },
    degraded_performance: { label: '性能低下', color: '#F5C45E', background: '#F5C45E' },
    partial_outage: { label: '一部障害', color: '#F59E5B', background: '#F59E5B' },
    major_outage: { label: '大規模障害', color: '#F36B76', background: '#F36B76' },
    under_maintenance: { label: 'メンテナンス', color: '#8B9BFF', background: '#8B9BFF' },
};

const INDICATORS = {
    none: { label: 'すべて正常', color: '#35D399', message: 'すべてのサービスが正常に稼働しています。' },
    minor: { label: '一部で問題が発生', color: '#F5C45E', message: '一部のサービスで性能低下または障害が発生しています。' },
    major: { label: '大規模な障害', color: '#F36B76', message: '複数のサービスに大きな影響が発生しています。' },
    critical: { label: '重大な障害', color: '#EF5367', message: 'Discordのサービスに重大な障害が発生しています。' },
    maintenance: { label: 'メンテナンス中', color: '#8B9BFF', message: '一部サービスでメンテナンスが実施されています。' },
    unknown: { label: '状態を確認できません', color: '#9AA8BD', message: '公式APIの情報が不十分なため、正常とは判定していません。' },
};

const UPDATE_LABELS = {
    investigating: '調査中', identified: '原因特定', monitoring: '経過観察',
    resolved: '解決済み', postmortem: '事後報告', scheduled: '予定',
    in_progress: '実施中', verifying: '確認中', completed: '完了',
};

const IMPACT_LABELS = {
    none: '情報', minor: '軽微', major: '重大', critical: '緊急', maintenance: 'メンテナンス',
};

function escapeXml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    })[character]);
}

function truncate(value, max = 28) {
    const chars = Array.from(String(value ?? ''));
    return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : chars.join('');
}

function getIndicator(indicator) {
    return INDICATORS[indicator] || INDICATORS.unknown;
}

function getComponentStatus(status) {
    return STATUS[status] || { label: status || '不明', color: '#9AA8BD', background: '#9AA8BD' };
}

function formatJst(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '時刻不明';
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    }).format(date) + ' JST';
}

function formatComponentName(component) {
    const aliases = {
        API: 'API', CloudFlare: 'CloudFlare', Desktop: 'デスクトップ', Atlanta: 'Atlanta',
        Brazil: 'Brazil', iOS: 'iOS', Android: 'Android', Rotterdam: 'Rotterdam',
        'Media Proxy': 'メディアプロキシ', 'Tax Calculation Service': '税額計算サービス',
        'Creator Payouts': 'クリエイター支払い', 'Game Voice': 'ゲーム音声',
        Gateway: 'ゲートウェイ', Voice: '音声通話', 'Push Notifications': 'プッシュ通知',
        Search: '検索', Payments: '決済', CDN: 'CDN', 'Server Listing': 'サーバー一覧',
    };
    return aliases[component.name] || component.name || '名称未設定';
}

function renderServiceRow(component, x, y, width, index) {
    const status = getComponentStatus(component.status);
    const name = escapeXml(truncate(formatComponentName(component), 28));
    const rowBackground = index % 2 === 0 ? '#FFFFFF' : '#FFFFFF';
    const rowOpacity = index % 2 === 0 ? '0.025' : '0';
    const pillWidth = 112;
    const pillX = x + width - pillWidth - 14;
    return `
        <rect x="${x + 4}" y="${y}" width="${width - 8}" height="${SERVICE_ROW_HEIGHT}" rx="12" fill="${rowBackground}" fill-opacity="${rowOpacity}" />
        <circle cx="${x + 28}" cy="${y + 33}" r="6" fill="${status.color}" />
        <text x="${x + 48}" y="${y + 39}" class="service-name">${name}</text>
        <rect x="${pillX}" y="${y + 15}" width="${pillWidth}" height="34" rx="17" fill="${status.background}" fill-opacity="0.13" />
        <text x="${pillX + pillWidth / 2}" y="${y + 37}" class="service-status" text-anchor="middle" fill="${status.color}">${escapeXml(status.label)}</text>`;
}

function renderServiceColumn(components, x, y, width) {
    return components.map((component, index) =>
        renderServiceRow(component, x, y + index * SERVICE_ROW_HEIGHT, width, index)
    ).join('');
}

function renderMaintenanceRow(maintenance, x, y, width, index) {
    const status = String(maintenance.status || '').toLowerCase();
    const statusLabel = status === 'in_progress' ? '実施中' : status === 'verifying' ? '確認中' : '予定';
    const time = maintenance.scheduled_for || maintenance.scheduled_until || maintenance.updated_at;
    const title = escapeXml(truncate(maintenance.name || 'メンテナンス', 62));
    return `
        <rect x="${x + 4}" y="${y}" width="${width - 8}" height="${MAINTENANCE_ROW_HEIGHT - 6}" rx="12" fill="#FFFFFF" fill-opacity="${index % 2 === 0 ? '0.035' : '0.015'}" />
        <rect x="${x + 18}" y="${y + 14}" width="4" height="38" rx="2" fill="#8B9BFF" />
        <text x="${x + 36}" y="${y + 27}" class="incident-title">${title}</text>
        <text x="${x + 36}" y="${y + 49}" class="incident-meta">${statusLabel} ・ ${escapeXml(formatJst(time))}</text>`;
}

function renderIncidentRow(incident, x, y, width, index) {
    const impactColor = incident.impact === 'critical' || incident.impact === 'major'
        ? '#F36B76'
        : incident.impact === 'maintenance' ? '#8B9BFF' : '#F5C45E';
    const title = escapeXml(truncate(incident.name || 'インシデント', 62));
    const latest = [...(incident.incident_updates || [])].sort((a, b) =>
        (Date.parse(b.updated_at || b.created_at || b.display_at || 0) || 0) -
        (Date.parse(a.updated_at || a.created_at || a.display_at || 0) || 0)
    )[0];
    const statusValue = String(latest?.status || incident.status || '対応中').toLowerCase().replace(/[\s-]+/g, '_');
    const status = escapeXml(UPDATE_LABELS[statusValue] || statusValue);
    const updated = escapeXml(formatJst(latest?.updated_at || latest?.created_at || incident.updated_at || incident.created_at));
    return `
        <rect x="${x + 4}" y="${y}" width="${width - 8}" height="${INCIDENT_ROW_HEIGHT - 6}" rx="12" fill="#FFFFFF" fill-opacity="${index % 2 === 0 ? '0.035' : '0.015'}" />
        <rect x="${x + 18}" y="${y + 17}" width="4" height="40" rx="2" fill="${impactColor}" />
        <text x="${x + 36}" y="${y + 30}" class="incident-title">${title}</text>
        <text x="${x + 36}" y="${y + 53}" class="incident-meta">${status} ・ ${updated}</text>`;
}

export async function buildDiscordStatusImage(summary, incidents = [], updatedAt = Date.now(), maintenances = []) {
    const components = (summary.components || []).filter(component => !component.group).slice(0, IMAGE_MAX_COMPONENTS);
    const activeIncidents = incidents.filter(incident =>
        !['resolved', 'postmortem', 'completed'].includes(String(incident.status || '').toLowerCase()) && !incident.resolved_at
    );
    const visibleMaintenances = maintenances
        .filter(item => ['scheduled', 'in_progress', 'verifying'].includes(String(item.status || '').toLowerCase()))
        .sort((a, b) => (Date.parse(a.scheduled_for || a.created_at || 0) || 0) - (Date.parse(b.scheduled_for || b.created_at || 0) || 0))
        .slice(0, 4);
    const indicator = getIndicator(summary.status?.indicator || 'unknown');

    const columnGap = 22;
    const innerWidth = WIDTH - PAD * 2;
    const columnWidth = (innerWidth - columnGap) / 2;
    const leftServices = components.filter((_, index) => index % 2 === 0);
    const rightServices = components.filter((_, index) => index % 2 === 1);
    const serviceRows = Math.max(leftServices.length, rightServices.length, 1);
    const serviceHeight = SERVICE_HEADER_HEIGHT + serviceRows * SERVICE_ROW_HEIGHT + 18;
    const serviceY = HEADER_HEIGHT + OVERVIEW_HEIGHT + 26 + METRIC_HEIGHT + 22;
    const incidentY = serviceY + serviceHeight + 22;
    const visibleIncidents = activeIncidents.slice(0, IMAGE_MAX_INCIDENTS);
    const incidentHeight = 94 + Math.max(visibleIncidents.length, 1) * INCIDENT_ROW_HEIGHT + 16;
    const showIncidents = activeIncidents.length > 0;
    const maintenanceY = (showIncidents ? incidentY + incidentHeight : serviceY + serviceHeight) + 22;
    const maintenanceHeight = 88 + Math.max(visibleMaintenances.length, 1) * MAINTENANCE_ROW_HEIGHT + 14;
    const showMaintenances = visibleMaintenances.length > 0;
    const footerY = (showMaintenances ? maintenanceY + maintenanceHeight :
        showIncidents ? incidentY + incidentHeight : serviceY + serviceHeight) + 24;
    const height = footerY + 114;
    const updateLabel = escapeXml(formatJst(updatedAt));

    const serviceContent = components.length
        ? `${renderServiceColumn(leftServices, PAD + 20, serviceY + SERVICE_HEADER_HEIGHT, columnWidth - 20)}
           ${renderServiceColumn(rightServices, PAD + columnWidth + columnGap + 10, serviceY + SERVICE_HEADER_HEIGHT, columnWidth - 20)}`
        : `<text x="${WIDTH / 2}" y="${serviceY + 142}" class="empty-text" text-anchor="middle">サービス情報を取得できませんでした</text>`;

    const serviceDivider = `<line x1="${PAD + columnWidth + columnGap / 2}" y1="${serviceY + 92}" x2="${PAD + columnWidth + columnGap / 2}" y2="${serviceY + serviceHeight - 18}" stroke="#344258" stroke-width="1" />`;
    const incidentRows = visibleIncidents.map((incident, index) =>
        renderIncidentRow(incident, PAD + 22, incidentY + 82 + index * INCIDENT_ROW_HEIGHT, innerWidth - 44, index)
    ).join('');
    const overflowIncidents = activeIncidents.length > IMAGE_MAX_INCIDENTS
        ? `<text x="${PAD + innerWidth - 28}" y="${incidentY + incidentHeight - 18}" class="incident-meta" text-anchor="end">ほか ${activeIncidents.length - IMAGE_MAX_INCIDENTS} 件</text>`
        : '';
    const maintenanceRows = visibleMaintenances.map((item, index) =>
        renderMaintenanceRow(item, PAD + 22, maintenanceY + 72 + index * MAINTENANCE_ROW_HEIGHT, innerWidth - 44, index)
    ).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
    <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#080E1A"/><stop offset="0.55" stop-color="#101A2C"/><stop offset="1" stop-color="#111D31"/></linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#818CF8"/><stop offset="0.55" stop-color="#60A5FA"/><stop offset="1" stop-color="#38BDF8"/></linearGradient>
        <linearGradient id="overview" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${indicator.color}" stop-opacity="0.17"/><stop offset="1" stop-color="${indicator.color}" stop-opacity="0.045"/></linearGradient>
        <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#334155" stop-opacity="0"/><stop offset="0.5" stop-color="#475569" stop-opacity="0.8"/><stop offset="1" stop-color="#334155" stop-opacity="0"/></linearGradient>
        <style>
            text { font-family: "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", sans-serif; }
            .eyebrow { fill: #71819A; font-size: 13px; font-weight: 800; letter-spacing: 5px; }
            .title { fill: #F1F5FF; font-size: 43px; font-weight: 900; letter-spacing: -1px; }
            .subtitle { fill: #91A0B8; font-size: 17px; }
            .live { fill: #9FB0C8; font-size: 13px; font-weight: 800; letter-spacing: 2px; }
            .overview-label { fill: #A9B8CF; font-size: 15px; font-weight: 700; letter-spacing: 1px; }
            .overview-status { fill: #F4F7FF; font-size: 32px; font-weight: 900; }
            .overview-description { fill: #B7C3D6; font-size: 17px; }
            .metric-label { fill: #8697B1; font-size: 14px; font-weight: 700; }
            .metric-value { fill: #EDF3FF; font-size: 30px; font-weight: 900; }
            .section-title { fill: #E5ECFA; font-size: 22px; font-weight: 850; }
            .section-subtitle { fill: #7586A0; font-size: 13px; }
            .service-name { fill: #D8E2F2; font-size: 17px; font-weight: 600; }
            .service-status { font-size: 14px; font-weight: 800; }
            .incident-title { fill: #E5ECF8; font-size: 17px; font-weight: 750; }
            .incident-meta { fill: #8D9DB5; font-size: 13px; }
            .footer { fill: #8190A8; font-size: 14px; }
            .empty-text { fill: #91A0B8; font-size: 17px; }
        </style>
    </defs>

    <rect width="${WIDTH}" height="${height}" fill="url(#background)" />
    <circle cx="1190" cy="54" r="170" fill="#818CF8" fill-opacity="0.045" />
    <circle cx="1320" cy="220" r="105" fill="#38BDF8" fill-opacity="0.035" />
    <rect x="${PAD}" y="0" width="230" height="5" rx="2.5" fill="url(#accent)" />

    <text x="${PAD}" y="48" class="eyebrow">DISCORD SYSTEM STATUS</text>
    <text x="${PAD}" y="108" class="title">Discord 公式ステータス</text>
    <text x="${PAD}" y="143" class="subtitle">サービス稼働状況と障害情報をまとめて確認できます</text>
    <rect x="${WIDTH - PAD - 156}" y="30" width="156" height="38" rx="19" fill="#111D2F" stroke="#344258" />
    <circle cx="${WIDTH - PAD - 132}" cy="49" r="5" fill="${indicator.color}" />
    <text x="${WIDTH - PAD - 116}" y="54" class="live">LIVE MONITOR</text>
    <line x1="${PAD}" y1="${HEADER_HEIGHT - 2}" x2="${WIDTH - PAD}" y2="${HEADER_HEIGHT - 2}" stroke="url(#rule)" />

    <rect x="${PAD}" y="${HEADER_HEIGHT}" width="${innerWidth}" height="${OVERVIEW_HEIGHT}" rx="24" fill="url(#overview)" stroke="${indicator.color}" stroke-opacity="0.38" stroke-width="1.5" />
    <rect x="${PAD}" y="${HEADER_HEIGHT}" width="6" height="${OVERVIEW_HEIGHT}" rx="3" fill="${indicator.color}" />
    <circle cx="${PAD + 58}" cy="${HEADER_HEIGHT + 82}" r="22" fill="${indicator.color}" fill-opacity="0.16" />
    <circle cx="${PAD + 58}" cy="${HEADER_HEIGHT + 82}" r="8" fill="${indicator.color}" />
    <text x="${PAD + 100}" y="${HEADER_HEIGHT + 48}" class="overview-label">現在の全体状態</text>
    <text x="${PAD + 100}" y="${HEADER_HEIGHT + 92}" class="overview-status">${escapeXml(indicator.label)}</text>
    <text x="${PAD + 100}" y="${HEADER_HEIGHT + 127}" class="overview-description">${escapeXml(indicator.message)}</text>
    <text x="${WIDTH - PAD - 28}" y="${HEADER_HEIGHT + 50}" class="overview-label" text-anchor="end">公式情報</text>
    <text x="${WIDTH - PAD - 28}" y="${HEADER_HEIGHT + 82}" class="overview-description" text-anchor="end">discordstatus.com</text>

    <rect x="${PAD}" y="${HEADER_HEIGHT + OVERVIEW_HEIGHT + 22}" width="${columnWidth}" height="${METRIC_HEIGHT}" rx="18" fill="#FFFFFF" fill-opacity="0.035" stroke="#344258" stroke-opacity="0.65" />
    <rect x="${PAD + columnWidth + columnGap}" y="${HEADER_HEIGHT + OVERVIEW_HEIGHT + 22}" width="${columnWidth}" height="${METRIC_HEIGHT}" rx="18" fill="#FFFFFF" fill-opacity="0.035" stroke="#344258" stroke-opacity="0.65" />
    <text x="${PAD + 28}" y="${HEADER_HEIGHT + OVERVIEW_HEIGHT + 56}" class="metric-label">監視対象サービス</text>
    <text x="${PAD + 28}" y="${HEADER_HEIGHT + OVERVIEW_HEIGHT + 92}" class="metric-value">${components.length}<tspan font-size="16" fill="#8D9DB5"> / ${summary.components?.length || 0} 件</tspan></text>
    <text x="${PAD + columnWidth + columnGap + 28}" y="${HEADER_HEIGHT + OVERVIEW_HEIGHT + 56}" class="metric-label">進行中のインシデント</text>
    <text x="${PAD + columnWidth + columnGap + 28}" y="${HEADER_HEIGHT + OVERVIEW_HEIGHT + 92}" class="metric-value" fill="${activeIncidents.length ? '#F5C45E' : '#35D399'}">${activeIncidents.length}<tspan font-size="16" fill="#8D9DB5"> 件</tspan></text>

    <rect x="${PAD}" y="${serviceY}" width="${innerWidth}" height="${serviceHeight}" rx="22" fill="#FFFFFF" fill-opacity="0.025" stroke="#344258" stroke-opacity="0.65" />
    <text x="${PAD + 24}" y="${serviceY + 42}" class="section-title">サービス別の状態</text>
    <text x="${WIDTH - PAD - 24}" y="${serviceY + 40}" class="section-subtitle" text-anchor="end">各サービスの現在の稼働状況</text>
    ${serviceDivider}
    ${serviceContent}

    ${showIncidents ? `
        <rect x="${PAD}" y="${incidentY}" width="${innerWidth}" height="${incidentHeight}" rx="22" fill="#FFFFFF" fill-opacity="0.025" stroke="#344258" stroke-opacity="0.65" />
        <text x="${PAD + 24}" y="${incidentY + 43}" class="section-title">進行中のインシデント</text>
        <text x="${WIDTH - PAD - 24}" y="${incidentY + 41}" class="section-subtitle" text-anchor="end">${activeIncidents.length} 件</text>
        ${incidentRows}
        ${overflowIncidents}
    ` : ''}

    ${showMaintenances ? `
        <rect x="${PAD}" y="${maintenanceY}" width="${innerWidth}" height="${maintenanceHeight}" rx="22" fill="#FFFFFF" fill-opacity="0.025" stroke="#344258" stroke-opacity="0.65" />
        <text x="${PAD + 24}" y="${maintenanceY + 43}" class="section-title">メンテナンス予定・実施状況</text>
        <text x="${WIDTH - PAD - 24}" y="${maintenanceY + 41}" class="section-subtitle" text-anchor="end">${visibleMaintenances.length} 件</text>
        ${maintenanceRows}
    ` : ''}

    <line x1="${PAD}" y1="${footerY}" x2="${WIDTH - PAD}" y2="${footerY}" stroke="url(#rule)" />
    <text x="${PAD}" y="${footerY + 42}" class="footer">情報提供：Discord 公式ステータスページ</text>
    <text x="${WIDTH - PAD}" y="${footerY + 42}" class="footer" text-anchor="end">最終更新：${updateLabel}</text>
    <text x="${PAD}" y="${footerY + 72}" class="footer">この画像は監視Botが定期取得した公式情報を表示しています</text>
    </svg>`;

    return sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
}

export function getDiscordStatusImageInfo(summary) {
    return {
        indicator: getIndicator(summary.status?.indicator || 'unknown'),
        componentCount: (summary.components || []).filter(component => !component.group).length,
    };
}

export const DISCORD_STATUS_IMAGE_NAME = 'discord-status-board.png';
export const DISCORD_STATUS_IMPACT_LABELS = IMPACT_LABELS;
