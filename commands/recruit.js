// ==============================================
// commands/recruit.js
// /recruit コマンド
// ゲームなどの参加者募集を作成する。
// 1) 指定チャンネルに募集Embed+意思表示ボタンを投稿
// 2) DM通知を「受け取る」に設定しているメンバー全員へ
//    同じ意思表示ボタン付きDMを送信
// ==============================================

import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { buildRecruitEmbed, buildRecruitButtons } from '../utils/recruitEmbed.js';
import { createRecruitment, getDmPreference } from '../utils/recruitStore.js';

export const data = new SlashCommandBuilder()
    .setName('recruit')
    .setDescription('ゲームなどの参加者募集を作成します。設定済みメンバーにはDMでも通知します。')
    .addStringOption(option =>
        option
            .setName('game')
            .setDescription('募集するゲーム/イベント名')
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('description')
            .setDescription('募集の詳細（ルール、条件など）')
    )
    .addStringOption(option =>
        option
            .setName('datetime')
            .setDescription('日時（例: 今すぐ / 21:00〜 / 未定）')
    )
    .addIntegerOption(option =>
        option
            .setName('capacity')
            .setDescription('定員')
            .setMinValue(1)
    )
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('募集を投稿するチャンネル（未指定ならこのチャンネル）')
            .addChannelTypes(ChannelType.GuildText)
    );

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const game        = interaction.options.getString('game', true);
    const description = interaction.options.getString('description');
    const datetime    = interaction.options.getString('datetime');
    const capacity    = interaction.options.getInteger('capacity');
    const channel     = interaction.options.getChannel('channel') || interaction.channel;

    if (!channel || typeof channel.send !== 'function') {
        return interaction.editReply('❌ このチャンネルには投稿できません。テキストチャンネルを指定してください。');
    }

    const recruitId = randomUUID();

    const recruit = {
        id: recruitId,
        guildId: interaction.guild.id,
        channelId: channel.id,
        messageId: null,
        hostId: interaction.user.id,
        game,
        description,
        datetime,
        capacity,
        createdAt: Date.now(),
        responses: {},
        dmMessages: {}
    };

    // ------------------------------------------
    // 1) チャンネルに募集メッセージを投稿
    // ------------------------------------------
    let sentMessage;
    try {
        sentMessage = await channel.send({
            embeds: [buildRecruitEmbed(recruit)],
            components: [buildRecruitButtons(recruitId)]
        });
    } catch (err) {
        console.error('[ERROR] 募集メッセージ送信失敗:', err);
        return interaction.editReply('❌ 募集メッセージの送信に失敗しました。ボットに「メッセージを送信」権限があるか確認してください。');
    }

    recruit.messageId = sentMessage.id;
    createRecruitment(recruitId, recruit);

    // 先に投稿完了を報告（DM送信には時間がかかるため）
    await interaction.editReply(
        `✅ <#${channel.id}> に募集を投稿しました。\n📨 通知を希望しているメンバーへDMを送信中です…`
    );

    // ------------------------------------------
    // 2) DM通知(受け取る設定のメンバーのみ)を送信
    // ------------------------------------------
    let members;
    try {
        members = await interaction.guild.members.fetch();
    } catch (err) {
        console.error('[ERROR] メンバー一覧取得失敗:', err);
        members = new Map();
    }

    let dmSent = 0;
    let dmSkipped = 0;
    let dmFailed = 0;
    const dmMessages = {};

    for (const [memberId, member] of members) {
        if (member.user.bot) continue;
        if (memberId === interaction.user.id) continue; // 主催者自身には送らない

        const pref = getDmPreference(interaction.guild.id, memberId);
        if (pref !== 'in') {
            dmSkipped++;
            continue;
        }

        try {
            const dm = await member.send({
                embeds: [buildRecruitEmbed(recruit, {
                    footerOverride: `${interaction.guild.name} からの募集通知 | 募集ID: ${recruitId}`
                })],
                components: [buildRecruitButtons(recruitId)]
            });
            dmMessages[memberId] = { channelId: dm.channel.id, messageId: dm.id };
            dmSent++;
        } catch (err) {
            dmFailed++;
        }

        // DMレート制限対策の小さな遅延
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (Object.keys(dmMessages).length > 0) {
        recruit.dmMessages = dmMessages;
        createRecruitment(recruitId, recruit);
    }

    console.log(`[INFO] 募集作成: ${interaction.user.tag} | ゲーム: ${game} | DM送信=${dmSent} スキップ=${dmSkipped} 失敗=${dmFailed}`);

    await interaction.editReply(
        `✅ <#${channel.id}> に募集を投稿しました。\n` +
        `📨 DM送信: **${dmSent}件** | 🔕 通知オフ/未設定: **${dmSkipped}件** | ⚠ 送信失敗: **${dmFailed}件**\n\n` +
        '💡 メンバーは `/recruit-notify` でいつでもDM通知のオン/オフを変更できます。'
    );
}
