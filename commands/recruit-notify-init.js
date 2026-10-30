// ==============================================
// commands/recruit-notify-init.js
// /recruit-notify-init コマンド (管理者専用)
// 「一番初めに」今いるサーバーメンバー全員に対し、
// 募集DM通知を受け取るか受け取らないかを
// 設定してもらうためのDMを一括送信する
// ==============================================

import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { getDmPreference } from '../utils/recruitStore.js';

export const data = new SlashCommandBuilder()
    .setName('recruit-notify-init')
    .setDescription('【管理者用】サーバーメンバー全員に募集DM通知の初期設定を促すDMを一括送信します。')
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

    let members;
    try {
        members = await interaction.guild.members.fetch();
    } catch (err) {
        console.error('[ERROR] メンバー一覧取得失敗:', err);
        return interaction.editReply('メンバー一覧の取得に失敗しました。ボットの権限（メンバー閲覧）を確認してください。');
    }

    let sent = 0;
    let alreadySet = 0;
    let failed = 0;
    let skippedBots = 0;

    for (const [memberId, member] of members) {
        if (member.user.bot) {
            skippedBots++;
            continue;
        }

        const existing = getDmPreference(interaction.guild.id, memberId);
        if (existing) {
            alreadySet++;
            continue;
        }

        const ok = await sendPreferenceSetupDm(member, interaction.guild);
        if (ok) sent++; else failed++;

        // DMレート制限対策の小さな遅延
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`[INFO] 募集DM通知の初期設定を実行: ${interaction.user.tag} | 送信=${sent} 設定済=${alreadySet} 失敗=${failed}`);

    await interaction.editReply(
        '初期設定DMの送信が完了しました。\n\n' +
        `送信済み: **${sent}件**\n` +
        `すでに設定済みでスキップ: **${alreadySet}件**\n` +
        `送信失敗（DMを閉じている等）: **${failed}件**\n` +
        `ボットを除外: **${skippedBots}件**\n\n` +
        '今後新しく参加するメンバーには自動で設定DMが送られます。\n' +
        '未対応のメンバーには、必要に応じてこのコマンドを再実行してください（設定済みの人には再送されません）。'
    );
}
