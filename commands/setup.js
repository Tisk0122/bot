// ==============================================
// commands/setup.js
// /setup-verify コマンド
// 認証ボードをチャンネルに設置する
// ==============================================

import 'dotenv/config';
import { getGuildConfig } from '../utils/guildConfigStore.js';
import {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';

// --- 環境変数の読み込み ---

// ==============================================
// コマンド定義
// ==============================================
export const data = new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('認証ボードを設置します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('認証ボードを設置するチャンネル')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    );

// ==============================================
// コマンド実行
// ==============================================
export async function execute(interaction) {
    const channel = interaction.options.getChannel('channel');

    // 環境変数チェック
    const verificationChannelId = getGuildConfig(interaction.guild.id).verificationChannelId;
    if (!verificationChannelId) {
        return interaction.reply({
            content: '認証チャンネルが未設定です。管理者ダッシュボードの「サーバー設定」から指定してください。',
            ephemeral: true
        });
    }

    // 指定されたチャンネルが認証チャンネルと一致するか確認
    if (channel.id !== verificationChannelId) {
        return interaction.reply({
            content: `指定したチャンネルが認証チャンネルと異なります。\n認証チャンネル: <#${verificationChannelId}> を指定してください。`,
            ephemeral: true
        });
    }

    // 認証ボードのEmbedを作成
    const embed = new EmbedBuilder()
        .setTitle('サーバー認証')
        .setDescription(
            '下のボタンを押してサーバーメンバーとして認証してください。\n\n' +
            '認証が完了すると、管理者による承認後にサーバーの全チャンネルにアクセスできるようになります。'
        )
        .setColor('#0099ff')
        .setFooter({ text: `${interaction.guild.name} 認証システム` })
        .setTimestamp();

    // 認証ボタンを作成
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('verify_user_button')
                .setLabel('認証する')
                .setStyle(ButtonStyle.Success)
        );

    try {
        await channel.send({ embeds: [embed], components: [row] });

        console.log(`[INFO] 認証ボードを設置しました: #${channel.name} (${channel.id}) | 実行者: ${interaction.user.tag}`);

        return interaction.reply({
            content: `<#${channel.id}> に認証ボードを設置しました。`,
            ephemeral: true
        });
    } catch (err) {
        console.error('[ERROR] 認証ボードの設置失敗:', err);
        return interaction.reply({
            content: 'エラー: 認証ボードの設置に失敗しました。ボットに「メッセージを送信」権限があるか確認してください。',
            ephemeral: true
        });
    }
}