// ==============================================
// handlers/banHandler.js
// BANチャンネルでのメッセージを処理するハンドラー
// BAN・BAN解除・BANリスト表示を管理する
// ==============================================

import 'dotenv/config';
import { EmbedBuilder } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { logAction } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- 環境変数の読み込み ---
const BAN_CHANNEL_ID = process.env.BAN_CHANNEL_ID;
const ADMIN_ROLE_ID  = process.env.ADMIN_ROLE_ID;

// 起動時に環境変数を検証
if (!BAN_CHANNEL_ID || !ADMIN_ROLE_ID) {
    console.error('[ERROR] banHandler: 必須の環境変数が不足しています:');
    if (!BAN_CHANNEL_ID) console.error('  - BAN_CHANNEL_ID');
    if (!ADMIN_ROLE_ID)  console.error('  - ADMIN_ROLE_ID');
}

// BANデータの保存先 (プロジェクトルートの data/ フォルダ)
const DATA_FILE = path.join(__dirname, '..', 'data', 'ban_data.json');

// ==============================================
// データファイルの読み書き
// ==============================================
function loadBanData() {
    try {
        const dataDir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            return raw.trim() ? JSON.parse(raw) : {};
        }
    } catch (err) {
        console.error('[ERROR] BANデータ読み込み失敗:', err);
    }
    return {};
}

function saveBanData(data) {
    try {
        const dataDir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('[ERROR] BANデータ保存失敗:', err);
    }
}

// ==============================================
// BANリストのEmbedを構築する
// ==============================================
async function buildBanListEmbed(guild) {
    const bans = await guild.bans.fetch();

    const embed = new EmbedBuilder()
        .setTitle('BANユーザーリスト')
        .setDescription(
            bans.size > 0
                ? `現在 **${bans.size}人** がBANされています。`
                : 'BANされているユーザーはいません。'
        )
        .setColor('#dc3545')
        .setTimestamp()
        .setFooter({ text: `${guild.name} BAN管理システム` });

    if (bans.size > 0) {
        const MAX_DISPLAY = 20;
        const banList = [];
        let index = 1;

        for (const [, ban] of bans) {
            const reason = ban.reason || '理由なし';
            banList.push(
                `${index}. **${ban.user.tag}** (<@${ban.user.id}>)\n` +
                `   ID: \`${ban.user.id}\`\n` +
                `   理由: ${reason}`
            );
            index++;

            if (index > MAX_DISPLAY) {
                banList.push(`\n... および **${bans.size - MAX_DISPLAY}件** のユーザー`);
                break;
            }
        }

        // 1024文字制限に対応するためフィールドを分割
        const chunks = [];
        let currentChunk = '';

        for (const item of banList) {
            const candidate = currentChunk + item + '\n\n';
            if (candidate.length > 1000) {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = item + '\n\n';
            } else {
                currentChunk = candidate;
            }
        }
        if (currentChunk.trim()) chunks.push(currentChunk.trim());

        chunks.forEach((chunk, i) => {
            embed.addFields({
                name:  i === 0 ? 'ユーザー一覧' : '​',
                value: chunk
            });
        });
    }

    return embed;
}

// ==============================================
// BANリストメッセージを作成・更新
// allowCreate: false の場合、既存メッセージが見つからなければ何もしない（起動時専用）
// ==============================================
async function updateBanListMessage(channel, guild, allowCreate = true) {
    try {
        const embed   = await buildBanListEmbed(guild);
        const banData = loadBanData();
        const msgId   = banData.banListMessageId;
        let   message;

        if (msgId) {
            // 保存されたIDでメッセージを取得して編集
            message = await channel.messages.fetch(msgId).catch(() => null);
            if (message) {
                await message.edit({ embeds: [embed] });
                console.log(`[INFO] BANリストメッセージを更新しました (ID: ${msgId})`);
                return message;
            }
            // IDが無効になっていた場合はクリア
            console.warn(`[WARNING] 保存済みBANリストメッセージ(${msgId})が見つかりません。`);
            delete banData.banListMessageId;
            saveBanData(banData);
        }

        // 保存IDがない場合: チャンネル内から既存のBANリストメッセージを探す
        try {
            const recentMessages = await channel.messages.fetch({ limit: 20 });
            for (const [, msg] of recentMessages) {
                if (
                    msg.author.id === channel.client.user.id &&
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title === 'BANユーザーリスト'
                ) {
                    // 既存メッセージを発見 - IDを保存して更新
                    await msg.edit({ embeds: [embed] });
                    banData.banListMessageId = msg.id;
                    saveBanData(banData);
                    console.log(`[INFO] チャンネル内の既存BANリストメッセージを再利用しました (ID: ${msg.id})`);
                    return msg;
                }
            }
        } catch (err) {
            console.error('[ERROR] チャンネルメッセージ検索失敗:', err.message);
        }

        // allowCreate が false の場合は新規作成しない（起動時に重複送信を防ぐ）
        if (!allowCreate) {
            console.log('[INFO] BANリストメッセージが存在しないため起動時の作成をスキップ。/setup または BAN操作で初回作成されます。');
            return null;
        }

        // 新規作成
        message = await channel.send({ embeds: [embed] });
        banData.banListMessageId = message.id;
        saveBanData(banData);
        console.log(`[INFO] BANリストメッセージを新規作成しました (ID: ${message.id})`);

        return message;
    } catch (err) {
        console.error('[ERROR] BANリストの更新失敗:', err);
    }
}

// ==============================================
// ユーザーをBANする
// ==============================================
async function banUser(guild, userId, reason, executor) {
    try {
        // ユーザー情報を取得
        const user = await guild.client.users.fetch(userId).catch(() => null);
        if (!user) {
            return { success: false, message: '指定されたIDのユーザーが見つかりませんでした。IDを確認してください。' };
        }

        // 既にBANされているか確認
        const existing = await guild.bans.fetch(userId).catch(() => null);
        if (existing) {
            return { success: false, message: `**${user.tag}** (<@${userId}>) は既にBANされています。` };
        }

        // BAN実行
        await guild.members.ban(userId, { reason: `${reason} | 実行者: ${executor.tag}` });

        console.log(`[INFO] BAN実行: ${user.tag} (${userId}) | 理由: ${reason} | 実行者: ${executor.tag}`);

        logAction(guild, { action: 'BAN', executor, target: user, details: reason }).catch(() => {});

        return {
            success: true,
            message: `**${user.tag}** (<@${userId}>) をBANしました。\n理由: ${reason}`,
            user
        };
    } catch (err) {
        console.error('[ERROR] BAN実行失敗:', err);
        if (err.code === 50013) {
            return { success: false, message: 'ボットに「メンバーをBAN」権限がありません。' };
        }
        return { success: false, message: `BANに失敗しました: ${err.message}` };
    }
}

// ==============================================
// ユーザーのBAN解除
// ==============================================
async function unbanUser(guild, userId, executor) {
    try {
        // BANされているか確認
        const ban = await guild.bans.fetch(userId).catch(() => null);
        if (!ban) {
            return { success: false, message: 'このユーザーはBANされていません。' };
        }

        // BAN解除
        await guild.members.unban(userId, `BAN解除 | 実行者: ${executor.tag}`);

        console.log(`[INFO] BAN解除: ${ban.user.tag} (${userId}) | 実行者: ${executor.tag}`);

        logAction(guild, { action: 'UNBAN', executor, target: ban.user }).catch(() => {});

        return {
            success: true,
            message: `**${ban.user.tag}** (<@${userId}>) のBANを解除しました。`,
            user: ban.user
        };
    } catch (err) {
        console.error('[ERROR] BAN解除失敗:', err);
        if (err.code === 50013) {
            return { success: false, message: 'ボットに「メンバーのBAN解除」権限がありません。' };
        }
        return { success: false, message: `BAN解除に失敗しました: ${err.message}` };
    }
}

// ==============================================
// メッセージを自動削除するユーティリティ
// ==============================================
function autoDelete(message, reply, delayMs = 5000) {
    setTimeout(async () => {
        await message.delete().catch(() => {});
        if (reply) await reply.delete().catch(() => {});
    }, delayMs);
}

// ==============================================
// メッセージハンドラー (BANチャンネルへの投稿を処理)
// ==============================================
export async function handleBanMessage(message) {
    // ボット自身のメッセージは無視
    if (message.author.bot) return;

    // 環境変数未設定チェック
    if (!BAN_CHANNEL_ID || !ADMIN_ROLE_ID) {
        console.error('[ERROR] BAN システムの環境変数が設定されていません。');
        return;
    }

    // 指定BANチャンネル以外は無視
    if (message.channel.id !== BAN_CHANNEL_ID) return;

    const { content, member, guild, channel } = message;

    // 管理者権限チェック
    if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
        const reply = await message.reply('この操作を行う権限がありません。').catch(() => null);
        autoDelete(message, reply, 3000);
        return;
    }

    const trimmed = content.trim();

    // ------------------------------------------
    // ヘルプ表示
    // ------------------------------------------
    if (/^!?help$/i.test(trimmed)) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('BANシステム ヘルプ')
            .setDescription('このチャンネルでユーザーのBAN・BAN解除を行えます。')
            .addFields(
                {
                    name:  'BANする',
                    value: '```\nユーザーID\n```\n```\nユーザーID 理由\n```\n例: `123456789012345678 荒らし行為`'
                },
                {
                    name:  'BAN解除する',
                    value: '```\n!unban ユーザーID\n```\n```\nunban ユーザーID\n```\n例: `!unban 123456789012345678`'
                },
                {
                    name:  'ヒント',
                    value: [
                        '- ユーザーIDは右クリック「IDをコピー」で取得できます',
                        '- 理由は任意ですが記録のため入力を推奨します',
                        '- メッセージは5秒後に自動削除されます',
                        '- ヘルプは15秒後に自動削除されます'
                    ].join('\n')
                }
            )
            .setColor('#0099ff')
            .setFooter({ text: 'BAN管理システム' })
            .setTimestamp();

        const reply = await message.reply({ embeds: [helpEmbed] }).catch(() => null);
        autoDelete(message, reply, 15000);
        return;
    }

    // ------------------------------------------
    // BAN解除コマンド: !unban <UserID> または unban <UserID>
    // ------------------------------------------
    const unbanMatch = trimmed.match(/^!?unban\s+(\d{17,19})$/i);
    if (unbanMatch) {
        const userId = unbanMatch[1];
        const result = await unbanUser(guild, userId, member.user);
        const reply  = await message.reply(result.message).catch(() => null);
        autoDelete(message, reply, 5000);

        if (result.success) {
            await updateBanListMessage(channel, guild, true);
        }
        return;
    }

    // ------------------------------------------
    // BAN実行: <UserID> <理由>
    // ------------------------------------------
    const banWithReasonMatch = trimmed.match(/^(\d{17,19})\s+(.+)$/);
    if (banWithReasonMatch) {
        const userId = banWithReasonMatch[1];
        const reason = banWithReasonMatch[2].trim();
        const result = await banUser(guild, userId, reason, member.user);
        const reply  = await message.reply(result.message).catch(() => null);
        autoDelete(message, reply, 5000);

        if (result.success) {
            await updateBanListMessage(channel, guild, true);
        }
        return;
    }

    // ------------------------------------------
    // BAN実行: <UserID> のみ (理由なし)
    // ------------------------------------------
    const banOnlyMatch = trimmed.match(/^(\d{17,19})$/);
    if (banOnlyMatch) {
        const userId = banOnlyMatch[1];
        const reason = '理由なし';
        const result = await banUser(guild, userId, reason, member.user);
        const reply  = await message.reply(result.message).catch(() => null);
        autoDelete(message, reply, 5000);

        if (result.success) {
            await updateBanListMessage(channel, guild, true);
        }
        return;
    }

    // ------------------------------------------
    // 不明なコマンド
    // ------------------------------------------
    const reply = await message.reply('無効なコマンドです。`!help` でヘルプを表示します。').catch(() => null);
    autoDelete(message, reply, 3000);
}

// ==============================================
// 起動時にBANリストを初期化・表示
// 既存メッセージがある場合は更新のみ行い、
// 存在しない場合は新規作成しない（重複防止）
// ==============================================
export async function initializeBanList(client) {
    try {
        if (!BAN_CHANNEL_ID) {
            console.error('[ERROR] BAN_CHANNEL_ID が設定されていません。BANリストの初期化をスキップします。');
            return;
        }

        const channel = await client.channels.fetch(BAN_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.error(`[ERROR] BANチャンネルが見つかりません: ${BAN_CHANNEL_ID}`);
            return;
        }

        const guild = channel.guild;

        // allowCreate = false: 起動時は既存メッセージの更新のみ（重複送信を防止）
        // 既存メッセージが見つからない場合はスキップし、最初のBAN/UNBAN操作時に自動作成される
        await updateBanListMessage(channel, guild, false);

        console.log('[SUCCESS] BANリストの初期化完了。');
    } catch (err) {
        console.error('[ERROR] BANリストの初期化失敗:', err);
    }
}
