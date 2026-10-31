// ==============================================
// commands/discord-status.js
// /discord-status コマンド
// Discord公式ステータスを画像付きで即時確認する。
// ==============================================

import { SlashCommandBuilder } from 'discord.js';
import { fetchCurrentStatus } from '../handlers/discordStatusMonitor.js';

export const data = new SlashCommandBuilder()
    .setName('discord-status')
    .setDescription('Discordの現在の公式ステータスを画像付きで確認します');

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
        const { embeds, files, activeCount } = await fetchCurrentStatus();
        const content = activeCount > 0
            ? `現在、**${activeCount}件**のインシデントが発生しています。`
            : null;
        await interaction.editReply({ content, embeds, files });
    } catch (error) {
        console.error('[discord-status] コマンドエラー:', error);
        await interaction.editReply({
            content: 'ステータスを取得できませんでした。時間をおいて再試行してください。\n公式情報：https://discordstatus.com',
            embeds: [],
            files: [],
        });
    }
}
