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
            content = `🚨 **${activeCount}件のアクティブなインシデントが発生中です！**`;
        }

        await interaction.editReply({
            content: content || null,
            embeds,
        });
    } catch (err) {
        console.error('[discord-status] コマンドエラー:', err);
        await interaction.editReply({
            content: '❌ ステータスの取得に失敗しました。しばらく経ってから再試行してください。\n直接確認: https://discordstatus.com',
        });
    }
}
