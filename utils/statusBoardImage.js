import sharp from 'sharp';

// ============================================================
// デザイントークン
// ============================================================
const WIDTH       = 1200;
const PAD         = 48;
const COL_GAP     = 20;
const COL_W       = (WIDTH - PAD * 2 - COL_GAP) / 2;
const HEADER_H    = 196;
const CARD_GAP    = 20;
const CARD_HDR_H  = 76;
const ROW_H       = 52;
const MAX_VISIBLE = 12;

// ステータスカラーに対応するグラデーション終端色（1トーン暗め）
const GRADIENT_ENDS = {
    '#5DADE2': '#2E86C1',  // bath
    '#F39C12': '#D68910',  // meal
    '#8E44AD': '#6C3483',  // sleep
    '#9B59B6': '#76448A',  // nap
    '#27AE60': '#1E8449',  // out
    '#E67E22': '#CA6F1E',  // away
    '#95A5A6': '#717D7E',  // afk
};

function gradEnd(color) {
    return GRADIENT_ENDS[color] ?? color;
}

function escapeXml(v) {
    return String(v).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])
    );
}

function truncate(v, max = 18) {
    const chars = Array.from(String(v));
    return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : String(v);
}

// イニシャルアバター
function renderAvatar(cx, cy, r, name, color) {
    const initial = escapeXml(Array.from(String(name))[0] ?? '?');
    return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="0.20" />
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.45" />
    <text x="${cx}" y="${cy + 6}" font-size="${r * 1.1}" fill="${color}" text-anchor="middle" font-weight="800" font-family="Noto Sans CJK JP,Noto Sans JP,Yu Gothic,sans-serif">${initial}</text>`;
}

// メンバー 1行
function renderMember(member, idx, cardX, cardY, color) {
    const rowY    = cardY + CARD_HDR_H + idx * ROW_H;
    const name    = escapeXml(truncate(member.displayName));
    const elapsed = escapeXml(member.elapsed);
    const avatarCX = cardX + 40;
    const avatarCY = rowY + ROW_H / 2;

    const stripeBg = idx % 2 === 0
        ? `<rect x="${cardX + 4}" y="${rowY}" width="${COL_W - 8}" height="${ROW_H}" fill="#ffffff" fill-opacity="0.022" />`
        : '';

    return `${stripeBg}
    ${renderAvatar(avatarCX, avatarCY, 16, member.displayName, color)}
    <text x="${cardX + 64}" y="${avatarCY + 6}" class="member-name">${name}</text>
    <rect x="${cardX + COL_W - 110}" y="${avatarCY - 12}" width="84" height="24" rx="12" fill="${color}" fill-opacity="0.14" />
    <text x="${cardX + COL_W - 68}" y="${avatarCY + 5}" class="elapsed" text-anchor="middle" fill="${color}">${elapsed}</text>`;
}

// カード全体
function renderCard(cardX, cardY, cardH, group, gradId) {
    const color    = group.color;
    const colorEnd = gradEnd(color);
    const label    = escapeXml(group.label);
    const count    = `${group.members.length}人`;

    const visible   = group.members.slice(0, MAX_VISIBLE);
    const remaining = group.members.length - visible.length;

    const membersMarkup = visible
        .map((m, i) => renderMember(m, i, cardX, cardY, color))
        .join('');

    const moreMarkup = remaining > 0
        ? `<text x="${cardX + 64}" y="${cardY + CARD_HDR_H + visible.length * ROW_H + 28}" class="more">他 ${remaining} 人...</text>`
        : '';

    return `
    <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="${color}" />
            <stop offset="1" stop-color="${colorEnd}" />
        </linearGradient>
        <linearGradient id="${gradId}BG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${color}" stop-opacity="0.08" />
            <stop offset="1" stop-color="${color}" stop-opacity="0.02" />
        </linearGradient>
        <clipPath id="clip${gradId}">
            <rect x="${cardX}" y="${cardY}" width="${COL_W}" height="${cardH}" rx="20" />
        </clipPath>
    </defs>
    <rect x="${cardX}" y="${cardY}" width="${COL_W}" height="${cardH}" rx="20" fill="url(#${gradId}BG)" stroke="${color}" stroke-width="1" stroke-opacity="0.22" />
    <rect x="${cardX}" y="${cardY}" width="${COL_W}" height="${CARD_HDR_H}" fill="url(#${gradId})" fill-opacity="0.10" clip-path="url(#clip${gradId})" />
    <rect x="${cardX}" y="${cardY}" width="4" height="${CARD_HDR_H}" fill="url(#${gradId})" clip-path="url(#clip${gradId})" />
    <text x="${cardX + 22}" y="${cardY + CARD_HDR_H / 2 + 8}" class="category" fill="${color}">${label}</text>
    <rect x="${cardX + COL_W - 74}" y="${cardY + (CARD_HDR_H - 30) / 2}" width="54" height="30" rx="15" fill="${color}" fill-opacity="0.18" />
    <text x="${cardX + COL_W - 47}" y="${cardY + CARD_HDR_H / 2 + 6}" class="count" text-anchor="middle" fill="${color}">${count}</text>
    ${membersMarkup}
    ${moreMarkup}`;
}

// ============================================================
// メイン export
// ============================================================
export async function buildStatusBoardImage(groups, totalActive, updatedAt = Date.now()) {
    // 2列レイアウト
    const rows = [];
    for (let i = 0; i < groups.length; i += 2) rows.push(groups.slice(i, i + 2));

    const rowHeights = rows.map(row =>
        Math.max(...row.map(({ members }) =>
            CARD_HDR_H
            + Math.min(members.length, MAX_VISIBLE) * ROW_H
            + (members.length > MAX_VISIBLE ? 44 : 16)
        ))
    );

    const totalCardsH = rowHeights.reduce((s, h) => s + h, 0)
        + Math.max(0, rows.length - 1) * CARD_GAP;

    const height = totalActive === 0
        ? HEADER_H + PAD + 220 + PAD
        : HEADER_H + PAD + totalCardsH + PAD;

    // カード SVG
    let cards = '';
    let cardY = HEADER_H + PAD;
    for (const [ri, row] of rows.entries()) {
        for (const [ci, group] of row.entries()) {
            const cardX  = PAD + ci * (COL_W + COL_GAP);
            const cardH  = rowHeights[ri];
            const gradId = `g_${ri}_${ci}`;
            cards += renderCard(cardX, cardY, cardH, group, gradId);
        }
        cardY += rowHeights[ri] + CARD_GAP;
    }

    // サマリーバッジ（ヘッダー下部）
    const summaryBadges = groups.slice(0, 7).map((g, i) => {
        const x = PAD + i * 152;
        const col = g.color;
        return `
    <rect x="${x}" y="152" width="142" height="28" rx="14" fill="${col}" fill-opacity="0.13" />
    <circle cx="${x + 16}" cy="166" r="4" fill="${col}" />
    <text x="${x + 28}" y="171" class="badge-label" fill="${col}">${escapeXml(g.label)} ${g.members.length}人</text>`;
    }).join('');

    // 更新日時
    const updatedLabel = escapeXml(new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short'
    }).format(updatedAt));

    // 空状態
    const emptyState = `
    <rect x="${PAD}" y="${HEADER_H + PAD}" width="${WIDTH - PAD * 2}" height="220" rx="24" fill="#131a2e" stroke="#273149" stroke-opacity="0.5" />
    <circle cx="${WIDTH / 2}" cy="${HEADER_H + PAD + 82}" r="34" fill="#1e293f" />
    <circle cx="${WIDTH / 2}" cy="${HEADER_H + PAD + 82}" r="14" fill="#364259" />
    <circle cx="${WIDTH / 2}" cy="${HEADER_H + PAD + 82}" r="5" fill="#818cf8" />
    <text x="${WIDTH / 2}" y="${HEADER_H + PAD + 145}" class="empty-title" text-anchor="middle">まだ誰もステータスを設定していません</text>
    <text x="${WIDTH / 2}" y="${HEADER_H + PAD + 178}" class="empty-sub" text-anchor="middle">下のパネルから今の状況をシェアしよう ✨</text>`;

    // デコパーティクル
    const particles = [
        [940, 48, 130, '#818cf8', 0.055],
        [1110, 155, 85, '#38bdf8', 0.045],
        [1060, 18, 55, '#818cf8', 0.04],
        [820, 148, 38, '#38bdf8', 0.065],
        [980, 95, 22, '#c084fc', 0.08],
    ].map(([cx, cy, r, fill, op]) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="${op}" />`
    ).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
<defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0"   stop-color="#07101e" />
        <stop offset="0.5" stop-color="#0c1524" />
        <stop offset="1"   stop-color="#101e30" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#818cf8" />
        <stop offset="0.5" stop-color="#60a5fa" />
        <stop offset="1"   stop-color="#38bdf8" />
    </linearGradient>
    <linearGradient id="dividerGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#273149" stop-opacity="0" />
        <stop offset="0.5" stop-color="#273149" stop-opacity="1" />
        <stop offset="1"   stop-color="#273149" stop-opacity="0" />
    </linearGradient>
    <filter id="accentGlow" x="-30%" y="-100%" width="160%" height="400%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <style>
        text { font-family: "Noto Sans CJK JP","Noto Sans JP","Yu Gothic","Hiragino Sans",sans-serif; }
        .eyebrow     { fill: #465266; font-size: 12px; font-weight: 700; letter-spacing: 5px; }
        .main-title  { fill: #e6eeff; font-size: 46px; font-weight: 900; letter-spacing: -2px; }
        .sub-line    { fill: #8090aa; font-size: 15px; }
        .badge-label { font-size: 13px; font-weight: 700; }
        .updated     { fill: #465266; font-size: 13px; }
        .live-text   { fill: #7a8aa8; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
        .category    { font-size: 21px; font-weight: 800; }
        .count       { font-size: 13px; font-weight: 700; }
        .member-name { fill: #c8d4ec; font-size: 16px; }
        .elapsed     { font-size: 13px; font-weight: 600; }
        .more        { fill: #465266; font-size: 14px; }
        .empty-title { fill: #c8d4ec; font-size: 20px; font-weight: 700; }
        .empty-sub   { fill: #465266; font-size: 15px; }
    </style>
</defs>

<!-- 背景 -->
<rect width="${WIDTH}" height="${height}" fill="url(#bgGrad)" />

<!-- デコパーティクル -->
${particles}

<!-- アクセントバー（グロー付き） -->
<rect x="${PAD}" y="0" width="220" height="4" rx="2" fill="url(#accentGrad)" filter="url(#accentGlow)" />

<!-- ヘッダー文字 -->
<text x="${PAD}" y="52" class="eyebrow">LIVE  ·  STATUS  ·  BOARD</text>
<text x="${PAD}" y="114" class="main-title">みんなの今</text>
<text x="${PAD}" y="142" class="sub-line">${totalActive === 0 ? 'メンバーの状況をリアルタイムで共有できます' : `現在 ${totalActive} 人がステータスを設定中`}</text>

${totalActive > 0 ? summaryBadges : ''}

<!-- 更新情報 -->
<rect x="${WIDTH - PAD - 144}" y="24" width="126" height="34" rx="17" fill="#111929" stroke="#273149" />
<circle cx="${WIDTH - PAD - 124}" cy="41" r="4.5" fill="#34d399" />
<text x="${WIDTH - PAD - 112}" y="46" class="live-text">LIVE</text>
<text x="${WIDTH - PAD}" y="74" class="updated" text-anchor="end">更新 ${updatedLabel}</text>

<!-- 区切り線 -->
<rect x="0" y="${HEADER_H - 1}" width="${WIDTH}" height="1" fill="url(#dividerGrad)" />

${totalActive === 0 ? emptyState : cards}
</svg>`;

    return sharp(Buffer.from(svg))
        .png({ compressionLevel: 8 })
        .toBuffer();
}