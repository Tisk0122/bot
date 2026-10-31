// ==============================================
// handlers/studyVcHandler.js
// おべんきょVCの専用ハンドラー
//
// 機能:
//   1. 入室制限: 勉強ロールを持っていないユーザーをVCから切断する
//   2. 入室通知: 正規ユーザーにはDMでルールと開始時刻を通知
//   3. 入退室ログ: ログチャンネルにサイレントメッセージで送信
//      （通知音を出さないサイレント送信）
//   4. セッション追跡: 各ユーザーの勉強時間をインメモリで管理
//
// ※ロールの付与は /study-role give コマンドで管理します
//
// 環境変数:
//   STUDY_VC_ID          おべんきょVCのチャンネルID
//                        (デフォルト: 1505121212182036591)
//   STUDY_LOG_CHANNEL_ID ログを送信するチャンネルID
//                        (デフォルト: 1472968673558790377)
//   STUDY_ROLE_NAME      入室を許可するロール名 (デフォルト: 勉強中)
// ==============================================

import 'dotenv/config';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getStudyRecord } from '../utils/studyRoleStore.js';

const STUDY_VC_ID          = process.env.STUDY_VC_ID          || '1505121212182036591';
const STUDY_LOG_CHANNEL_ID = process.env.STUDY_LOG_CHANNEL_ID || '1472968673558790377';
const STUDY_ROLE_NAME      = process.env.STUDY_ROLE_NAME      || '勉強中';

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
// 入室制限チェック: ロールを持っていない場合は切断してDM通知
//
// 【修正点】
//   以前は guild.roles.cache.find() を使っていたが、
//   起動直後はロールキャッシュが未構築の場合があり
//   role が undefined → !role === true → 入室OK と誤判定していた。
//   guild.roles.fetch() で必ず最新情報をAPIから取得することで修正。
// ==============================================
async function checkAndEnforceRole(member) {
    // Fail closed: 権限情報を確認できない場合も入室を許可しない。
    let roles;
    try {
        roles = await member.guild.roles.fetch();
    } catch (err) {
        console.error(`[Study] ロール一覧の取得に失敗 (${member.id}): ${err.message}`);
        await denyStudyEntry(member, '入室資格を確認できませんでした。時間をおいて再度お試しください。');
        return true;
    }

    if (!roles) {
        console.error('[Study] ロール一覧が取得できません。安全のため入室を拒否します。');
        await denyStudyEntry(member, '入室資格を確認できませんでした。管理者に連絡してください。');
        return true;
    }

    const role = roles.find(r => r.name.toLowerCase() === STUDY_ROLE_NAME.toLowerCase());
    if (!role) {
        console.error(`[Study] 必須ロール「${STUDY_ROLE_NAME}」が存在しません。安全のため入室を拒否します。`);
        await denyStudyEntry(member, `入室に必要なロール「${STUDY_ROLE_NAME}」がサーバーにありません。管理者に連絡してください。`);
        return true;
    }

    let freshMember;
    try {
        freshMember = await member.guild.members.fetch({ user: member.id, force: true });
    } catch (err) {
        console.error(`[Study] メンバー情報の取得に失敗 (${member.id}): ${err.message}`);
        await denyStudyEntry(member, '入室資格を確認できませんでした。時間をおいて再度お試しください。');
        return true;
    }

    if (!freshMember.roles.cache.has(role.id)) {
        await denyStudyEntry(freshMember, `おべんきょVCに入室するには **${STUDY_ROLE_NAME}** ロールが必要です。管理者に付与を依頼してください。`);
        return true;
    }

    return false;
}

// 入室拒否は、切断に失敗しても後続処理（セッション開始・入室ログ）へ進ませない。
async function denyStudyEntry(member, reason) {
    try {
        if (member.voice?.channelId === STUDY_VC_ID) {
            await member.voice.disconnect('おべんきょVC: 勉強ロールなし、または資格確認不能');
        }
        console.warn(`[Study] 入室拒否: ${member.user?.tag ?? member.id} (${member.id}) | ${reason}`);
    } catch (err) {
        console.error(`[Study] 入室拒否の切断に失敗 (${member.id}): ${err.message}`);
    }

    try {
        await member.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('おべんきょVC - 入室できません')
                    .setDescription(reason)
                    .setColor(0xe74c3c)
                    .setTimestamp()
            ]
        });
    } catch {
        // DM拒否は想定内。サーバーログには拒否理由を残す。
    }
}

// ==============================================
// VC入室時の処理
// ==============================================
async function onStudyJoin(member, client) {
    const userId = member.id;

    // ロールチェック（持っていなければ切断して終了）
    const wasKicked = await checkAndEnforceRole(member);
    if (wasKicked) return;

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
                        '- 長時間の雑談は控えましょう\n\n' +
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
//
// 【修正点】
//   以前は initStudyVc 内で client.once('ready') をネストして登録していたが、
//   index.js の ready ハンドラ内から initStudyVc が呼ばれるため
//   ready はすでに発火済みであり、ネストした once('ready') は
//   永遠に実行されなかった。
//
//   修正後は initStudyVc 自体を async にし、起動時の既存ユーザー確認を
//   client.once('ready') のネストなしに直接実行する。
//   index.js 側では await initStudyVc(client) と呼ぶこと。
// ==============================================
export async function initStudyVc(client) {
    console.log(`[Study] おべんきょVC機能を有効化 | VC ID: ${STUDY_VC_ID}`);
    console.log(`[Study] ログチャンネル: ${STUDY_LOG_CHANNEL_ID} (サイレント送信)`);

    // 起動時に必須ロールを検証。存在しなければ作成し、作成不能なら
    // 入室判定側が fail-closed で全員を拒否する。
    for (const [, guild] of client.guilds.cache) {
        try {
            const roles = await guild.roles.fetch();
            let studyRole = roles?.find(r => r.name.toLowerCase() === STUDY_ROLE_NAME.toLowerCase());
            if (!studyRole) {
                studyRole = await guild.roles.create({
                    name: STUDY_ROLE_NAME,
                    color: 0x27ae60,
                    reason: 'おべんきょVCの入室制限に必要なロール'
                });
                console.log(`[Study] 必須ロールを自動作成: ${studyRole.name} (${studyRole.id})`);
            } else {
                console.log(`[Study] 必須ロール確認済み: ${studyRole.name} (${studyRole.id})`);
            }

            // Discord側でも @everyone の接続を拒否し、勉強ロールだけを許可する。
            // Bot側のvoiceStateUpdate制御と二重化して、イベント遅延時の隙を減らす。
            const studyChannel = await guild.channels.fetch(STUDY_VC_ID);
            if (!studyChannel || studyChannel.type !== ChannelType.GuildVoice) {
                throw new Error(`STUDY_VC_ID (${STUDY_VC_ID}) が通常のボイスチャンネルではありません`);
            }
            const botMember = guild.members.me ?? await guild.members.fetch(client.user.id);
            const botPermissions = studyChannel.permissionsFor(botMember);
            if (!botPermissions?.has(PermissionFlagsBits.ManageChannels)) {
                throw new Error('Botに「チャンネルの管理」権限がありません。VCの接続権限を自動設定できません');
            }
            await studyChannel.permissionOverwrites.edit(guild.roles.everyone, {
                Connect: false
            }, { reason: 'おべんきょVC: 勉強ロール必須化' });
            await studyChannel.permissionOverwrites.edit(studyRole, {
                Connect: true
            }, { reason: 'おべんきょVC: 勉強ロール保持者に接続を許可' });
            console.log(`[Study] VC接続権限を設定: @everyone=拒否 / ${STUDY_ROLE_NAME}=許可`);

            if (!botPermissions.has(PermissionFlagsBits.MoveMembers)) {
                console.error('[Study] Botに「メンバーを移動」権限がありません。権限設定で防げない入室の切断に失敗する可能性があります');
            }
        } catch (err) {
            console.error(`[Study] 必須ロールの初期化失敗 (${guild.id})。入室は fail-closed で拒否します: ${err.message}`);
        }
    }

    // voiceStateUpdate リスナーを登録
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
    // 【修正】client.once('ready') のネストを廃止し、ここで直接実行する
    //         （index.js の ready ハンドラ内から呼ばれるため ready は発火済み）
    for (const [, guild] of client.guilds.cache) {
        try {
            await guild.members.fetch(); // メンバーキャッシュを確実に構築
        } catch {
            continue;
        }
        for (const [, member] of guild.members.cache) {
            if (member.id === client.user.id) continue;
            if (member.voice.channel?.id !== STUDY_VC_ID) continue;

            // 起動時にもロールチェック（checkAndEnforceRole 内で API 取得）
            const wasKicked = await checkAndEnforceRole(member).catch(async err => {
                console.error(`[Study] 起動時の入室資格確認に失敗 (${member.id}): ${err.message}`);
                await denyStudyEntry(member, '入室資格を確認できませんでした。管理者に連絡してください。');
                return true;
            });
            if (wasKicked) continue;

            sessions.set(member.id, { joinedAt: Date.now() });
            console.log(`[Study] 起動時セッション引き継ぎ: ${member.user.tag}`);
        }
    }
}
