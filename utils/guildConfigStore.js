// ==============================================
// utils/guildConfigStore.js
// サーバー単位の運用設定。環境変数は初期値として利用し、
// ダッシュボードから変更した設定は data/guild_config.json に永続化する。
// ==============================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'guild_config.json');

const DEFAULTS = {
    verificationChannelId: process.env.VERIFICATION_CHANNEL_ID || '',
    moderationChannelId: process.env.MODERATION_CHANNEL_ID || '',
    banChannelId: process.env.BAN_CHANNEL_ID || '',
    verifiedRoleId: process.env.VERIFIED_ROLE_ID || '',
    studyVoiceChannelId: process.env.STUDY_VC_ID || '1505121212182036591',
    studyLogChannelId: process.env.STUDY_LOG_CHANNEL_ID || '1472968673558790377',
    studyRoleName: process.env.STUDY_ROLE_NAME || '勉強中',
    afkChannelId: process.env.AFK_CHANNEL_ID || '',
    afkTimeoutMinutes: Math.min(240, Math.max(1, Number.parseInt(process.env.AFK_TIMEOUT_MINUTES, 10) || 30)),
    logChannelId: process.env.LOG_CHANNEL_ID || '',
    adminRoleId: process.env.ADMIN_ROLE_ID || ''
};

function ensureDir() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadAll() {
    ensureDir();
    try {
        if (!fs.existsSync(STORE_FILE)) return {};
        const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8') || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.error('[GuildConfig] 設定の読み込みに失敗:', error.message);
        return {};
    }
}

function saveAll(data) {
    ensureDir();
    const temp = `${STORE_FILE}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(temp, STORE_FILE);
}

export function getGuildConfig(guildId) {
    if (!guildId) return { ...DEFAULTS };
    const all = loadAll();
    return { ...DEFAULTS, ...(all[guildId] || {}) };
}

export function updateGuildConfig(guildId, patch) {
    if (!guildId) throw new Error('guildId が必要です。');
    const allowed = Object.keys(DEFAULTS);
    const cleanPatch = {};
    for (const key of allowed) {
        if (Object.hasOwn(patch, key)) cleanPatch[key] = patch[key];
    }
    const all = loadAll();
    all[guildId] = { ...(all[guildId] || {}), ...cleanPatch, updatedAt: Date.now() };
    saveAll(all);
    return getGuildConfig(guildId);
}

export function getGuildConfigDefaults() {
    return { ...DEFAULTS };
}
