// ==============================================
// web/dashboardRoutes.js
// 管理者ダッシュボード (/admin) のルーティングを
// 既存のExpressアプリにマウントする
// ==============================================

import express from 'express';
import { createDashboardAuth } from '../utils/dashboardAuth.js';
import { getAllPreferences, getAllRecruitments } from '../utils/recruitStore.js';
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
            if (!guild) return res.status(404).json({ error: 'ギルドが見つかりません（Botがまだ準備できていない可能性があります）。' });

            const members = await guild.members.fetch();
            const prefs = getAllPreferences(guildId);

            const list = [...members.values()]
                .filter(m => !m.user.bot)
                .map(m => ({
                    userId: m.id,
                    tag: m.user.tag,
                    displayName: m.displayName,
                    avatarUrl: m.user.displayAvatarURL({ size: 64 }),
                    preference: prefs[m.id] || 'unset'
                }))
                .sort((a, b) => a.tag.localeCompare(b.tag));

            res.json({ total: list.length, members: list });
        } catch (err) {
            console.error('[ERROR] /admin/api/preferences:', err);
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
    // データファイルのエクスポート (ダウンロード/コピー用)
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
    // データファイルのインポート (プロジェクト更新時の引き継ぎ用)
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
    console.log('[INFO] 管理者ダッシュボードをマウントしました: /admin (要 DASHBOARD_PASSWORD 環境変数)');
}
