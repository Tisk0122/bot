// ==============================================
// handlers/buttonHandler.js
// ボタンインタラクションを管理するハンドラー
// 認証申請・承認・拒否ボタンを処理する
// ==============================================

import 'dotenv/config';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { logAction } from '../utils/logger.js';
import { setDmPreference, getRecruitment, updateRecruitment, closeRecruitment } from '../utils/recruitStore.js';
import { buildRecruitEmbed, buildRecruitButtons, buildRecruitCloseButton } from '../utils/recruitEmbed.js';
import { getGuildConfig } from '../utils/guildConfigStore.js';
import { handleStatusButton } from './statusHandler.js';


// 管理者ロールが未設定でも、Discord標準のAdministrator権限を持つユーザーは
// 管理操作を行える。管理者ロールが設定されている場合は、そのロール保持者も許可する。
function hasAdminAccess(member, guildId) {
    if (!member) return false;
    const adminRoleId = getGuildConfig(guildId).adminRoleId;
    const hasAdministrator = member.permissions?.has?.(PermissionFlagsBits.Administrator) ?? false;
    const hasConfiguredRole = Boolean(adminRoleId && member.roles?.cache?.has?.(adminRoleId));
    return hasAdministrator || hasConfiguredRole;
}


// ==============================================
// 認証ボタン押下処理 (ユーザーが認証を申請する)
// ==============================================
async function handleVerifyUser(interaction) {
    const { member } = interaction;

    const config = getGuildConfig(interaction.guild.id);
    const moderationChannelId = config.moderationChannelId;
    const verifiedRoleId = config.verifiedRoleId;

    // 認証設定チェック
    if (!moderationChannelId || !verifiedRoleId) {
        return interaction.reply({
            content: 'エラー: 認証システムの設定が不完全です。管理者に連絡してください。',
            flags: 64
        });
    }

    // 既に認証済みかチェック
    if (member.roles.cache.has(verifiedRoleId)) {
        return interaction.reply({ content: 'あなたはすでに認証済みです。', flags: 64 });
    }

    // モデレーションチャンネルを取得
    const moderationChannel = interaction.client.channels.cache.get(moderationChannelId)
        ?? await interaction.client.channels.fetch(moderationChannelId).catch(() => null);
    if (!moderationChannel) {
        console.error(`[ERROR] モデレーションチャンネルが見つかりません: ${moderationChannelId}`);
        return interaction.reply({
            content: 'エラーが発生しました。管理者に連絡してください。',
            flags: 64
        });
    }

    // 認証申請Embedを作成
    const embed = new EmbedBuilder()
        .setTitle('認証申請')
        .setDescription(`${member} (${member.user.tag}) が認証を申請しました。`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: 'ユーザー名',       value: member.user.tag,                                                          inline: true },
            { name: 'ユーザーID',       value: member.id,                                                                inline: true },
            { name: '​',           value: '​',                                                                 inline: true },
            { name: 'アカウント作成日', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,               inline: true },
            { name: 'サーバー参加日',   value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,                     inline: true }
        )
        .setColor('#ffc107')
        .setTimestamp()
        .setFooter({ text: '認証申請システム' });

    // 承認・拒否ボタンを作成
    const actionRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_user:${member.id}`)
                .setLabel('承認')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`deny_user:${member.id}`)
                .setLabel('拒否')
                .setStyle(ButtonStyle.Danger)
        );

    try {
        await moderationChannel.send({ embeds: [embed], components: [actionRow] });
        console.log(`[INFO] 認証申請送信: ${member.user.tag} (${member.id})`);
        return interaction.reply({
            content: '認証申請を送信しました。管理者の承認をお待ちください。',
            flags: 64
        });
    } catch (err) {
        console.error('[ERROR] モデレーションチャンネルへの送信失敗:', err);
        return interaction.reply({
            content: 'エラー: 認証申請の送信に失敗しました。管理者に連絡してください。',
            flags: 64
        });
    }
}

// ==============================================
// 承認ボタン処理 (管理者がユーザーを承認する)
// ==============================================
async function handleApproval(interaction, userId) {
    const { member, guild } = interaction;

    const config = getGuildConfig(guild.id);
    const verifiedRoleId = config.verifiedRoleId;

    // 認証設定チェック
    if (!verifiedRoleId) {
        return interaction.reply({
            content: 'エラー: 認証システムの設定が不完全です。',
            flags: 64
        });
    }

    // 管理者権限チェック（Administrator または設定済み管理者ロール）
    if (!hasAdminAccess(member, guild.id)) {
        return interaction.reply({ content: 'この操作を行う権限がありません。', flags: 64 });
    }

    // 対象ユーザーを取得
    const targetMember = await guild.members.fetch(userId).catch(() => null);
    if (!targetMember) {
        // ユーザーがサーバーにいない場合はボタンを無効化して終了
        const disabledRow = disableAllButtons(interaction.message);
        return interaction.update({
            content: '対象ユーザーがサーバーに存在しません。',
            components: [disabledRow]
        });
    }

    // ボットの権限チェック
    const botMember = guild.members.me;

    if (!botMember.permissions.has('ManageRoles')) {
        return interaction.reply({
            content: 'ボットに「ロールの管理」権限がありません。サーバー設定を確認してください。',
            flags: 64
        });
    }

    // 認証ロールの取得
    const verifiedRole = guild.roles.cache.get(verifiedRoleId);
    if (!verifiedRole) {
        return interaction.reply({
            content: '認証ロールが見つかりません。VERIFIED_ROLE_ID の設定を確認してください。',
            flags: 64
        });
    }

    // ロール階層チェック
    if (botMember.roles.highest.position <= verifiedRole.position) {
        return interaction.reply({
            content: `ボットのロールが認証ロール「${verifiedRole.name}」より下位にあるため、ロールを付与できません。\nDiscordサーバー設定でボットのロールを認証ロールより上位に移動してください。`,
            flags: 64
        });
    }

    // 既に認証済みかチェック
    if (targetMember.roles.cache.has(verifiedRoleId)) {
        const disabledRow = disableAllButtons(interaction.message);
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#28a745')
            .setFooter({ text: `既に認証済み (確認者: ${member.user.tag}) | ${new Date().toLocaleString('ja-JP')}` });
        return interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });
    }

    try {
        // ロール付与
        await targetMember.roles.add(verifiedRoleId, `承認者: ${member.user.tag}`);

        // Embedを承認済みに更新
        const disabledRow = disableAllButtons(interaction.message);
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor('#28a745')
            .setFooter({ text: `承認者: ${member.user.tag} | ${new Date().toLocaleString('ja-JP')}` });

        await interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });

        // DMで通知
        try {
            await targetMember.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('認証完了')
                        .setDescription(`**${guild.name}** での認証が承認されました！\n\nサーバーの全チャンネルにアクセスできるようになりました。`)
                        .setColor('#28a745')
                        .setTimestamp()
                        .setFooter({ text: guild.name })
                ]
            });
        } catch (dmErr) {
            console.log(`[INFO] DMを送信できませんでした (ユーザー: ${targetMember.id}): ${dmErr.message}`);
        }

        console.log(`[INFO] 認証承認: ${targetMember.user.tag} (${targetMember.id}) | 承認者: ${member.user.tag}`);

        logAction(guild, { action: 'VERIFY', executor: member.user, target: targetMember.user, details: '認証承認' }).catch(() => {});

    } catch (err) {
        console.error('[ERROR] ロール付与失敗:', err);

        let errorMessage = 'ロールの付与に失敗しました。';
        if (err.code === 50013) {
            errorMessage = 'ボットに必要な権限がありません。「ロールの管理」権限とロール階層を確認してください。';
        }

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, flags: 64 });
            } else {
                await interaction.followUp({ content: errorMessage, flags: 64 });
            }
        } catch (replyErr) {
            console.error('[ERROR] エラー返信にも失敗:', replyErr);
        }
    }
}

// ==============================================
// 拒否ボタン処理 (管理者がユーザーを拒否する)
// ==============================================
async function handleDenial(interaction, userId) {
    const { member, guild } = interaction;

    // 管理者権限チェック（Administrator または設定済み管理者ロール）
    if (!hasAdminAccess(member, guild.id)) {
        return interaction.reply({ content: 'この操作を行う権限がありません。', flags: 64 });
    }

    // 対象ユーザーを取得
    const targetMember = await guild.members.fetch(userId).catch(() => null);

    // Embedを拒否済みに更新
    const disabledRow = disableAllButtons(interaction.message);
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#dc3545')
        .setFooter({ text: `拒否者: ${member.user.tag} | ${new Date().toLocaleString('ja-JP')}` });

    await interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });

    // DMで通知 (ユーザーがサーバーにいる場合のみ)
    if (targetMember) {
        try {
            await targetMember.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('認証拒否')
                        .setDescription(`**${guild.name}** での認証申請が拒否されました。\n\nご不明な点がある場合は、サーバーの管理者にお問い合わせください。`)
                        .setColor('#dc3545')
                        .setTimestamp()
                        .setFooter({ text: guild.name })
                ]
            });
        } catch (dmErr) {
            console.log(`[INFO] DMを送信できませんでした (ユーザー: ${targetMember.id}): ${dmErr.message}`);
        }

        console.log(`[INFO] 認証拒否: ${targetMember.user.tag} (${targetMember.id}) | 拒否者: ${member.user.tag}`);

        logAction(guild, { action: 'VERIFY', executor: member.user, target: targetMember.user, details: '認証拒否' }).catch(() => {});
    } else {
        console.log(`[INFO] 認証拒否: ユーザーID ${userId} (サーバー外) | 拒否者: ${member.user.tag}`);

        logAction(guild, { action: 'VERIFY', executor: member.user, details: `認証拒否 (ユーザーID: ${userId}, サーバー外)` }).catch(() => {});
    }
}

// ==============================================
// 募集DM通知設定ボタン処理
// customId: pref_set:<guildId>:<in|out>
// ==============================================
async function handlePreferenceSet(interaction, guildId, value) {
    setDmPreference(guildId, interaction.user.id, value);

    const label = value === 'in' ? '受け取る' : '受け取らない';
    const guild = interaction.client.guilds.cache.get(guildId);
    const guildName = guild ? guild.name : 'サーバー';

    const embed = new EmbedBuilder()
        .setTitle('募集DM通知設定')
        .setDescription(
            `**${guildName}** の募集DM通知設定を **${label}** に変更しました。\n\n` +
            '設定はいつでも `/recruit-notify` コマンドで変更できます。'
        )
        .setColor(value === 'in' ? '#28a745' : '#6c757d')
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pref_set:${guildId}:in`)
            .setLabel('受け取る')
            .setStyle(value === 'in' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`pref_set:${guildId}:out`)
            .setLabel('受け取らない')
            .setStyle(value === 'out' ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );

    try {
        await interaction.update({ embeds: [embed], components: [row] });
    } catch (err) {
        // 何らかの理由でupdateできない場合はreplyにフォールバック
        await interaction.reply({ embeds: [embed], components: [row], flags: 64 }).catch(() => {});
    }

    console.log(`[INFO] 募集DM通知設定変更: ${interaction.user.tag} (${interaction.user.id}) -> ${value} | guild: ${guildId}`);
}

// ==============================================
// 募集への意思表示ボタン処理
// customId: recruit_resp:<recruitId>:<join|decline|unsure>
// ==============================================
async function handleRecruitResponse(interaction, recruitId, action) {
    const recruit = getRecruitment(recruitId);

    if (!recruit) {
        return interaction.reply({
            content: 'この募集は見つかりませんでした（削除されたか、期限切れの可能性があります）。',
            flags: 64
        }).catch(() => {});
    }

    // 定員チェック（参加希望 かつ 未参加者 かつ 定員設定がある場合のみ）
    if (action === 'join' && recruit.capacity) {
        const currentJoinCount = Object.values(recruit.responses || {}).filter(v => v === 'join').length;
        const alreadyJoined = recruit.responses?.[interaction.user.id] === 'join';
        if (!alreadyJoined && currentJoinCount >= recruit.capacity) {
            return interaction.reply({
                content: `この募集は定員 (${recruit.capacity}人) に達しています。「わからない」などでの意思表示は引き続き可能です。`,
                flags: 64
            }).catch(() => {});
        }
    }

    const updated = updateRecruitment(recruitId, r => {
        if (!r.responses) r.responses = {};
        r.responses[interaction.user.id] = action;
    });

    if (!updated) {
        return interaction.reply({
            content: '募集データの更新に失敗しました。もう一度お試しください。',
            flags: 64
        }).catch(() => {});
    }

    const embed = buildRecruitEmbed(updated);
    const row   = buildRecruitButtons(recruitId);

    // クリックされたメッセージ自体を更新
    // チャンネルメッセージには終了ボタンも含める、DMには含めない
    const isInGuild = interaction.guild !== null;
    const components = isInGuild
        ? [row, buildRecruitCloseButton(recruitId)]
        : [row];

    try {
        await interaction.update({ embeds: [embed], components });
    } catch (err) {
        console.error('[ERROR] 募集メッセージ更新失敗 (クリック元):', err);
    }

    // クリック元がサーバーチャンネルの元メッセージ「以外」(=DM等)なら、
    // サーバー内の本体メッセージも同期して更新する
    const isOriginalChannelMessage = interaction.message?.id === updated.messageId;
    if (!isOriginalChannelMessage) {
        try {
            const channel = await interaction.client.channels.fetch(updated.channelId);
            const originalMessage = await channel.messages.fetch(updated.messageId);
            await originalMessage.edit({ embeds: [embed], components: [row] });
        } catch (err) {
            console.log(`[INFO] 元の募集メッセージの同期更新に失敗（削除された可能性）: ${err.message}`);
        }
    }

    // DMでの回答の場合は完了メッセージを追加送信
    if (interaction.channel?.isDMBased?.()) {
        const label = { join: '参加する', decline: '参加しない', unsure: 'わからない' }[action];
        await interaction.followUp({ content: `「${label}」で回答を記録しました。`, flags: 64 }).catch(() => {});
    }

    console.log(`[INFO] 募集回答: ${interaction.user.tag} (${interaction.user.id}) -> ${action} | 募集ID: ${recruitId}`);
}

// ==============================================
// 募集終了ボタン処理 (主催者または管理者のみ)
// customId: recruit_close:<recruitId>
// ==============================================
async function handleRecruitClose(interaction, recruitId) {
    const recruit = getRecruitment(recruitId);

    if (!recruit) {
        return interaction.reply({
            content: 'この募集は見つかりませんでした（すでに終了している可能性があります）。',
            flags: 64
        }).catch(() => {});
    }

    // 主催者または管理者のみ終了可能
    const isHost  = recruit.hostId === interaction.user.id;
    const isAdmin = hasAdminAccess(interaction.member, interaction.guild.id);

    if (!isHost && !isAdmin) {
        return interaction.reply({
            content: '募集を終了できるのは主催者または管理者のみです。',
            flags: 64
        }).catch(() => {});
    }

    // 終了処理
    const closed = await closeRecruitment(recruitId, interaction.client, `${interaction.user.tag} が手動終了`);

    if (closed) {
        await interaction.reply({
            content: `「${recruit.game}」の募集を終了しました。`,
            flags: 64
        }).catch(() => {});
    } else {
        await interaction.reply({
            content: '募集の終了処理中にエラーが発生しました。',
            flags: 64
        }).catch(() => {});
    }

    console.log(`[INFO] 募集手動終了: ${interaction.user.tag} | 募集ID: ${recruitId} | ゲーム: ${recruit.game}`);
}

// ==============================================
// ユーティリティ: 全ボタンを無効化したActionRowを返す
// ==============================================
function disableAllButtons(message) {
    const disabledRow = new ActionRowBuilder();
    const firstRow = message.components?.[0];
    if (!firstRow) return disabledRow;
    firstRow.components.forEach(component => {
        disabledRow.addComponents(ButtonBuilder.from(component).setDisabled(true));
    });
    return disabledRow;
}

// ==============================================
// メインエクスポート: ボタンインタラクションのルーティング
// ==============================================
export async function handleButtonInteraction(interaction) {
    const { customId } = interaction;

    if (customId === 'verify_user_button') {
        await handleVerifyUser(interaction);

    } else if (customId.startsWith('approve_user:')) {
        const userId = customId.split(':')[1];
        await handleApproval(interaction, userId);

    } else if (customId.startsWith('deny_user:')) {
        const userId = customId.split(':')[1];
        await handleDenial(interaction, userId);

    } else if (customId.startsWith('pref_set:')) {
        const [, guildId, value] = customId.split(':');
        await handlePreferenceSet(interaction, guildId, value);

    } else if (customId.startsWith('recruit_resp:')) {
        const [, recruitId, action] = customId.split(':');
        await handleRecruitResponse(interaction, recruitId, action);

    } else if (customId.startsWith('recruit_close:')) {
        const recruitId = customId.split(':')[1];
        await handleRecruitClose(interaction, recruitId);

    } else if (customId.startsWith('status:')) {
        await handleStatusButton(interaction);

    } else {
        console.warn(`[WARNING] 未知のボタンインタラクション: ${customId}`);
    }
}
