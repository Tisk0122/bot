import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../utils/guildConfigStore.js';

// userId -> { timer, guildId, joinedAt }
const afkTimers = new Map();
let detectorClient = null;
let listenerRegistered = false;

function clearAfkTimer(userId) {
    const entry = afkTimers.get(userId);
    if (entry) clearTimeout(entry.timer);
    afkTimers.delete(userId);
}

function startAfkTimer(member) {
    if (!member?.guild || member.user?.bot) return;
    const config = getGuildConfig(member.guild.id);
    const afkChannelId = config.afkChannelId;
    if (!afkChannelId || !member.voice?.channel) {
        clearAfkTimer(member.id);
        return;
    }
    if (member.voice.channel.id === afkChannelId || member.voice.channel.id === config.studyVoiceChannelId) {
        clearAfkTimer(member.id);
        return;
    }

    clearAfkTimer(member.id);
    const timeoutMs = Math.max(1, Number(config.afkTimeoutMinutes) || 30) * 60 * 1000;
    const timer = setTimeout(async () => {
        afkTimers.delete(member.id);
        const freshMember = member.guild.members.cache.get(member.id);
        if (!freshMember?.voice?.channel) return;
        const latest = getGuildConfig(member.guild.id);
        if (!latest.afkChannelId || freshMember.voice.channel.id === latest.afkChannelId) return;
        if (freshMember.voice.channel.id === latest.studyVoiceChannelId) return;

        const targetChannel = member.guild.channels.cache.get(latest.afkChannelId);
        if (!targetChannel || !targetChannel.isVoiceBased?.()) {
            console.warn(`[AFK] 設定されたAFKチャンネルが見つからないか、VCではありません: ${latest.afkChannelId}`);
            return;
        }
        try {
            await freshMember.voice.setChannel(targetChannel, 'AFK自動検出: 長時間活動なし');
            console.log(`[INFO] AFK自動移動: ${freshMember.user.tag} → ${targetChannel.name}`);
            await freshMember.send({
                embeds: [new EmbedBuilder()
                    .setTitle('AFKチャンネルに移動しました')
                    .setDescription('長時間活動がなかったため、設定されたAFKチャンネルへ自動移動しました。')
                    .setColor(0x6f42c1)
                    .setTimestamp()]
            }).catch(() => {});
        } catch (error) {
            console.error('[ERROR] AFK自動移動失敗:', error.message);
        }
    }, timeoutMs);

    afkTimers.set(member.id, { timer, guildId: member.guild.id, joinedAt: Date.now() });
}

export function initAfkDetector(client) {
    detectorClient = client;
    if (!listenerRegistered) {
        client.on('voiceStateUpdate', (oldState, newState) => {
            const userId = newState.id || oldState.id;
            if (userId === client.user?.id) return;
            if (!newState.member) {
                if (!newState.channel) clearAfkTimer(userId);
                return;
            }
            // VC移動・退出・ミュート/デフ変更を「活動」としてタイマーを再設定。
            if (!newState.channel) clearAfkTimer(userId);
            else startAfkTimer(newState.member);
        });
        listenerRegistered = true;
    }

    refreshAfkDetector(client);
    const guilds = [...client.guilds.cache.values()];
    const enabled = guilds.some(guild => Boolean(getGuildConfig(guild.id).afkChannelId));
    if (!enabled) console.warn('[AFK] AFKチャンネルが未設定です。ダッシュボードから設定すると自動検出が有効になります。');
}

// ダッシュボードから設定を変更した際、既存タイマーも新しい設定に同期する。
export function refreshAfkDetector(client = detectorClient) {
    if (!client) return;
    for (const userId of [...afkTimers.keys()]) clearAfkTimer(userId);
    for (const guild of client.guilds.cache.values()) {
        for (const channel of guild.channels.cache.values()) {
            if (!channel.isVoiceBased?.()) continue;
            for (const member of channel.members.values()) startAfkTimer(member);
        }
    }
}

export function getAfkStatus(guildId) {
    const config = getGuildConfig(guildId);
    return {
        enabled: Boolean(config.afkChannelId),
        timeout: Number(config.afkTimeoutMinutes) || 30,
        channelId: config.afkChannelId || null,
        trackedUsers: [...afkTimers.values()].filter(entry => !guildId || entry.guildId === guildId).length
    };
}
