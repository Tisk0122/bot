// ==============================================
// web/dashboardRoutes.js
// 管理者ダッシュボード (/admin) のルーティング
// ==============================================

import express from 'express';
import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import { createDashboardAuth } from '../utils/dashboardAuth.js';
import { getAllPreferences, getAllRecruitments, closeRecruitment, deleteRecruitment, getAllDmPrompts, markDmPrompted, clearDmPrompted, setDmPreference, createRecruitment } from '../utils/recruitStore.js';
import { getAllStudyRecords, getStudyRecord, deleteStudyRecord, setStudyRecord } from '../utils/studyRoleStore.js';
import { buildRecruitEmbed, buildRecruitButtons, buildRecruitCloseButton } from '../utils/recruitEmbed.js';
import { getGuildConfig, updateGuildConfig } from '../utils/guildConfigStore.js';
import { applyStudyVcPermissions, enforceCurrentStudyMembers, getStudyVcStatus } from '../handlers/studyVcHandler.js';
import { logAction } from '../utils/logger.js';
import { refreshBanListMessage } from '../handlers/banHandler.js';
import { sendPreferenceSetupDm } from '../commands/recruit-notify-init.js';
import { readDataFile, writeDataFile, getDataFileStats, ALLOWED_FILES } from '../utils/dataFiles.js';
import { DASHBOARD_HTML } from './dashboardHtml.js';

export function mountDashboard(app, client) {
    const guildId = process.env.GUILD_ID;
    const auth = createDashboardAuth();

    const router = express.Router();
    router.use(auth);
    // Mutating requests are accepted only from this dashboard's own origin.
    router.use((req, res, next) => {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !req.headers.origin) return next();
        try {
            if (new URL(req.headers.origin).host !== req.get('host')) return res.status(403).json({ error: '外部サイトからの操作は許可されていません。' });
        } catch { return res.status(403).json({ error: 'Origin ヘッダーが不正です。' }); }
        next();
    });

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
                uptimeSeconds: Math.floor(process.uptime()),
                studyVc: guild ? getStudyVcStatus(guild.id) : null
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

            // Gateway の全メンバー要求は使わず、Discord REST API をページングして取得する。
            const discordMembers = [];
            let after;
            do {
                const query = new URLSearchParams({ limit: '1000' });
                if (after) query.set('after', after);

                const page = await client.rest.get(Routes.guildMembers(guildId), { query });
                if (!Array.isArray(page)) {
                    throw new Error('Discordからメンバー一覧を正しく取得できませんでした。');
                }
                discordMembers.push(...page);

                const lastUserId = page.at(-1)?.user?.id;
                if (page.length === 1000 && (!lastUserId || lastUserId === after)) {
                    throw new Error('Discordのメンバー一覧をページングできませんでした。');
                }
                after = page.length === 1000 ? lastUserId : null;
            } while (after);

            const cachedMembers = guild.members.cache;
            const prefs = getAllPreferences(guildId);
            const prompted = getAllDmPrompts(guildId);
            const membersById = new Map(discordMembers.map(member => [member.user.id, member]));
            const memberIds = new Set([
                ...membersById.keys(),
                ...Object.keys(prefs),
                ...Object.keys(prompted)
            ]);

            const list = [];
            for (const userId of memberIds) {
                const member = cachedMembers.get(userId) ?? null;
                const discordMember = membersById.get(userId) ?? null;
                const cachedUser = member?.user ?? client.users.cache.get(userId) ?? null;
                const user = discordMember?.user;
                if (user?.bot || (!user && cachedUser?.bot)) continue;

                const isGuildMember = Boolean(discordMember);
                const avatarUrl = discordMember?.avatar
                    ? client.rest.cdn.guildMemberAvatar(guildId, userId, discordMember.avatar, { size: 64 })
                    : user?.avatar
                        ? client.rest.cdn.avatar(userId, user.avatar, { size: 64 })
                        : member?.displayAvatarURL?.({ size: 64 })
                            ?? cachedUser?.displayAvatarURL?.({ size: 64 })
                            ?? null;

                list.push({
                    userId,
                    tag: cachedUser?.tag ?? user?.username ?? `ID: ${userId}`,
                    displayName: discordMember?.nick
                        ?? user?.global_name
                        ?? user?.username
                        ?? member?.displayName
                        ?? cachedUser?.globalName
                        ?? cachedUser?.username
                        ?? (isGuildMember ? 'ユーザー情報なし' : 'サーバー外ユーザー'),
                    avatarUrl,
                    preference: prefs[userId] || 'unset',
                    promptedAt: prompted[userId] || null,
                    isGuildMember
                });
            }

            list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

            res.json({
                total: list.length,
                members: list,
                guildMemberCount: guild.memberCount ?? null,
                fetchedMemberCount: discordMembers.length,
                cachedMemberCount: cachedMembers.size
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
            if (!/^\d{17,20}$/.test(req.params.userId)) return res.status(400).json({ error: 'ユーザーIDの形式が不正です。' });
            const raw = readDataFile('dm_preferences.json');
            const data = JSON.parse(raw);
            if (data[guildId]?.[req.params.userId]) {
                delete data[guildId][req.params.userId];
                if (Object.keys(data[guildId]).length === 0) delete data[guildId];
                writeDataFile('dm_preferences.json', JSON.stringify(data));
            }
            // 通知設定をリセットした場合、初期案内DMも再送可能にする。
            clearDmPrompted(guildId, req.params.userId);
            res.json({ success: true, message: '通知設定を未設定に戻しました。' });
        } catch (err) {
            console.error('[ERROR] DELETE /admin/api/preferences:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // ------------------------------------------
    // 募集DM通知設定を管理者が直接変更
    // ------------------------------------------
    router.put('/api/preferences/:userId', (req, res) => {
        try {
            if (!guildId) return res.status(400).json({ error: 'GUILD_ID が設定されていません。' });
            if (!/^\d{17,20}$/.test(req.params.userId)) return res.status(400).json({ error: 'ユーザーIDの形式が不正です。' });
            const preference = req.body?.preference;
            if (!['in', 'out'].includes(preference)) return res.status(400).json({ error: 'preference は in または out を指定してください。' });
            setDmPreference(guildId, req.params.userId, preference);
            res.json({ success: true, preference });
        } catch (err) {
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

    // ==========================================
    // 統合管理機能: サーバー設定 / チャンネル / ロール
    // ==========================================
    function getTargetGuild(res) {
        if (!guildId) { res.status(400).json({ error: 'GUILD_ID が設定されていません。' }); return null; }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) { res.status(404).json({ error: '対象サーバーがBotのキャッシュにありません。' }); return null; }
        return guild;
    }

    function getTextChannel(guild, channelId) {
        const channel = guild.channels.cache.get(String(channelId || ''));
        return channel && channel.type === ChannelType.GuildText ? channel : null;
    }

    function getVoiceChannel(guild, channelId) {
        const channel = guild.channels.cache.get(String(channelId || ''));
        return channel && channel.type === ChannelType.GuildVoice ? channel : null;
    }

    function botCanSend(channel, res) {
        const botMember = channel.guild.members.me;
        const permissions = botMember ? channel.permissionsFor(botMember) : null;
        const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks];
        if (!permissions?.has(required)) {
            res.status(403).json({ error: `Botに #${channel.name} で「チャンネルを見る」「メッセージを送信」「埋め込みリンク」の権限が必要です。` });
            return false;
        }
        return true;
    }

    function parseEmbedColor(input, fallback = 0x5865f2) {
        const colorMap = { red: 0xed4245, blue: 0x5865f2, green: 0x3ba55c, gold: 0xf1c40f, purple: 0x9b59b6, orange: 0xe67e22, pink: 0xe84393, white: 0xffffff, black: 0x000000, gray: 0x808080, grey: 0x808080 };
        if (!input) return fallback;
        const value = String(input).trim().toLowerCase();
        if (colorMap[value] !== undefined) return colorMap[value];
        const hex = value.replace(/^#/, '');
        return /^[0-9a-f]{6}$/i.test(hex) ? Number.parseInt(hex, 16) : fallback;
    }

    function validOptionalUrl(value, fieldName, res) {
        if (!value) return null;
        try {
            const url = new URL(String(value));
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
            return url.toString();
        } catch {
            res.status(400).json({ error: `${fieldName} は http:// または https:// から始まるURLを指定してください。` });
            return undefined;
        }
    }

    router.get('/api/config', (_req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        const config = getGuildConfig(guild.id);
        const channels = [...guild.channels.cache.values()]
            .filter(channel => [ChannelType.GuildText, ChannelType.GuildVoice].includes(channel.type))
            .map(channel => ({ id: channel.id, name: channel.name, type: channel.type === ChannelType.GuildVoice ? 'voice' : 'text', parentName: channel.parent?.name || null }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        const roles = [...guild.roles.cache.values()]
            .filter(role => role.id !== guild.id && !role.managed)
            .map(role => ({ id: role.id, name: role.name, color: role.hexColor, position: role.position }))
            .sort((a, b) => b.position - a.position);
        res.json({ guild: { id: guild.id, name: guild.name }, config, channels, roles, studyVc: getStudyVcStatus(guild.id) });
    });

    router.put('/api/config', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const body = req.body || {};
            const allowed = ['verificationChannelId', 'moderationChannelId', 'banChannelId', 'verifiedRoleId', 'studyVoiceChannelId', 'studyLogChannelId', 'studyRoleName', 'logChannelId', 'adminRoleId'];
            const patch = {};
            for (const key of allowed) if (Object.hasOwn(body, key)) patch[key] = body[key];

            const textKeys = ['verificationChannelId', 'moderationChannelId', 'banChannelId', 'studyLogChannelId', 'logChannelId'];
            for (const key of textKeys) {
                if (!Object.hasOwn(patch, key)) continue;
                const id = String(patch[key] ?? '');
                if (id && !getTextChannel(guild, id)) return res.status(400).json({ error: `${key} に指定されたチャンネルが存在しないか、テキストチャンネルではありません。` });
                patch[key] = id;
            }
            if (Object.hasOwn(patch, 'studyVoiceChannelId')) {
                const id = String(patch.studyVoiceChannelId ?? '');
                if (!id || !getVoiceChannel(guild, id)) return res.status(400).json({ error: '勉強VCには有効なボイスチャンネルを指定してください。' });
                patch.studyVoiceChannelId = id;
            }
            if (Object.hasOwn(patch, 'studyRoleName')) {
                patch.studyRoleName = String(patch.studyRoleName || '').trim();
                if (!patch.studyRoleName || patch.studyRoleName.length > 80) return res.status(400).json({ error: '勉強ロール名は1〜80文字で指定してください。' });
            }
            for (const key of ['adminRoleId', 'verifiedRoleId']) {
                if (!Object.hasOwn(patch, key)) continue;
                patch[key] = String(patch[key] || '');
                if (patch[key] && !guild.roles.cache.has(patch[key])) return res.status(400).json({ error: `${key} に指定されたロールが見つかりません。` });
            }
            const currentConfig = getGuildConfig(guild.id);
            const nextConfig = { ...currentConfig, ...patch };
            const studySettingsChanged =
                (Object.hasOwn(patch, 'studyVoiceChannelId') && patch.studyVoiceChannelId !== currentConfig.studyVoiceChannelId) ||
                (Object.hasOwn(patch, 'studyRoleName') && patch.studyRoleName !== currentConfig.studyRoleName);
            const banChannelChanged = Object.hasOwn(patch, 'banChannelId') && patch.banChannelId !== currentConfig.banChannelId;
            let studyVcResult = null;
            if (studySettingsChanged) {
                studyVcResult = await applyStudyVcPermissions(guild, nextConfig);
                await enforceCurrentStudyMembers(guild, nextConfig);
            }
            const saved = updateGuildConfig(guild.id, patch);
            if (banChannelChanged && patch.banChannelId) {
                await refreshBanListMessage(client, guild, true);
            }
            console.log(`[Dashboard] サーバー設定を更新: ${guild.id} (${Object.keys(patch).join(', ')})`);
            res.json({ success: true, config: saved, studyVc: studyVcResult });
        } catch (err) {
            console.error('[ERROR] PUT /admin/api/config:', err);
            res.status(400).json({ error: err.message || '設定の保存に失敗しました。' });
        }
    });

    // ------------------------------------------
    // 勉強VCのDiscord権限上書きを再適用
    // ------------------------------------------
    router.post('/api/actions/study-vc-sync', async (_req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const config = getGuildConfig(guild.id);
            const result = await applyStudyVcPermissions(guild, config);
            const enforcement = await enforceCurrentStudyMembers(guild, config);
            res.json({
                success: true,
                message: `#${result.channelName} の接続権限を再適用しました。確認 ${enforcement.checked}人 / 入室拒否 ${enforcement.denied}人`,
                studyVc: result,
                enforcement
            });
        } catch (err) {
            console.error('[ERROR] POST /admin/api/actions/study-vc-sync:', err);
            res.status(400).json({ error: err.message || '勉強VC権限の再適用に失敗しました。' });
        }
    });

    // ------------------------------------------
    // 勉強ロール付与・剥奪（/study-role のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/study-role', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const userId = String(req.body?.userId || '').trim();
            const action = req.body?.action;
            const subject = String(req.body?.subject || '').trim();
            if (!/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: 'DiscordユーザーIDの形式が不正です。' });
            if (!['give', 'remove'].includes(action)) return res.status(400).json({ error: '操作は give または remove を指定してください。' });
            if (action === 'give' && (!subject || subject.length > 100)) return res.status(400).json({ error: '科目は1〜100文字で入力してください。' });
            const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
            if (!member) return res.status(404).json({ error: '対象メンバーが見つかりません。' });
            if (member.user.bot) return res.status(400).json({ error: 'Botには勉強ロールを付与できません。' });
            const config = getGuildConfig(guild.id);
            const currentRecord = getStudyRecord(guild.id, userId);
            let role = action === 'remove' && currentRecord?.roleId
                ? guild.roles.cache.get(currentRecord.roleId) ?? null
                : null;
            if (!role) {
                role = guild.roles.cache.find(r => r.name.toLowerCase() === String(config.studyRoleName || '勉強中').toLowerCase()) ?? null;
            }
            if (action === 'give' && !role) {
                if (config.studyVoiceChannelId) {
                    await applyStudyVcPermissions(guild, config);
                    role = guild.roles.cache.find(r => r.name.toLowerCase() === String(config.studyRoleName || '勉強中').toLowerCase()) ?? null;
                }
                if (!role) {
                    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
                        return res.status(403).json({ error: 'Botに「ロールの管理」権限がありません。' });
                    }
                    role = await guild.roles.create({ name: config.studyRoleName || '勉強中', color: 0x27ae60, reason: '管理ダッシュボードから勉強ロールを作成' });
                }
            }
            if (!role) return res.status(404).json({ error: `勉強ロール「${config.studyRoleName}」が見つかりません。先にサーバー設定を保存してください。` });
            const botMember = guild.members.me;
            if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return res.status(403).json({ error: 'Botに「ロールの管理」権限がありません。' });
            if (!botMember || botMember.roles.highest.position <= role.position) return res.status(403).json({ error: 'Botのロールが勉強ロールより下位です。Botのロールを上位に移動してください。' });
            const targetInStudyVc = action === 'remove' && Boolean(config.studyVoiceChannelId) && member.voice?.channelId === config.studyVoiceChannelId;
            if (targetInStudyVc && !botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
                return res.status(403).json({ error: '対象者が勉強VCにいるため、Botに「メンバーを移動」権限が必要です。権限を追加してから再実行してください。' });
            }
            if (action === 'give') {
                if (!member.roles.cache.has(role.id)) await member.roles.add(role, `ダッシュボードから勉強ロール付与 | ${subject}`);
                setStudyRecord(guild.id, userId, { subject, assignedBy: 'dashboard', roleId: role.id });
                res.json({ success: true, message: `${member.displayName} に「${role.name}」を付与しました。`, action });
            } else {
                if (member.roles.cache.has(role.id)) await member.roles.remove(role, 'ダッシュボードから勉強ロール剥奪');
                if (targetInStudyVc) await member.voice.disconnect('おべんきょVC: 勉強ロールを剥奪');
                deleteStudyRecord(guild.id, userId);
                res.json({ success: true, message: `${member.displayName} から「${role.name}」を剥奪しました。${targetInStudyVc ? ' 勉強VCからも退出させました。' : ''}`, action });
            }
        } catch (err) {
            console.error('[ERROR] POST /admin/api/actions/study-role:', err);
            res.status(500).json({ error: err.message || '勉強ロールの操作に失敗しました。' });
        }
    });

    // ------------------------------------------
    // 認証ボード設置（/setup-verify のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/setup-verify', async (_req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const channelId = getGuildConfig(guild.id).verificationChannelId;
            const channel = getTextChannel(guild, channelId);
            if (!channel) return res.status(400).json({ error: '先にサーバー設定で認証チャンネルを指定してください。' });
            if (!botCanSend(channel, res)) return;
            const embed = new EmbedBuilder()
                .setTitle('サーバー認証')
                .setDescription('下のボタンを押してサーバーメンバーとして認証してください。\n\n認証が完了すると、管理者による承認後にサーバーの全チャンネルにアクセスできるようになります。')
                .setColor(0x0099ff)
                .setFooter({ text: `${guild.name} 認証システム` })
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_user_button').setLabel('認証する').setStyle(ButtonStyle.Success));
            const message = await channel.send({ embeds: [embed], components: [row] });
            res.json({ success: true, message: `認証ボードを #${channel.name} に設置しました。`, messageId: message.id });
        } catch (err) {
            res.status(500).json({ error: err.message || '認証ボードの設置に失敗しました。' });
        }
    });

    // ------------------------------------------
    // お知らせ送信（/announce のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/announce', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const title = String(req.body?.title || '').trim();
            const messageText = String(req.body?.message || '').trim();
            const channel = getTextChannel(guild, req.body?.channelId);
            const mentionRoleId = String(req.body?.mentionRoleId || '');
            if (!title || title.length > 256) return res.status(400).json({ error: 'タイトルは1〜256文字で入力してください。' });
            if (!messageText || messageText.length > 4096) return res.status(400).json({ error: '本文は1〜4096文字で入力してください。' });
            if (!channel) return res.status(400).json({ error: '送信先テキストチャンネルを選択してください。' });
            if (mentionRoleId && !guild.roles.cache.has(mentionRoleId)) return res.status(400).json({ error: 'メンション対象ロールが見つかりません。' });
            if (!botCanSend(channel, res)) return;
            const embed = new EmbedBuilder().setTitle(title).setDescription(messageText).setColor(parseEmbedColor(req.body?.color, 0xffc107)).setFooter({ text: `${guild.name} お知らせ` }).setTimestamp();
            await channel.send({ content: mentionRoleId ? `<@&${mentionRoleId}>` : undefined, embeds: [embed], allowedMentions: { parse: [], roles: mentionRoleId ? [mentionRoleId] : [] } });
            res.json({ success: true, message: `#${channel.name} にお知らせを送信しました。` });
        } catch (err) {
            res.status(500).json({ error: err.message || 'お知らせの送信に失敗しました。' });
        }
    });

    // ------------------------------------------
    // カスタムEmbed送信（/embed のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/embed', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const title = String(req.body?.title || '').trim();
            const description = String(req.body?.description || '').trim();
            const channel = getTextChannel(guild, req.body?.channelId);
            if (!title || title.length > 256) return res.status(400).json({ error: 'タイトルは1〜256文字で入力してください。' });
            if (!description || description.length > 4096) return res.status(400).json({ error: '本文は1〜4096文字で入力してください。' });
            if (!channel) return res.status(400).json({ error: '送信先テキストチャンネルを選択してください。' });
            if (!botCanSend(channel, res)) return;
            const image = validOptionalUrl(req.body?.imageUrl, '画像URL', res); if (image === undefined) return;
            const thumbnail = validOptionalUrl(req.body?.thumbnailUrl, 'サムネイルURL', res); if (thumbnail === undefined) return;
            const footer = String(req.body?.footer || '').trim();
            if (footer.length > 2048) return res.status(400).json({ error: 'フッターは2048文字以内で入力してください。' });
            const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(parseEmbedColor(req.body?.color));
            if (footer) embed.setFooter({ text: footer });
            if (image) embed.setImage(image);
            if (thumbnail) embed.setThumbnail(thumbnail);
            embed.setTimestamp();
            await channel.send({ embeds: [embed] });
            res.json({ success: true, message: `#${channel.name} にEmbedを送信しました。` });
        } catch (err) {
            res.status(500).json({ error: err.message || 'Embedの送信に失敗しました。' });
        }
    });

    // ------------------------------------------
    // 募集DM通知の初期案内（/recruit-notify-init のダッシュボード版）
    // Gateway Opcode 8を避け、キャッシュ済みメンバーを最大50人ずつ処理する。
    // ------------------------------------------
    router.post('/api/actions/recruit-notify-init', async (_req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const members = [...guild.members.cache.values()];
            const preferences = getAllPreferences(guild.id);
            const prompted = getAllDmPrompts(guild.id);
            const candidates = members.filter(member => !member.user.bot && !preferences[member.id] && !prompted[member.id]);
            const batch = candidates.slice(0, 50);
            let sent = 0;
            let failed = 0;
            for (const member of batch) {
                const ok = await sendPreferenceSetupDm(member, guild);
                if (ok) { sent++; markDmPrompted(guild.id, member.id); }
                else failed++;
                await new Promise(resolve => setTimeout(resolve, 350));
            }
            // 失敗分は未送信のまま残し、次回実行で再試行できるようにする。
            const remaining = Math.max(0, candidates.length - batch.length) + failed;
            const uncached = Math.max(0, (guild.memberCount ?? members.length) - members.length);
            res.json({
                success: true,
                sent,
                failed,
                processed: batch.length,
                remaining,
                uncached,
                message: `初期案内を${sent}人に送信しました。失敗: ${failed}人。${remaining ? `キャッシュ内の未処理が${remaining}人います。もう一度実行してください。` : 'キャッシュ内の未設定メンバーへの案内は完了しました。'}${uncached ? ` 未キャッシュのメンバーは約${uncached}人いるため、対象外です。` : ''}`
            });
        } catch (err) {
            console.error('[ERROR] POST /admin/api/actions/recruit-notify-init:', err);
            res.status(500).json({ error: err.message || '初期案内DMの送信に失敗しました。' });
        }
    });

    // ------------------------------------------
    // 募集作成（/recruit のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/recruit', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const game = String(req.body?.game || '').trim();
            const description = String(req.body?.description || '').trim();
            const datetime = String(req.body?.datetime || '').trim();
            const capacity = req.body?.capacity === '' || req.body?.capacity == null ? null : Number(req.body.capacity);
            const expiresHours = Number(req.body?.expiresHours ?? 24);
            const channel = getTextChannel(guild, req.body?.channelId);
            if (!game || game.length > 256) return res.status(400).json({ error: '募集名は1〜256文字で入力してください。' });
            if (description.length > 4000 || datetime.length > 200) return res.status(400).json({ error: '詳細または日時が長すぎます。' });
            if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 999)) return res.status(400).json({ error: '定員は1〜999人で指定してください。' });
            if (!Number.isInteger(expiresHours) || expiresHours < 1 || expiresHours > 168) return res.status(400).json({ error: '有効期限は1〜168時間で指定してください。' });
            if (!channel) return res.status(400).json({ error: '募集を投稿するテキストチャンネルを選択してください。' });
            if (!botCanSend(channel, res)) return;
            const id = randomUUID();
            const now = Date.now();
            const recruit = {
                id, guildId: guild.id, channelId: channel.id, messageId: null,
                hostId: client.user.id, game,
                description: description || null, datetime: datetime || null, capacity,
                expiresAt: now + expiresHours * 60 * 60 * 1000,
                createdAt: now, responses: {}, dmMessages: {}
            };
            const sent = await channel.send({ embeds: [buildRecruitEmbed(recruit)], components: [buildRecruitButtons(id), buildRecruitCloseButton(id)] });
            recruit.messageId = sent.id;
            createRecruitment(id, recruit);

            let dmSent = 0, dmSkipped = 0, dmFailed = 0;
            if (req.body?.notifyOptIn === true) {
                const preferences = getAllPreferences(guild.id);
                const ids = Object.entries(preferences).filter(([, value]) => value === 'in').map(([userId]) => userId);
                for (const userId of ids) {
                    const member = guild.members.cache.get(userId);
                    if (!member || member.user.bot) { dmSkipped++; continue; }
                    try {
                        const dm = await member.send({ embeds: [buildRecruitEmbed(recruit, { footerOverride: `${guild.name} からの募集通知 | 募集ID: ${id}` })], components: [buildRecruitButtons(id)] });
                        recruit.dmMessages[userId] = { channelId: dm.channel.id, messageId: dm.id };
                        dmSent++;
                    } catch { dmFailed++; }
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                createRecruitment(id, recruit);
            }
            res.json({ success: true, message: `#${channel.name} に募集を投稿しました。`, dmSent, dmSkipped, dmFailed, id });
        } catch (err) {
            console.error('[ERROR] POST /admin/api/actions/recruit:', err);
            res.status(500).json({ error: err.message || '募集の作成に失敗しました。' });
        }
    });

    // ------------------------------------------
    // ニックネーム変更（メッセージ式ニックネーム機能のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/nickname', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const userId = String(req.body?.userId || '').trim();
            const action = req.body?.action;
            const nickname = String(req.body?.nickname ?? '').trim();
            if (!/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: 'DiscordユーザーIDの形式が不正です。' });
            if (!['set', 'reset'].includes(action)) return res.status(400).json({ error: '操作は set または reset を指定してください。' });
            if (action === 'set' && (!nickname || nickname.length > 32)) return res.status(400).json({ error: 'ニックネームは1〜32文字で指定してください。' });

            const target = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
            if (!target) return res.status(404).json({ error: '対象メンバーが見つかりません。' });
            if (target.id === guild.ownerId) return res.status(403).json({ error: 'サーバー所有者のニックネームは変更できません。' });

            const botMember = guild.members.me;
            if (!botMember?.permissions.has(PermissionFlagsBits.ManageNicknames)) return res.status(403).json({ error: 'Botに「ニックネームの管理」権限がありません。' });
            if (botMember.roles.highest.position <= target.roles.highest.position) return res.status(403).json({ error: '対象メンバーのロールがBotと同じか上位です。Botのロールを対象メンバーより上位にしてください。' });

            await target.setNickname(action === 'reset' ? null : nickname, '管理者ダッシュボードから変更');
            const label = action === 'reset' ? '元のユーザー名に戻しました。' : `ニックネームを「${nickname}」に変更しました。`;
            await logAction(guild, {
                action: 'NICKNAME',
                executor: { tag: 'Dashboard Admin', id: 'dashboard' },
                target: target.user,
                details: action === 'reset' ? 'ニックネームをリセット' : `新しいニックネーム: ${nickname}`
            });
            res.json({ success: true, message: `${target.user.tag} の${label}` });
        } catch (err) {
            console.error('[ERROR] POST /admin/api/actions/nickname:', err);
            res.status(500).json({ error: err.message || 'ニックネームの変更に失敗しました。' });
        }
    });

    // ------------------------------------------
    // BAN / BAN解除（BAN管理機能のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/ban', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const userId = String(req.body?.userId || '').trim();
            const action = req.body?.action;
            const reason = String(req.body?.reason || '管理者による操作').trim().slice(0, 450);
            if (!/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: 'DiscordユーザーIDの形式が不正です。' });
            if (!['ban', 'unban'].includes(action)) return res.status(400).json({ error: '操作は ban または unban を指定してください。' });
            const botMember = guild.members.me;
            if (!botMember?.permissions.has(PermissionFlagsBits.BanMembers)) return res.status(403).json({ error: 'Botに「メンバーをBAN」権限がありません。' });
            if (action === 'ban') {
                const existing = await guild.bans.fetch(userId).catch(() => null);
                if (existing) return res.status(409).json({ error: 'このユーザーは既にBANされています。' });
                const user = await client.users.fetch(userId).catch(() => null);
                if (!user) return res.status(404).json({ error: 'Discordユーザーが見つかりません。IDを確認してください。' });
                await guild.members.ban(userId, { reason: `${reason} | 実行元: 管理者ダッシュボード` });
                await logAction(guild, { action: 'BAN', executor: { tag: 'Dashboard Admin', id: 'dashboard' }, target: user, details: reason });
                await refreshBanListMessage(client, guild, true).catch(error => console.warn('[Dashboard] BAN一覧更新失敗:', error.message));
                return res.json({ success: true, message: `${user.tag} をBANしました。` });
            }
            const ban = await guild.bans.fetch(userId).catch(() => null);
            if (!ban) return res.status(404).json({ error: 'このユーザーはBANされていません。' });
            await guild.members.unban(userId, `${reason} | 実行元: 管理者ダッシュボード`);
            await logAction(guild, { action: 'UNBAN', executor: { tag: 'Dashboard Admin', id: 'dashboard' }, target: ban.user, details: reason });
            await refreshBanListMessage(client, guild, true).catch(error => console.warn('[Dashboard] BAN一覧更新失敗:', error.message));
            return res.json({ success: true, message: `${ban.user.tag} のBANを解除しました。` });
        } catch (err) {
            console.error('[ERROR] POST /admin/api/actions/ban:', err);
            res.status(500).json({ error: err.message || 'BAN操作に失敗しました。' });
        }
    });

    // ------------------------------------------
    // メッセージ一括削除（/purge のダッシュボード版）
    // ------------------------------------------
    router.post('/api/actions/purge', async (req, res) => {
        const guild = getTargetGuild(res);
        if (!guild) return;
        try {
            const channel = getTextChannel(guild, req.body?.channelId);
            const count = Number(req.body?.count);
            const userId = String(req.body?.userId || '').trim();
            if (!channel) return res.status(400).json({ error: '削除対象のテキストチャンネルを選択してください。' });
            if (!Number.isInteger(count) || count < 1 || count > 100) return res.status(400).json({ error: '削除件数は1〜100件で指定してください。' });
            if (userId && !/^\d{17,20}$/.test(userId)) return res.status(400).json({ error: 'ユーザーIDの形式が不正です。' });
            const botMember = guild.members.me;
            const permissions = botMember ? channel.permissionsFor(botMember) : null;
            const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages];
            if (!permissions?.has(required)) return res.status(403).json({ error: `Botに #${channel.name} の「チャンネルを見る」「メッセージ履歴を読む」「メッセージの管理」権限が必要です。` });
            const fetched = await channel.messages.fetch({ limit: userId ? 100 : count });
            let targets = [...fetched.values()];
            if (userId) targets = targets.filter(message => message.author.id === userId).slice(0, count);
            if (!targets.length) return res.json({ success: true, deleted: 0, skippedOld: 0, message: '削除対象のメッセージがありませんでした。' });
            const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const recent = targets.filter(message => message.createdTimestamp > cutoff);
            const skippedOld = targets.length - recent.length;
            const deleted = recent.length ? await channel.bulkDelete(recent, true) : { size: 0 };
            await logAction(guild, { action: 'PURGE', executor: { tag: 'Dashboard Admin', id: 'dashboard' }, channel, details: `${deleted.size}件を削除${userId ? ` (ユーザーID: ${userId})` : ''}` });
            res.json({ success: true, deleted: deleted.size, skippedOld, message: `${deleted.size}件を削除しました。${skippedOld ? ` 2週間以上前の${skippedOld}件はスキップしました。` : ''}` });
        } catch (err) {
            res.status(500).json({ error: err.message || 'メッセージの削除に失敗しました。' });
        }
    });

    app.use('/admin', router);
    console.log('[INFO] 管理者ダッシュボードをマウントしました: /admin');
}
