// ==============================================
// handlers/studyVcHandler.js
// おべんきょVCの専用ハンドラー
//
// 機能:
//   1. 入室通知: 正規ユーザーにはDMでルールと開始時刻を通知
//   2. 入退室ログ: ログチャンネルにサイレントメッセージで送信
//      （通知音を出さないサイレント送信）
//   3. セッション追跡: 各ユーザーの勉強時間をインメモリで管理
//
// ※ロールの付与・削除は /study-role コマンドで手動管理します
//
// 環境変数:
//   STUDY_VC_ID          おべんきょVCのチャンネルID
//                        (デフォルト: 1505121212182036591)
//   AFK_TIMEOUT_MINUTES  AFK検出タイムアウト分 (afkHandlerと共有)
//
// ログチャンネル: 1472968673558790377 (固定)
// ==============================================

import 'dotenv/config';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { getStudyRecord } from '../utils/studyRoleStore.js';

const STUDY_VC_ID         = process.env.STUDY_VC_ID || '1505121212182036591';
const STUDY_LOG_CHANNEL_ID = '1472968673558790377';
const AFK_TIMEOUT_MINUTES = parseInt(process.env.AFK_TIMEOUT_MINUTES, 10) || 30;

// インメモリのセッション管理
// userId -> { joinedAt: number }
const sessions = new Map();

// ==============================================
// 時間フォーマット
// ==============================================
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours   = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0)   return `${hours}時間${minutes}分`;
    if (minutes > 0) return `${minutes}分${seconds}秒`;
    return `${seconds}秒`;
}

// ==============================================
// ログチャンネルにサイレントメッセージを送信する
// SuppressNotifications フラグで通知音を抑制する
// ==============================================
async function sendLog(client, embed) {
    try {
        const channel = await client.channels.fetch(STUDY_LOG_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.warn(`[Study] ログチャンネルが見つかりません: ${STUDY_LOG_CHANNEL_ID}`);
            return;
        }
        await channel.send({
            embeds: [embed],
            flags:  MessageFlags.SuppressNotifications
        });
    } catch (err) {
        console.error('[Study] ログ送信失敗:', err.message);
    }
}

// ==============================================
// VC入室時の処理
// ==============================================
async function onStudyJoin(member, client) {
    const userId = member.id;

    // 既存セッションがあればクリア（念のため）
    sessions.delete(userId);

    // セッション開始
    sessions.set(userId, { joinedAt: Date.now() });

    // 科目情報を取得
    const record  = getStudyRecord(member.guild.id, userId);
    const subject = record?.subject ?? null;

    // 入室通知DM
    try {
        await member.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('おべんきょVC - 勉強開始')
                    .setDescription(
                        'おべんきょVCに参加しました。集中して頑張りましょう。\n\n' +
                        '**ルール**\n' +
                        '- 勉強・作業に集中してください\n' +
                        '- 長時間の雑談は控えましょう\n' +
                        `- ${AFK_TIMEOUT_MINUTES}分以上無操作状態が続くとAFKチャンネルへ移動されます\n\n` +
                        `**開始時刻**: <t:${Math.floor(Date.now() / 1000)}:t>` +
                        (subject ? `\n**科目**: ${subject}` : '')
                    )
                    .setColor(0x27ae60)
                    .setTimestamp()
            ]
        });
    } catch {
        // DM送信失敗は無視
    }

    // 入室ログ（サイレント）
    const logEmbed = new EmbedBuilder()
        .setTitle('おべんきょVC - 入室')
        .addFields(
            { name: 'ユーザー', value: `${member} (${member.user.tag})`,        inline: true },
            { name: '時刻',     value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
        )
        .setColor(0x27ae60)
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .setTimestamp()
        .setFooter({ text: `ID: ${userId}` });

    if (subject) {
        logEmbed.addFields({ name: '科目', value: subject, inline: true });
    }

    await sendLog(client, logEmbed);

    console.log(`[Study] 入室: ${member.user.tag} (${userId})${subject ? ` | 科目: ${subject}` : ''}`);
}

// ==============================================
// VC退室時の処理
// ==============================================
async function onStudyLeave(member, client) {
    const userId  = member.id;
    const session = sessions.get(userId);

    if (!session) return;

    sessions.delete(userId);

    const duration = Date.now() - session.joinedAt;

    // 科目情報を取得
    const record  = getStudyRecord(member.guild.id, userId);
    const subject = record?.subject ?? null;

    // 退室ログ（サイレント）
    const logEmbed = new EmbedBuilder()
        .setTitle('おべんきょVC - 退室')
        .addFields(
            { name: 'ユーザー',   value: `${member} (${member.user.tag})`,        inline: true },
            { name: '勉強時間',   value: formatDuration(duration),                  inline: true },
            { name: '退室時刻',   value: `<t:${Math.floor(Date.now() / 1000)}:T>`,  inline: true }
        )
        .setColor(0xe74c3c)
        .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
        .setTimestamp()
        .setFooter({ text: `ID: ${userId}` });

    if (subject) {
        logEmbed.addFields({ name: '科目', value: subject, inline: true });
    }

    await sendLog(client, logEmbed);

    console.log(`[Study] 退室: ${member.user.tag} (${userId}) | 勉強時間: ${formatDuration(duration)}`);
}

// ==============================================
// 現在のセッション状況を取得（外部参照用）
// ==============================================
export function getStudyVcStatus() {
    return {
        enabled:        true,
        vcId:           STUDY_VC_ID,
        logChannelId:   STUDY_LOG_CHANNEL_ID,
        activeSessions: sessions.size
    };
}

// ==============================================
// 初期化 (index.js の ready イベントから呼ぶ)
// ==============================================
export function initStudyVc(client) {
    console.log(`[Study] おべんきょVC機能を有効化 | VC ID: ${STUDY_VC_ID}`);
    console.log(`[Study] ログチャンネル: ${STUDY_LOG_CHANNEL_ID} (サイレント送信)`);

    client.on('voiceStateUpdate', async (oldState, newState) => {
        // ボット自身は無視
        if (newState.id === client.user.id) return;

        const joinedStudy = newState.channel?.id === STUDY_VC_ID && oldState.channel?.id !== STUDY_VC_ID;
        const leftStudy   = oldState.channel?.id === STUDY_VC_ID && newState.channel?.id !== STUDY_VC_ID;

        if (joinedStudy) {
            if (!newState.member) return;
            await onStudyJoin(newState.member, client).catch(err => {
                console.error('[Study] 入室処理エラー:', err.message);
            });
        } else if (leftStudy) {
            if (!oldState.member) return;
            await onStudyLeave(oldState.member, client).catch(err => {
                console.error('[Study] 退室処理エラー:', err.message);
            });
        }
    });

    // 起動時に既にVCに参加中のユーザーのセッションを引き継ぎ
    client.once('ready', async () => {
        for (const [, guild] of client.guilds.cache) {
            try {
                await guild.members.fetch();
            } catch {
                continue;
            }
            for (const [, member] of guild.members.cache) {
                if (member.id === client.user.id) continue;
                if (member.voice.channel?.id !== STUDY_VC_ID) continue;
                sessions.set(member.id, { joinedAt: Date.now() });
                // 起動時はロール付与しない（既に在室中のユーザーなので手動管理を尊重）
                console.log(`[Study] 起動時セッション引き継ぎ: ${member.user.tag}`);
            }
        }
    });
}
