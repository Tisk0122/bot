// ==============================================
// utils/recruitStore.js
// 募集(募集メッセージ)データと、各メンバーの
// 「募集DM通知」受け取り設定を管理する
// ==============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR      = path.join(__dirname, '..', 'data');
const PREF_FILE      = path.join(DATA_DIR, 'dm_preferences.json');
const RECRUIT_FILE   = path.join(DATA_DIR, 'recruitments.json');

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
// 値: 'in' (受け取る) | 'out' (受け取らない) | 未設定
// 構造: { [guildId]: { [userId]: 'in' | 'out' } }
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
}

export function getAllPreferences(guildId) {
    const data = loadJson(PREF_FILE);
    return data?.[guildId] || {};
}

// ==============================================
// 募集データ
// 構造: {
//   [recruitId]: {
//     id, guildId, channelId, messageId, hostId,
//     game, description, datetime, capacity,
//     createdAt, responses: { [userId]: 'join'|'decline'|'unsure' },
//     dmMessages: { [userId]: { channelId, messageId } }
//   }
// }
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
