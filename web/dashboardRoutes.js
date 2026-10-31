// ==============================================
// web/dashboardRoutes.js
// 管理者ダッシュボード (/admin) のルーティング
// ==============================================

import express from 'express';
import { createDashboardAuth } from '../utils/dashboardAuth.js';
import { getAllPreferences, getAllRecruitments, closeRecruitment, deleteRecruitment } from '../utils/recruitStore.js';
import { getAllStudyRecords, deleteStudyRecord } from '../utils/studyRoleStore.js';
import { readDataFile, writeDataFile, getDataFileStats, ALLOWED_FILES } from '../utils/dataFiles.js';
import { DASHBOARD_HTML } from './dashboardHtml.js';

export function mountDashboard(app, client) {
    const guildId = process.env.GUILD_ID;
    const auth = createDashboardAuth();

    const router = express.Router();
    router.use(auth);

    // ------------------------------------------
    // ダッシュボード本体 (HTML)
    // ------------------------------------------
    router.get('/', (_req, res) => {
        res.status(200).type('html').send(DASHBOARD_HTML);
    });

    // ------------------------------------------
    // Bot / サーバーのステータス
    // ------------------------------------------
    router.get('/api/status', (_req, res) => {
        try {
            const guild = guildId ? client.guilds.cache.get(guildId) : null;
            res.json({
                ready: client.isReady(),
                botTag: client.user?.tag || null,
                guildId: guildId || null,
                guildName: guild?.name || null,
                memberCount: guild?.memberCount ?? null,
                uptimeSeconds: Math.floor(process.uptime())
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 募集DM通知の設定状況
    // ------------------------------------------
    router.get('/api/preferences', async (_req, res) => {
        try {
            if (!guildId) return res.status(400).json({ error: 'GUILD_ID が設定されていません。' });
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(404).json({ error: 'ギルドが見つかりません。' });

            // ダッシュボードの表示のたびに guild.members.fetch() を呼ぶと、
            // Gateway Opcode 8 (Request Guild Members) が発生して制限される。
            // 表示はキャッシュと保存済み設定だけで構築し、ネットワーク取得を行わない。
            const cachedMembers = guild.members.cache;
            const prefs = getAllPreferences(guildId);
            const memberIds = new Set([
                ...cachedMembers.keys(),
                ...Object.keys(prefs)
            ]);

            const list = [];
            for (const userId of memberIds) {
                const member = cachedMembers.get(userId) ?? null;
                const user = member?.user ?? client.users.cache.get(userId) ?? null;
                if (user?.bot) continue;

                list.push({
                    userId,
                    tag: user?.tag ?? `ID: ${userId}`,
                    displayName: member?.displayName ?? user?.globalName ?? user?.username ?? 'メンバー情報未取得',
                    avatarUrl: user?.displayAvatarURL?.({ size: 64 }) ?? null,
                    preference: prefs[userId] || 'unset',
                    memberCached: Boolean(member)
                });
            }

            list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

            res.json({
                total: list.length,
                members: list,
                guildMemberCount: guild.memberCount ?? null,
                cachedMemberCount: cachedMembers.size,
                cacheOnly: true
            });
        } catch (err) {
            console.error('[ERROR] /admin/api/preferences:', err);
            const retryAfter = Number(err?.data?.retry_after ?? err?.retryAfter);
            if (err?.name === 'GatewayRateLimitError' || Number.isFinite(retryAfter) && retryAfter > 0) {
                if (Number.isFinite(retryAfter) && retryAfter > 0) {
                    res.set('Retry-After', String(Math.ceil(retryAfter)));
                }
                return res.status(429).json({ error: 'Discordへの要求が一時的に制限されています。少し待ってから再試行してください。' });
            }
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 通知設定の削除（リセット）
    // ------------------------------------------
    router.delete('/api/preferences/:userId', async (req, res) => {
        try {
            if (!guildId) return res.status(400).json({ error: 'GUILD_ID が設定されていません。' });
            const { readDataFile: _, writeDataFile: wdf } = await import('../utils/dataFiles.js');
            const raw = readDataFile('dm_preferences.json');
            const data = JSON.parse(raw);
            if (data[guildId] && data[guildId][req.params.userId]) {
                delete data[guildId][req.params.userId];
                writeDataFile('dm_preferences.json', JSON.stringify(data));
                return res.json({ success: true });
            }
            res.json({ success: false, message: '該当ユーザーの設定が見つかりません。' });
        } catch (err) {
            console.error('[ERROR] DELETE /admin/api/preferences:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 募集一覧 (集計付き)
    // ------------------------------------------
    router.get('/api/recruitments', (_req, res) => {
        try {
            const all = getAllRecruitments(guildId);
            const list = Object.values(all)
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                .map(r => {
                    const responses = r.responses || {};
                    const counts = { join: 0, decline: 0, unsure: 0 };
                    for (const v of Object.values(responses)) {
                        if (counts[v] !== undefined) counts[v]++;
                    }
                    return {
                        id: r.id,
                        game: r.game,
                        description: r.description,
                        datetime: r.datetime,
                        capacity: r.capacity,
                        hostId: r.hostId,
                        channelId: r.channelId,
                        messageId: r.messageId,
                        createdAt: r.createdAt,
                        expiresAt: r.expiresAt,
                        counts
                    };
                });
            res.json({ total: list.length, recruitments: list });
        } catch (err) {
            console.error('[ERROR] /admin/api/recruitments:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 募集を強制終了（クローズ）
    // ------------------------------------------
    router.post('/api/recruitments/:id/close', async (req, res) => {
        try {
            const result = await closeRecruitment(req.params.id, client, 'ダッシュボードから手動終了');
            if (!result) return res.status(404).json({ error: '該当する募集が見つかりません。' });
            res.json({ success: true });
        } catch (err) {
            console.error('[ERROR] POST /admin/api/recruitments/:id/close:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 募集を削除（データのみ、メッセージ更新なし）
    // ------------------------------------------
    router.delete('/api/recruitments/:id', (req, res) => {
        try {
            const result = deleteRecruitment(req.params.id);
            if (!result) return res.status(404).json({ error: '該当する募集が見つかりません。' });
            res.json({ success: true });
        } catch (err) {
            console.error('[ERROR] DELETE /admin/api/recruitments/:id:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 勉強ロール保持者一覧
    // ------------------------------------------
    router.get('/api/study-roles', async (_req, res) => {
        try {
            if (!guildId) return res.status(400).json({ error: 'GUILD_ID が設定されていません。' });
            const guild = client.guilds.cache.get(guildId);

            const records = getAllStudyRecords(guildId);
            const list = [];

            for (const [userId, record] of Object.entries(records)) {
                let tag = userId;
                let displayName = userId;
                let avatarUrl = null;
                try {
                    if (guild) {
                        // API取得は行わず、キャッシュ済みメンバー/ユーザーのみ参照。
                        const member = guild.members.cache.get(userId) ?? null;
                        const user = member?.user ?? client.users.cache.get(userId) ?? null;
                        if (member || user) {
                            tag = user?.tag ?? userId;
                            displayName = member?.displayName ?? user?.globalName ?? user?.username ?? userId;
                            avatarUrl = user?.displayAvatarURL?.({ size: 64 }) ?? null;
                        }
                    }
                } catch { /* 退鯖済みユーザーは無視 */ }
                list.push({ userId, tag, displayName, avatarUrl, ...record });
            }

            list.sort((a, b) => (b.assignedAt || 0) - (a.assignedAt || 0));
            res.json({ total: list.length, records: list });
        } catch (err) {
            console.error('[ERROR] /admin/api/study-roles:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 勉強ロール記録を削除
    // ------------------------------------------
    router.delete('/api/study-roles/:userId', (req, res) => {
        try {
            if (!guildId) return res.status(400).json({ error: 'GUILD_ID が設定されていません。' });
            const result = deleteStudyRecord(guildId, req.params.userId);
            if (!result) return res.status(404).json({ error: '該当するレコードが見つかりません。' });
            res.json({ success: true });
        } catch (err) {
            console.error('[ERROR] DELETE /admin/api/study-roles/:userId:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // データファイル一覧 (メタ情報)
    // ------------------------------------------
    router.get('/api/files', (_req, res) => {
        try {
            const files = ALLOWED_FILES.map(name => ({ name, ...getDataFileStats(name) }));
            res.json({ files });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // データファイルのエクスポート
    // ------------------------------------------
    router.get('/api/export/:file', (req, res) => {
        try {
            const content = readDataFile(req.params.file);
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.file}"`);
            res.type('application/json').send(content);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // データファイルのインポート
    // ------------------------------------------
    router.post('/api/import/:file', express.text({ type: '*/*', limit: '2mb' }), (req, res) => {
        try {
            const saved = writeDataFile(req.params.file, req.body || '');
            console.log(`[INFO] ダッシュボードからデータをインポートしました: ${req.params.file}`);
            res.json({ success: true, keys: Object.keys(saved).length });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.use('/admin', router);
    console.log('[INFO] 管理者ダッシュボードをマウントしました: /admin');
}
