import { EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getGuildConfig } from './guildConfigStore.js';

const ACTION_LABELS = {
    BAN:       { color: 0xdc3545 },
    UNBAN:     { color: 0x28a745 },
    KICK:      { color: 0xfd7e14 },
    TIMEOUT:   { color: 0x6f42c1 },
    PURGE:     { color: 0x6c757d },
    VERIFY:    { color: 0x007bff },
    NICKNAME:  { color: 0x5865f2 },
};

export async function logAction(guild, { action, executor, target, channel, details }) {
    const logChannelId = getGuildConfig(guild.id).logChannelId;
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId) ?? await guild.channels.fetch(logChannelId).catch(() => null);
    if (!logChannel) return;

    const config = ACTION_LABELS[action] || { color: 0x5865f2 };

    const embed = new EmbedBuilder()
        .setTitle(`[${action}]`)
        .setColor(config.color)
        .addFields(
            { name: '実行者', value: `${executor.tag} (<@${executor.id}>)`, inline: true }
        )
        .setTimestamp();

    if (target) {
        embed.addFields(
            { name: '対象', value: `${target.tag} (<@${target.id}>)`, inline: true }
        );
    }

    if (channel) {
        embed.addFields(
            { name: 'チャンネル', value: `<#${channel.id}>`, inline: true }
        );
    }

    if (details) {
        embed.addFields({ name: '詳細', value: details });
    }

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[ERROR] ログ送信失敗:', err);
    }
}

// BAN/UNBAN のグローバルイベントを监听するための初期化関数
export function initAuditLogger(client) {
    client.on('guildBanAdd', async ban => {
        if (!getGuildConfig(ban.guild.id).logChannelId) return;
        const entry = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }).catch(() => null);
        const auditEntry = entry?.entries?.first();
        const executor = auditEntry?.executor || { tag: '不明', id: '0' };

        await logAction(ban.guild, {
            action: 'BAN',
            executor,
            target: ban.user,
            details: auditEntry?.reason || '理由なし'
        });
    });

    client.on('guildBanRemove', async ban => {
        if (!getGuildConfig(ban.guild.id).logChannelId) return;
        const entry = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 }).catch(() => null);
        const auditEntry = entry?.entries?.first();
        const executor = auditEntry?.executor || { tag: '不明', id: '0' };

        await logAction(ban.guild, {
            action: 'UNBAN',
            executor,
            target: ban.user,
            details: 'BAN解除'
        });
    });
}
