// ==============================================
// commands/status-panel.js
// /status-panel setup  : ステータスパネルとボードを設置する
// /status-panel refresh: ボードを手動で最新化する
// ==============================================

import {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits
} from 'discord.js';
import {
    buildPanelEmbed,
    buildBoardMessage,
    buildPanelComponents,
    savePanelMessageIds,
    getPanelConfig,
    getGuildStatuses,
    refreshStatusBoard
} from '../handlers/statusHandler.js';

export const data = new SlashCommandBuilder()
    .setName('status-panel')
    .setDescription('ステータスパネルを管理します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub
            .setName('setup')
            .setDescription('ステータスパネルとボードをチャンネルに設置します。')
            .addChannelOption(opt =>
                opt
                    .setName('channel')
                    .setDescription('設置するテキストチャンネル')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('refresh')
            .setDescription('ステータスボードを手動で最新化します。')
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
        await handleSetup(interaction);
    } else if (sub === 'refresh') {
        await handleRefresh(interaction);
    }
}

// ==============================================
// setup: パネルとボードを新規設置
// ==============================================
async function handleSetup(interaction) {
    const channel = interaction.options.getChannel('channel');
    const guild = interaction.guild;

    await interaction.deferReply({ flags: 64 });

    try {
        const guildStatuses = getGuildStatuses(guild.id);
        const boardMessage = await buildBoardMessage(guildStatuses);

        // 既存パネルがあれば削除を試みる
        const existing = getPanelConfig(guild.id);
        if (existing?.channelId === channel.id) {
            const oldCh = await interaction.client.channels.fetch(existing.channelId).catch(() => null);
            if (oldCh) {
                await oldCh.messages.fetch(existing.boardMessageId).then(m => m.delete()).catch(() => {});
                await oldCh.messages.fetch(existing.panelMessageId).then(m => m.delete()).catch(() => {});
            }
        }

        // ① ボードメッセージ（上）
        const boardMsg = await channel.send(boardMessage);

        // ② パネルメッセージ（下）
        const panelMsg = await channel.send({
            embeds: [buildPanelEmbed(guildStatuses, null)],
            components: buildPanelComponents(guildStatuses, null)
        });

        // メッセージIDを保存
        savePanelMessageIds(guild.id, channel.id, panelMsg.id, boardMsg.id);

        console.log(`[StatusPanel] 設置完了: #${channel.name} | Board: ${boardMsg.id} | Panel: ${panelMsg.id}`);

        await interaction.editReply({
            content: `<#${channel.id}> にステータスパネルを設置しました。`
        });

    } catch (err) {
        console.error('[StatusPanel] setup エラー:', err);
        await interaction.editReply({
            content: `エラーが発生しました: ${err.message}\nボットに「メッセージを送信」権限があるか確認してください。`
        });
    }
}

// ==============================================
// refresh: ボードを手動更新
// ==============================================
async function handleRefresh(interaction) {
    const guild = interaction.guild;
    const cfg = getPanelConfig(guild.id);

    if (!cfg) {
        return interaction.reply({
            content: 'ステータスパネルが未設置です。先に `/status-panel setup` を実行してください。',
            flags: 64
        });
    }

    await interaction.deferReply({ flags: 64 });

    try {
        await refreshStatusBoard(interaction.client, guild.id);
        await interaction.editReply({ content: 'ステータスボードを更新しました。' });
    } catch (err) {
        console.error('[StatusPanel] refresh エラー:', err);
        await interaction.editReply({ content: `エラーが発生しました: ${err.message}` });
    }
}
