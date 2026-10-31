// ==============================================
// handlers/studyVcHandler.js
// おべんきょVC: 勉強ロール必須化、入退室DM/ログ、学習セッション追跡
// 設定は guild_config.json から動的に参照し、ダッシュボード変更を即時反映する。
// ==============================================
import 'dotenv/config';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getStudyRecord } from '../utils/studyRoleStore.js';
import { getGuildConfig } from '../utils/guildConfigStore.js';

const sessions = new Map(); // userId -> { joinedAt, guildId }

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}時間${minutes}分`;
    if (minutes > 0) return `${minutes}分${seconds}秒`;
    return `${seconds}秒`;
}

async function sendLog(client, guildId, embed) {
    const logChannelId = getGuildConfig(guildId).studyLogChannelId;
    if (!logChannelId) return;
    try {
        const channel = client.channels.cache.get(logChannelId)
            ?? await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
            console.warn(`[Study] ログチャンネルを利用できません: ${logChannelId}`);
            return;
        }
        await channel.send({ embeds: [embed], flags: MessageFlags.SuppressNotifications });
    } catch (error) {
        console.error('[Study] ログ送信失敗:', error.message);
    }
}

async function getOrCreateStudyRole(guild, roleName) {
    let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (role) return role;
    const fetched = await guild.roles.fetch().catch(() => null);
    role = fetched?.find(r => r.name.toLowerCase() === roleName.toLowerCase()) ?? null;
    if (role) return role;
    return guild.roles.create({
        name: roleName,
        color: 0x27ae60,
        reason: 'おべんきょVCの入室制限に必要なロール'
    });
}

// 設定保存時と起動時に呼び出す。Discordチャンネル権限でも入室を二重に制限。
export async function applyStudyVcPermissions(guild, config = getGuildConfig(guild.id)) {
    if (!config.studyVoiceChannelId) return { enabled: false, reason: '勉強VCが未設定です。' };
    const channel = guild.channels.cache.get(config.studyVoiceChannelId)
        ?? await guild.channels.fetch(config.studyVoiceChannelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        throw new Error('勉強VCとして指定したチャンネルが見つからないか、通常のボイスチャンネルではありません。');
    }

    const botMember = guild.members.me;
    if (!botMember) throw new Error('Bot自身のメンバー情報を取得できません。');
    const botPermissions = channel.permissionsFor(botMember);
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        throw new Error('Botに「ロールの管理」権限がありません。');
    }
    if (!botPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        throw new Error('Botに対象VCの「チャンネルの管理」権限がありません。');
    }

    const roleName = String(config.studyRoleName || '勉強中').trim();
    if (!roleName) throw new Error('勉強ロール名が空です。');
    const previousConfig = getGuildConfig(guild.id);
    const previousRoleName = String(previousConfig.studyRoleName || '勉強中');
    const previousRole = guild.roles.cache.find(r => r.name.toLowerCase() === previousRoleName.toLowerCase()) ?? null;
    const role = await getOrCreateStudyRole(guild, roleName);
    if (botMember.roles.highest.position <= role.position) {
        throw new Error(`Botのロールが「${role.name}」より下位です。Botのロールを上位に移動してください。`);
    }

    // 以前の設定がこのチャンネルに残っている場合、旧ロールの接続許可だけを解除する。
    if (previousRole && previousRole.id !== role.id && previousConfig.studyVoiceChannelId === channel.id) {
        await channel.permissionOverwrites.edit(previousRole, { Connect: null }, {
            reason: 'おべんきょVC: 旧勉強ロールの接続許可を解除'
        });
    }
    // VC自体を変更した場合は、旧VCに設定した @everyone / 旧ロールのConnect上書きを解除する。
    if (previousConfig.studyVoiceChannelId && previousConfig.studyVoiceChannelId !== channel.id) {
        const oldChannel = guild.channels.cache.get(previousConfig.studyVoiceChannelId);
        if (oldChannel?.type === ChannelType.GuildVoice) {
            await oldChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null }, {
                reason: 'おべんきょVC: 管理画面から対象VCを変更'
            }).catch(error => console.warn(`[Study] 旧VCの権限復元をスキップ: ${error.message}`));
            if (previousRole) {
                await oldChannel.permissionOverwrites.edit(previousRole, { Connect: null }, {
                    reason: 'おべんきょVC: 管理画面から対象VCを変更'
                }).catch(error => console.warn(`[Study] 旧ロール権限の復元をスキップ: ${error.message}`));
            }
        }
    }

    await channel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false }, {
        reason: 'おべんきょVC: 勉強ロール保持者以外の接続を拒否'
    });
    await channel.permissionOverwrites.edit(role, { Connect: true }, {
        reason: 'おべんきょVC: 勉強ロール保持者に接続を許可'
    });

    if (!botPermissions.has(PermissionFlagsBits.MoveMembers)) {
        console.warn('[Study] Botに「メンバーを移動」権限がありません。権限上書きが唯一の入室制御となります。');
    }
    console.log(`[Study] VC接続権限を設定: ${channel.name} | @everyone=拒否 / ${role.name}=許可`);
    return { enabled: true, channelId: channel.id, channelName: channel.name, roleId: role.id, roleName: role.name };
}

async function denyStudyEntry(member, reason, config = getGuildConfig(member.guild.id)) {
    try {
        if (member.voice?.channelId === config.studyVoiceChannelId) {
            await member.voice.disconnect('おべんきょVC: 勉強ロールなし、または資格確認不能');
        }
        console.warn(`[Study] 入室拒否: ${member.user?.tag ?? member.id} (${member.id}) | ${reason}`);
    } catch (error) {
        console.error(`[Study] 入室拒否の切断に失敗 (${member.id}): ${error.message}`);
    }
    try {
        await member.send({ embeds: [new EmbedBuilder()
            .setTitle('おべんきょVC - 入室できません')
            .setDescription(reason)
            .setColor(0xe74c3c)
            .setTimestamp()] });
    } catch { /* DM拒否は想定内 */ }
}

export async function checkAndEnforceRole(member, config = getGuildConfig(member.guild.id)) {
    const roleName = String(config.studyRoleName || '勉強中');
    const role = member.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) {
        await denyStudyEntry(member, `入室に必要なロール「${roleName}」を確認できません。管理者に連絡してください。`, config);
        return true;
    }
    if (!member.roles.cache.has(role.id)) {
        await denyStudyEntry(member, `おべんきょVCに入室するには **${roleName}** ロールが必要です。管理者に付与を依頼してください。`, config);
        return true;
    }
    return false;
}

async function onStudyJoin(member, client) {
    if (await checkAndEnforceRole(member)) return;
    sessions.set(member.id, { joinedAt: Date.now(), guildId: member.guild.id });
    const record = getStudyRecord(member.guild.id, member.id);
    const subject = record?.subject ?? null;

    try {
        await member.send({ embeds: [new EmbedBuilder()
            .setTitle('おべんきょVC - 勉強開始')
            .setDescription(
                'おべんきょVCに参加しました。集中して頑張りましょう。\n\n' +
                '**ルール**\n- 勉強・作業に集中してください\n- 長時間の雑談は控えましょう\n\n' +
                `**開始時刻**: <t:${Math.floor(Date.now() / 1000)}:t>` +
                (subject ? `\n**科目**: ${subject}` : '')
            )
            .setColor(0x27ae60).setTimestamp()] });
    } catch { /* DM失敗は無視 */ }

    const embed = new EmbedBuilder()
        .setTitle('おべんきょVC - 入室')
        .addFields(
            { name: 'ユーザー', value: `${member} (${member.user.tag})`, inline: true },
            { name: '時刻', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
        )
        .setColor(0x27ae60)
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .setTimestamp()
        .setFooter({ text: `ID: ${member.id}` });
    if (subject) embed.addFields({ name: '科目', value: subject, inline: true });
    await sendLog(client, member.guild.id, embed);
    console.log(`[Study] 入室: ${member.user.tag} (${member.id})${subject ? ` | 科目: ${subject}` : ''}`);
}

async function onStudyLeave(member, client) {
    const session = sessions.get(member.id);
    if (!session) return;
    sessions.delete(member.id);
    const duration = Date.now() - session.joinedAt;
    const record = getStudyRecord(member.guild.id, member.id);
    const subject = record?.subject ?? null;
    const embed = new EmbedBuilder()
        .setTitle('おべんきょVC - 退室')
        .addFields(
            { name: 'ユーザー', value: `${member} (${member.user.tag})`, inline: true },
            { name: '勉強時間', value: formatDuration(duration), inline: true },
            { name: '退室時刻', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
        )
        .setColor(0xe74c3c)
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .setTimestamp()
        .setFooter({ text: `ID: ${member.id}` });
    if (subject) embed.addFields({ name: '科目', value: subject, inline: true });
    await sendLog(client, member.guild.id, embed);
    console.log(`[Study] 退室: ${member.user.tag} (${member.id}) | 勉強時間: ${formatDuration(duration)}`);
}

export async function enforceCurrentStudyMembers(guild, config = getGuildConfig(guild.id)) {
    if (!config.studyVoiceChannelId) return { checked: 0, denied: 0 };
    const channel = guild.channels.cache.get(config.studyVoiceChannelId);
    if (!channel?.isVoiceBased?.()) return { checked: 0, denied: 0 };
    let checked = 0, denied = 0;
    for (const member of channel.members.values()) {
        if (member.user.bot) continue;
        checked++;
        try {
            const blocked = await checkAndEnforceRole(member, config);
            if (blocked) denied++;
            else if (!sessions.has(member.id)) sessions.set(member.id, { joinedAt: Date.now(), guildId: guild.id });
        } catch (error) {
            await denyStudyEntry(member, '入室資格を確認できませんでした。管理者に連絡してください。', config);
            denied++;
        }
    }
    return { checked, denied };
}

export function getStudyVcStatus(guildId) {
    const config = getGuildConfig(guildId);
    const activeSessions = [...sessions.values()].filter(s => !guildId || s.guildId === guildId).length;
    return {
        enabled: Boolean(config.studyVoiceChannelId),
        vcId: config.studyVoiceChannelId || null,
        logChannelId: config.studyLogChannelId || null,
        roleName: config.studyRoleName,
        activeSessions
    };
}

export async function initStudyVc(client) {
    for (const guild of client.guilds.cache.values()) {
        const config = getGuildConfig(guild.id);
        if (!config.studyVoiceChannelId) {
            console.warn(`[Study] 勉強VC未設定のため無効: ${guild.name}`);
            continue;
        }
        try {
            const result = await applyStudyVcPermissions(guild, config);
            console.log(`[Study] おべんきょVC機能を有効化: ${result.channelName} (${result.channelId})`);
            await enforceCurrentStudyMembers(guild, config);
        } catch (error) {
            console.error(`[Study] VC初期化失敗 (${guild.id})。入室判定はfail-closedで実行します: ${error.message}`);
        }
    }

    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (newState.id === client.user?.id) return;
        const guildId = newState.guild?.id || oldState.guild?.id;
        if (!guildId) return;
        const config = getGuildConfig(guildId);
        const targetVcId = config.studyVoiceChannelId;
        if (!targetVcId) return;
        const joined = newState.channel?.id === targetVcId && oldState.channel?.id !== targetVcId;
        const left = oldState.channel?.id === targetVcId && newState.channel?.id !== targetVcId;
        if (joined && newState.member) {
            await onStudyJoin(newState.member, client).catch(error => console.error('[Study] 入室処理エラー:', error.message));
        } else if (left && oldState.member) {
            await onStudyLeave(oldState.member, client).catch(error => console.error('[Study] 退室処理エラー:', error.message));
        }
    });
}
