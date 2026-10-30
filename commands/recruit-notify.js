// ==============================================
// commands/recruit-notify.js
// /recruit-notify コマンド
// 各メンバーが自分の「募集DM通知」設定を
// いつでも確認・変更できるようにする
// ==============================================

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getDmPreference } from '../utils/recruitStore.js';

export const data = new SlashCommandBuilder()
    .setName('recruit-notify')
    .setDescription('募集(ゲーム参加者募集など)のDM通知を受け取るかどうかを設定します。');

export async function execute(interaction) {
    const current = getDmPreference(interaction.guild.id, interaction.user.id);

    const statusText =
        current === 'in'  ? '受け取る' :
        current === 'out' ? '受け取らない' :
        '未設定';

    const embed = new EmbedBuilder()
        .setTitle('募集DM通知設定')
        .setDescription(
            'サーバーで募集(ゲームの参加者募集など)が作成されたとき、\n' +
            'DMで通知を受け取るかどうかを設定できます。\n\n' +
            `現在の設定: **${statusText}**`
        )
        .setColor('#5865f2');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pref_set:${interaction.guild.id}:in`)
            .setLabel('受け取る')
            .setStyle(current === 'in' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`pref_set:${interaction.guild.id}:out`)
            .setLabel('受け取らない')
            .setStyle(current === 'out' ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
