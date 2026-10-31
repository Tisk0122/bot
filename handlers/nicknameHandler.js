// ==============================================
// handlers/nicknameHandler.js
// メッセージトリガー式のニックネーム変更システム
// 「ニックネーム」で始まるメッセージを検知し、
// 自分または他のユーザーのニックネームを変更する
// ==============================================

import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../utils/guildConfigStore.js';

const TRIGGER = 'ニックネーム';
const RESET_KEYWORDS = new Set(['リセット', 'reset', 'クリア', 'なし']);
const MAX_NICKNAME_LENGTH = 32;

function isResetKeyword(text) {
    return RESET_KEYWORDS.has(text.trim());
}

// ==============================================
// 「他人のニックネームを変更する」権限があるか
// (ニックネーム管理権限、または管理者ロールを持つか)
// ==============================================
function canManageOthersNickname(member) {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.ManageNicknames)) return true;
    const adminRoleId = getGuildConfig(member.guild.id).adminRoleId;
    if (adminRoleId && member.roles.cache.has(adminRoleId)) return true;
    return false;
}

function buildHelpEmbed() {
    return new EmbedBuilder()
        .setTitle('ニックネーム変更コマンド')
        .setDescription(
            'メッセージを送るだけで、自分やほかの人のニックネームを変更できます。\n\n' +
            '**使い方**\n' +
            '```\nニックネーム 新しい名前\n```\n' +
            '→ 自分のニックネームを変更します\n\n' +
            '```\nニックネーム @ユーザー 新しい名前\n```\n' +
            '→ 指定したユーザーのニックネームを変更します（要権限）\n\n' +
            '```\nニックネーム リセット\n```\n' +
            '→ 自分のニックネームを元(ユーザー名)に戻します\n\n' +
            '```\nニックネーム @ユーザー リセット\n```\n' +
            '→ 指定したユーザーのニックネームを元に戻します（要権限）\n\n' +
            '他の人のニックネームを変更するには「ニックネームの管理」権限、または管理者ロールが必要です。'
        )
        .setColor('#5865f2')
        .setFooter({ text: 'ニックネーム変更システム' });
}

// ==============================================
// メインハンドラー
// ==============================================
export async function handleNicknameMessage(message) {
    if (message.author.bot) return;
    if (!message.guild || !message.member) return;

    const content = message.content.trim();

    // トリガーワードで始まっていなければ何もしない
    const isExactTrigger = content === TRIGGER;
    const startsWithTrigger = content.startsWith(`${TRIGGER} `) || content.startsWith(`${TRIGGER}　`); // 全角スペースも許可
    if (!isExactTrigger && !startsWithTrigger) return;

    const rest = content.slice(TRIGGER.length).trim();

    // ------------------------------------------
    // 「ニックネーム」単体 → ヘルプ表示
    // ------------------------------------------
    if (!rest) {
        await message.reply({ embeds: [buildHelpEmbed()] }).catch(() => {});
        return;
    }

    // ------------------------------------------
    // 対象ユーザーの判定 (メンションがあればその人、なければ自分)
    // ------------------------------------------
    const mentionedMember = message.mentions.members?.first() || null;
    const targetMember = mentionedMember || message.member;
    const isSelf = targetMember.id === message.member.id;

    // メンション文字列を取り除いて、残りを新しい名前として扱う
    let nameArgument = rest;
    if (mentionedMember) {
        nameArgument = rest.replace(/<@!?\d+>/g, '').trim();
    }

    // ------------------------------------------
    // 他人のニックネームを変更する場合は権限チェック
    // ------------------------------------------
    if (!isSelf && !canManageOthersNickname(message.member)) {
        await message.reply('他のユーザーのニックネームを変更する権限がありません。').catch(() => {});
        return;
    }

    // ------------------------------------------
    // ボット側の権限・ロール階層チェック
    // ------------------------------------------
    const botMember = message.guild.members.me;

    if (!botMember.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        await message.reply('ボットに「ニックネームの管理」権限がありません。サーバー設定を確認してください。').catch(() => {});
        return;
    }

    if (targetMember.id === message.guild.ownerId) {
        await message.reply('サーバーオーナーのニックネームは変更できません（Discordの仕様上の制限です）。').catch(() => {});
        return;
    }

    if (targetMember.id !== botMember.id && botMember.roles.highest.position <= targetMember.roles.highest.position) {
        await message.reply('ボットのロールが対象ユーザーより下位のため、ニックネームを変更できません。ボットのロールをより上位に移動してください。').catch(() => {});
        return;
    }

    // ------------------------------------------
    // リセット処理
    // ------------------------------------------
    if (isResetKeyword(nameArgument)) {
        try {
            await targetMember.setNickname(null, `ニックネームリセット | 実行者: ${message.author.tag}`);
            await message.reply(
                isSelf
                    ? 'あなたのニックネームをリセットしました。'
                    : `${targetMember} のニックネームをリセットしました。`
            ).catch(() => {});
            console.log(`[INFO] ニックネームリセット: ${targetMember.user.tag} (${targetMember.id}) | 実行者: ${message.author.tag}`);
        } catch (err) {
            console.error('[ERROR] ニックネームリセット失敗:', err);
            await message.reply('ニックネームのリセットに失敗しました。').catch(() => {});
        }
        return;
    }

    // ------------------------------------------
    // 新しい名前の入力チェック
    // ------------------------------------------
    if (!nameArgument) {
        await message.reply('新しいニックネームを入力してください。例: `ニックネーム たろう`').catch(() => {});
        return;
    }

    if (nameArgument.length > MAX_NICKNAME_LENGTH) {
        await message.reply(`ニックネームは${MAX_NICKNAME_LENGTH}文字以内で入力してください。（現在: ${nameArgument.length}文字）`).catch(() => {});
        return;
    }

    // ------------------------------------------
    // ニックネーム変更処理
    // ------------------------------------------
    try {
        await targetMember.setNickname(nameArgument, `ニックネーム変更 | 実行者: ${message.author.tag}`);
        await message.reply(
            isSelf
                ? `あなたのニックネームを **${nameArgument}** に変更しました。`
                : `${targetMember} のニックネームを **${nameArgument}** に変更しました。`
        ).catch(() => {});
        console.log(`[INFO] ニックネーム変更: ${targetMember.user.tag} (${targetMember.id}) -> "${nameArgument}" | 実行者: ${message.author.tag}`);
    } catch (err) {
        console.error('[ERROR] ニックネーム変更失敗:', err);
        let errMsg = 'ニックネームの変更に失敗しました。';
        if (err.code === 50013) {
            errMsg = 'ボットに権限がないため変更できませんでした。ロールの位置や権限を確認してください。';
        }
        await message.reply(errMsg).catch(() => {});
    }
}
