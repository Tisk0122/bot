import { EmbedBuilder } from 'discord.js';

const AFK_CHANNEL_ID  = process.env.AFK_CHANNEL_ID;
const AFK_TIMEOUT_MS  = (parseInt(process.env.AFK_TIMEOUT_MINUTES, 10) || 30) * 60 * 1000;
// おべんきょVCはAFK対象外（スマホ等で勉強中の場合も考慮）
const STUDY_VC_ID     = process.env.STUDY_VC_ID || '1505121212182036591';

// userId -> { timer, channelId, joinedAt }
const afkTimers = new Map();

function clearAfkTimer(userId) {
    const entry = afkTimers.get(userId);
    if (entry) {
        clearTimeout(entry.timer);
        afkTimers.delete(userId);
    }
}

function startAfkTimer(member) {
    const userId = member.id;

    clearAfkTimer(userId);

    if (!AFK_CHANNEL_ID) return;

    // おべんきょVCにいる場合はAFK対象外
    if (member.voice?.channel?.id === STUDY_VC_ID) return;

    const timer = setTimeout(async () => {
        afkTimers.delete(userId);

        // Gatewayで維持されるメンバーキャッシュから最新のボイス状態を読む。
        // fetch(userId) はOpcode 8を発生させるため、タイマーごとには呼ばない。
        const freshMember = member.guild.members.cache.get(userId);
        if (!freshMember) return;

        const voiceState = freshMember.voice;
        if (!voiceState.channel) return;
        if (voiceState.channel.id === AFK_CHANNEL_ID) return;

        try {
            await voiceState.setChannel(AFK_CHANNEL_ID, 'AFK自動検出: 長時間活動なし');

            console.log(`[INFO] AFK自動移動: ${freshMember.user.tag} → おねんねVC`);

            try {
                await freshMember.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('おねんねVCに送られました')
                            .setDescription(
                                `長時間活動がなかったため、おねんねVCに自動移動しました。\n` +
                                `再びボイスチャンネルに参加すれば元に戻れます。`
                            )
                            .setColor(0x6f42c1)
                            .setTimestamp()
                    ]
                });
            } catch {}
        } catch (err) {
            console.error('[ERROR] AFK自動移動失敗:', err.message);
        }
    }, AFK_TIMEOUT_MS);

    afkTimers.set(userId, { timer, joinedAt: Date.now() });
}

export function initAfkDetector(client) {
    if (!AFK_CHANNEL_ID) {
        console.warn('[AFK] AFK_CHANNEL_ID が未設定です。AFK自動検出は無効です。');
        return;
    }

    console.log(`[AFK] AFK自動検出を有効化 | タイムアウト: ${AFK_TIMEOUT_MS / 60000}分 | おねんねVC: ${AFK_CHANNEL_ID}`);

    client.on('voiceStateUpdate', (oldState, newState) => {
        const { id: userId } = oldState;

        // ボット自身は無視
        if (userId === client.user.id) return;

        // チャンネル参加
        if (!oldState.channel && newState.channel) {
            if (newState.member) startAfkTimer(newState.member);
        }
        // チャンネル退出
        else if (oldState.channel && !newState.channel) {
            clearAfkTimer(userId);
        }
        // チャンネル移動
        else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
            // おねんねVCに移動された場合はタイマー解除
            if (newState.channel.id === AFK_CHANNEL_ID) {
                clearAfkTimer(userId);
            } else {
                if (newState.member) startAfkTimer(newState.member);
            }
        }
        // ミュート/デフの変更で再起動（活動があったとみなす）
        else if (oldState.channel && newState.channel && oldState.channel.id === newState.channel.id) {
            if (oldState.mute !== newState.mute || oldState.deaf !== newState.deaf) {
                if (newState.member) startAfkTimer(newState.member);
            }
        }
    });

    // initAfkDetector は ready 後に呼ばれるため、ここで即時に
    // キャッシュ済みボイスチャンネル参加者だけを追跡する。
    // サーバー全メンバーの取得 (Opcode 8) は行わない。
    for (const [, guild] of client.guilds.cache) {
        const seen = new Set();
        for (const channel of guild.channels.cache.values()) {
            if (!channel.isVoiceBased?.()) continue;
            for (const member of channel.members.values()) {
                if (member.id === client.user.id || seen.has(member.id)) continue;
                seen.add(member.id);
                startAfkTimer(member);
            }
        }
    }
}

export function getAfkStatus() {
    return {
        enabled: !!AFK_CHANNEL_ID,
        timeout: AFK_TIMEOUT_MS / 60000,
        channelId: AFK_CHANNEL_ID,
        trackedUsers: afkTimers.size
    };
}
