// ==============================================
// utils/studyRoleStore.js
// 勉強ロール付与状況（対象ユーザー・科目）を管理する
// ==============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DATA_DIR   = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'study_roles.json');

// ==============================================
// JSON読み書き
// ==============================================
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function load() {
    try {
        ensureDataDir();
        if (fs.existsSync(STORE_FILE)) {
            const raw = fs.readFileSync(STORE_FILE, 'utf8');
            return raw.trim() ? JSON.parse(raw) : {};
        }
    } catch (err) {
        console.error('[StudyRoleStore] 読み込み失敗:', err);
    }
    return {};
}

function save(data) {
    try {
        ensureDataDir();
        fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('[StudyRoleStore] 保存失敗:', err);
    }
}

// ==============================================
// ユーザーの勉強情報を設定する
// ==============================================
export function setStudyRecord(guildId, userId, { subject, assignedBy, roleId = null }) {
    const data = load();
    if (!data[guildId]) data[guildId] = {};
    data[guildId][userId] = {
        subject,
        assignedBy,
        assignedAt: Date.now(),
        ...(roleId ? { roleId } : {})
    };
    save(data);
}

// ==============================================
// ユーザーの勉強情報を取得する
// ==============================================
export function getStudyRecord(guildId, userId) {
    const data = load();
    return data?.[guildId]?.[userId] ?? null;
}

// ==============================================
// ユーザーの勉強情報を削除する
// ==============================================
export function deleteStudyRecord(guildId, userId) {
    const data = load();
    if (!data?.[guildId]?.[userId]) return false;
    delete data[guildId][userId];
    save(data);
    return true;
}

// ==============================================
// サーバー内の全勉強ロール保持者を返す
// ==============================================
export function getAllStudyRecords(guildId) {
    const data = load();
    return data?.[guildId] ?? {};
}
