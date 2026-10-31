// ==============================================
// utils/dataFiles.js
// data/ ディレクトリ内のJSONファイルを安全に
// 読み書きするための共通ユーティリティ。
// 管理者ダッシュボードのエクスポート/インポート機能で使用する。
// ==============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_DIR   = path.join(__dirname, '..', 'data');

// ダッシュボードから読み書きを許可するファイルのみをホワイトリスト化
// (パストラバーサル対策 & 誤って別ファイルを壊さないため)
export const ALLOWED_FILES = [
    'dm_preferences.json',
    'dm_prompted.json',
    'recruitments.json',
    'ban_data.json',
    'study_roles.json',
    'guild_config.json',
    'user_statuses.json',
    'status_panel.json'
];

function assertAllowed(name) {
    if (!ALLOWED_FILES.includes(name)) {
        throw new Error(`許可されていないファイルです: ${name}`);
    }
}

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// ==============================================
// ファイル内容を文字列(JSON)として取得
// ==============================================
export function readDataFile(name) {
    assertAllowed(name);
    ensureDataDir();
    const filePath = path.join(DATA_DIR, name);
    if (!fs.existsSync(filePath)) return '{}';
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw.trim() ? raw : '{}';
}

// ==============================================
// ファイルの状態(存在有無・サイズ・更新日時)を取得
// ==============================================
export function getDataFileStats(name) {
    assertAllowed(name);
    ensureDataDir();
    const filePath = path.join(DATA_DIR, name);
    if (!fs.existsSync(filePath)) {
        return { exists: false, size: 0, modifiedAt: null };
    }
    const stat = fs.statSync(filePath);
    return { exists: true, size: stat.size, modifiedAt: stat.mtime.toISOString() };
}

// ==============================================
// JSON文字列を検証したうえでファイルへ書き込む。
// 上書き前に既存ファイルを data/.backups/ にバックアップする。
// ==============================================
export function writeDataFile(name, rawContent) {
    assertAllowed(name);

    let parsed;
    try {
        parsed = JSON.parse(rawContent);
    } catch (err) {
        throw new Error(`不正なJSON形式です: ${err.message}`);
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('JSONのトップレベルはオブジェクト( { ... } )である必要があります。');
    }

    ensureDataDir();
    const filePath = path.join(DATA_DIR, name);

    // 既存ファイルをバックアップ (復元できるように)
    if (fs.existsSync(filePath)) {
        const backupDir = path.join(DATA_DIR, '.backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupPath = path.join(backupDir, `${Date.now()}-${name}`);
        try {
            fs.copyFileSync(filePath, backupPath);
        } catch (err) {
            console.warn('[WARNING] インポート前のバックアップ作成に失敗:', err.message);
        }
    }

    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
    return parsed;
}
