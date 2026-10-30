// ==============================================
// utils/recruitEmbed.js
// 募集メッセージ(Embed / ボタン)の共通ビルダー
// チャンネル投稿・DM送信の両方で同じ見た目を使う
// ==============================================

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const RESPONSE_META = {
    join:    { label: '参加する',   style: ButtonStyle.Success   },
    decline: { label: '参加しない', style: ButtonStyle.Danger    },
    unsure:  { label: 'わからない', style: ButtonStyle.Secondary }
};

// ==============================================
// 意思表示ボタン (参加する / 参加しない / わからない)
// ==============================================
export function buildRecruitButtons(recruitId, disabled = false) {
    const row = new ActionRowBuilder();
    for (const [action, meta] of Object.entries(RESPONSE_META)) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`recruit_resp:${recruitId}:${action}`)
                .setLabel(meta.label)
                .setStyle(meta.style)
                .setDisabled(disabled)
        );
    }
    return row;
}

// ==============================================
// 主催者専用の募集終了ボタン
// ==============================================
export function buildRecruitCloseButton(recruitId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`recruit_close:${recruitId}`)
            .setLabel('募集を終了する')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

function formatUserList(userIds) {
    if (!userIds || userIds.length === 0) return 'まだいません';
    const MAX = 15;
    const shown = userIds.slice(0, MAX).map(id => `<@${id}>`);
    let text = shown.join('\n');
    if (userIds.length > MAX) {
        text += `\n...ほか ${userIds.length - MAX}人`;
    }
    return text;
}

// ==============================================
// 有効期限のフォーマット
// ==============================================
function formatExpiry(expiresAt) {
    if (!expiresAt) return null;
    return `<t:${Math.floor(expiresAt / 1000)}:R>`;
}

// ==============================================
// 募集Embed本体 (通常・進行中)
// ==============================================
export function buildRecruitEmbed(recruit, { footerOverride } = {}) {
    const responses   = recruit.responses || {};
    const joinIds    = Object.entries(responses).filter(([, v]) => v === 'join').map(([id]) => id);
    const declineIds = Object.entries(responses).filter(([, v]) => v === 'decline').map(([id]) => id);
    const unsureIds  = Object.entries(responses).filter(([, v]) => v === 'unsure').map(([id]) => id);

    const embed = new EmbedBuilder()
        .setTitle(`参加者募集: ${recruit.game}`)
        .setDescription(recruit.description || '詳細なし')
        .setColor(0x00aaff)
        .addFields({ name: '主催者', value: `<@${recruit.hostId}>`, inline: true });

    if (recruit.datetime) {
        embed.addFields({ name: '日時', value: recruit.datetime, inline: true });
    }

    if (recruit.capacity) {
        embed.addFields({ name: '定員', value: `${joinIds.length} / ${recruit.capacity}`, inline: true });
    }

    if (recruit.expiresAt) {
        embed.addFields({ name: '募集終了', value: formatExpiry(recruit.expiresAt), inline: true });
    }

    embed.addFields(
        { name: `参加する (${joinIds.length})`,   value: formatUserList(joinIds) },
        { name: `参加しない (${declineIds.length})`, value: formatUserList(declineIds) },
        { name: `わからない (${unsureIds.length})`,  value: formatUserList(unsureIds) }
    );

    embed
        .setTimestamp(recruit.createdAt)
        .setFooter({ text: footerOverride || `募集ID: ${recruit.id}` });

    return embed;
}

// ==============================================
// 終了済み募集のEmbed
// ==============================================
export function buildClosedRecruitEmbed(recruit, reason = '終了') {
    const responses   = recruit.responses || {};
    const joinIds    = Object.entries(responses).filter(([, v]) => v === 'join').map(([id]) => id);
    const declineIds = Object.entries(responses).filter(([, v]) => v === 'decline').map(([id]) => id);
    const unsureIds  = Object.entries(responses).filter(([, v]) => v === 'unsure').map(([id]) => id);

    const embed = new EmbedBuilder()
        .setTitle(`[終了] 参加者募集: ${recruit.game}`)
        .setDescription(recruit.description || '詳細なし')
        .setColor(0x808080)
        .addFields({ name: '主催者', value: `<@${recruit.hostId}>`, inline: true });

    if (recruit.datetime) {
        embed.addFields({ name: '日時', value: recruit.datetime, inline: true });
    }

    if (recruit.capacity) {
        embed.addFields({ name: '定員', value: `${joinIds.length} / ${recruit.capacity}`, inline: true });
    }

    embed.addFields(
        { name: `参加する (${joinIds.length})`,   value: formatUserList(joinIds) },
        { name: `参加しない (${declineIds.length})`, value: formatUserList(declineIds) },
        { name: `わからない (${unsureIds.length})`,  value: formatUserList(unsureIds) }
    );

    embed
        .setTimestamp(Date.now())
        .setFooter({ text: `募集終了 (${reason}) | 募集ID: ${recruit.id}` });

    return embed;
}
