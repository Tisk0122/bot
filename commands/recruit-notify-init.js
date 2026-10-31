// ==============================================
// commands/recruit-notify-init.js
// /recruit-notify-init コマンド (管理者専用)
// 通知未設定のキャッシュ済みメンバーへ、
// 募集DM通知を受け取るかどうかを設定するDMを送信する。
// Gateway Opcode 8を避けるため、一度に最大50人まで処理する。
// ==============================================

import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { getAllPreferences, getAllDmPrompts, markDmPrompted } from '../utils/recruitStore.js';

export const data = new SlashCommandBuilder()
    .setName('recruit-notify-init')
    .setDescription('【管理者用】未設定のキャッシュ済みメンバーに募集DM通知の初期案内を送信します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ==============================================
// 設定依頼DMを1人に送信する (他ハンドラーからも再利用)
// ==============================================
export async function sendPreferenceSetupDm(member, guild) {
    const embed = new EmbedBuilder()
        .setTitle('募集DM通知の設定')
        .setDescription(
            `**${guild.name}** では、ゲームなどの参加者募集が立てられたとき、\n` +
            '希望する方にDMで通知をお届けする機能があります。\n\n' +
            '下のボタンから、このDM通知を受け取るかどうかを設定してください。\n' +
            '設定はいつでも `/recruit-notify` コマンドで変更できます。'
        )
        .setColor('#5865f2')
        .setFooter({ text: guild.name })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pref_set:${guild.id}:in`)
            .setLabel('受け取る')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`pref_set:${guild.id}:out`)
            .setLabel('受け取らない')
            .setStyle(ButtonStyle.Secondary)
    );

    try {
        await member.send({ embeds: [embed], components: [row] });
        return true;
    } catch (err) {
        return false;
    }
}

// ==============================================
// コマンド実行
// ==============================================
export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // 全メンバーfetchはGateway Opcode 8のレート制限を招くためキャッシュのみ利用する。
    const members = interaction.guild.members.cache;

    let sent = 0;
    let failed = 0;
    let processed = 0;
    const cachedList = [...members.values()];
    const skippedBots = cachedList.filter(member => member.user.bot).length;
    const preferences = getAllPreferences(interaction.guild.id);
    const prompted = getAllDmPrompts(interaction.guild.id);
    const alreadySet = cachedList.filter(member => !member.user.bot && Boolean(preferences[member.id])).length;
    const alreadyPrompted = cachedList.filter(member => !member.user.bot && Boolean(prompted[member.id]) && !preferences[member.id]).length;
    const candidates = cachedList.filter(member => !member.user.bot && !preferences[member.id] && !prompted[member.id]);
    const batch = candidates.slice(0, 50);

    for (const member of batch) {
        processed++;
        const ok = await sendPreferenceSetupDm(member, interaction.guild);
        if (ok) { sent++; markDmPrompted(interaction.guild.id, member.id); } else failed++;

        // DMレート制限対策の小さな遅延
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`[INFO] 募集DM通知の初期設定を実行: ${interaction.user.tag} | 送信=${sent} 対象=${processed} 失敗=${failed}`);

    await interaction.editReply(
        '初期設定DMの送信が完了しました。\n\n' +
        `送信済み: **${sent}件**\n` +
        `すでに設定済みでスキップ: **${alreadySet}件**\n` +
        `送信失敗（DMを閉じている等）: **${failed}件**\n` +
        `ボットを除外: **${skippedBots}件**\n` +
        `案内送信済み・未回答: **${alreadyPrompted}件**\n` +
        `キャッシュ内の未処理: **${Math.max(0, candidates.length - batch.length) + failed}件**\n` +
        `未キャッシュのメンバー（概算）: **${Math.max(0, (interaction.guild.memberCount ?? members.size) - members.size)}人**\n\n` +
        'Gatewayの全メンバー取得は行いません。未処理が残る場合は再実行してください。\n' +
        '今後新しく参加するメンバーには自動で設定DMが送られます。'
    );
}
