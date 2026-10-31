// ==============================================
// commands/discord-status.js
// /discord-status コマンド
// Discordの公式ステータスを即時確認できるスラッシュコマンド
// ==============================================

import { SlashCommandBuilder } from 'discord.js';
import { fetchCurrentStatus } from '../handlers/discordStatusMonitor.js';

export const data = new SlashCommandBuilder()
    .setName('discord-status')
    .setDescription('Discordの現在の公式ステータスを確認します');

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
        const { embeds, activeCount } = await fetchCurrentStatus();

        let content = '';
        if (activeCount > 0) {
            content = `現在、**${activeCount}件**のインシデントが発生しています。`;
        }

        await interaction.editReply({
            content: content || null,
            embeds,
        });
    } catch (err) {
        console.error('[discord-status] コマンドエラー:', err);
        await interaction.editReply({
            content: 'ステータスを取得できませんでした。時間をおいて再試行してください。\n公式情報：https://discordstatus.com',
        });
    }
}
