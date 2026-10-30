// ==============================================
// commands/study-role.js
// /study-role コマンド（管理者専用）
//
// サブコマンド:
//   give   - ユーザーに勉強ロールを付与する
//            ロールが存在しなければ自動作成する
//   remove - ユーザーから勉強ロールを剥奪し、
//            他に誰も持っていなければロールを自動削除する
//   list   - 現在の勉強ロール保持者一覧を表示する
// ==============================================

import 'dotenv/config';
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { setStudyRecord, deleteStudyRecord, getAllStudyRecords } from '../utils/studyRoleStore.js';

const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

// 勉強ロールのデフォルト名（変更したい場合は環境変数 STUDY_ROLE_NAME で上書き可能）
const STUDY_ROLE_NAME = process.env.STUDY_ROLE_NAME || '勉強中';

export const data = new SlashCommandBuilder()
    .setName('study-role')
    .setDescription('勉強ロールの付与・削除を管理します（管理者専用）')
    .addSubcommand(sub =>
        sub
            .setName('give')
            .setDescription('ユーザーに勉強ロールを付与します（ロールが存在しなければ自動作成）')
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('付与するユーザー')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('subject')
                    .setDescription('勉強する内容（例: 数学、英語、資格勉強、プログラミング）')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('remove')
            .setDescription('ユーザーから勉強ロールを剥奪します（誰も持っていなければロールを削除）')
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('剥奪するユーザー')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub
            .setName('list')
            .setDescription('現在勉強ロールを持つユーザーの一覧を表示します')
    );

// ==============================================
// 管理者権限チェック
// ==============================================
function isAdmin(member) {
    if (ADMIN_ROLE_ID && member.roles.cache.has(ADMIN_ROLE_ID)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageRoles)) return true;
    return false;
}

// ==============================================
// ロールを名前で検索し、なければ自動作成して返す
// ==============================================
async function getOrCreateStudyRole(guild) {
    // 既存ロールを名前で検索（大文字小文字を区別しない）
    const existing = guild.roles.cache.find(
        r => r.name.toLowerCase() === STUDY_ROLE_NAME.toLowerCase()
    );
    if (existing) return { role: existing, created: false };

    // 存在しなければ作成
    const role = await guild.roles.create({
        name:   STUDY_ROLE_NAME,
        color:  0x27ae60,
        reason: '/study-role give による自動作成'
    });
    console.log(`[StudyRole] ロール自動作成: "${STUDY_ROLE_NAME}" (${role.id})`);
    return { role, created: true };
}

// ==============================================
// /study-role give
// ==============================================
async function handleGive(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target  = interaction.options.getMember('user');
    const subject = interaction.options.getString('subject').trim();

    if (!target) {
        return interaction.editReply('対象ユーザーが見つかりません。');
    }

    if (target.user.bot) {
        return interaction.editReply('ボットには勉強ロールを付与できません。');
    }

    // ロールを取得または作成
    let role, created;
    try {
        ({ role, created } = await getOrCreateStudyRole(interaction.guild));
    } catch (err) {
        console.error('[StudyRole] ロール作成失敗:', err);
        return interaction.editReply(`ロールの作成に失敗しました: ${err.message}\nボットに「ロールの管理」権限があるか確認してください。`);
    }

    // ロール階層チェック
    const botMember = interaction.guild.members.me;
    if (botMember.roles.highest.position <= role.position) {
        return interaction.editReply(
            `ボットのロールが「${role.name}」より下位にあるため付与できません。\nDiscordサーバー設定でボットのロールを上位に移動してください。`
        );
    }

    // 既に持っているかチェック
    const alreadyHas = target.roles.cache.has(role.id);

    // ロール付与
    await target.roles.add(role.id, `勉強ロール付与 | 科目: ${subject} | 付与者: ${interaction.user.tag}`);

    // 記録を保存
    setStudyRecord(interaction.guild.id, target.id, {
        subject,
        assignedBy: interaction.user.id,
        roleId: role.id
    });

    const embed = new EmbedBuilder()
        .setTitle('勉強ロール付与')
        .addFields(
            { name: 'ユーザー',   value: `${target} (${target.user.tag})`, inline: true },
            { name: '科目',       value: subject,                           inline: true },
            { name: '付与者',     value: `${interaction.user}`,             inline: true },
            { name: 'ロール名',   value: role.name,                         inline: true }
        )
        .setColor(0x27ae60)
        .setTimestamp();

    if (created) {
        embed.setDescription(`ロール「${role.name}」を新規作成して付与しました。`);
    } else if (alreadyHas) {
        embed.setDescription('既に勉強ロールを持っていましたが、科目を更新しました。');
    }

    await interaction.editReply({ embeds: [embed] });

    console.log(`[StudyRole] 付与: ${target.user.tag} (${target.id}) | 科目: ${subject} | ロール: ${role.name} (${role.id}) | 付与者: ${interaction.user.tag}`);
}

// ==============================================
// /study-role remove
// ==============================================
async function handleRemove(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getMember('user');

    if (!target) {
        return interaction.editReply('対象ユーザーが見つかりません。');
    }

    // 勉強ロールをサーバー内で名前検索
    const role = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === STUDY_ROLE_NAME.toLowerCase()
    );

    if (!role) {
        return interaction.editReply(`ロール「${STUDY_ROLE_NAME}」がサーバーに存在しません。`);
    }

    // ロールを持っているか確認
    if (!target.roles.cache.has(role.id)) {
        return interaction.editReply(`${target} は勉強ロール「${role.name}」を持っていません。`);
    }

    // ロール階層チェック
    const botMember = interaction.guild.members.me;
    if (botMember.roles.highest.position <= role.position) {
        return interaction.editReply(
            `ボットのロールが「${role.name}」より下位にあるため剥奪できません。`
        );
    }

    // ロールを剥奪
    await target.roles.remove(role.id, `勉強ロール剥奪 | 剥奪者: ${interaction.user.tag}`);
    deleteStudyRecord(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
        .setTitle('勉強ロール剥奪')
        .addFields(
            { name: 'ユーザー', value: `${target} (${target.user.tag})`, inline: true },
            { name: '剥奪者',   value: `${interaction.user}`,             inline: true }
        )
        .setColor(0xe74c3c)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    console.log(`[StudyRole] 剥奪: ${target.user.tag} (${target.id}) | 剥奪者: ${interaction.user.tag}`);
}

// ==============================================
// /study-role list
// ==============================================
async function handleList(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const records = getAllStudyRecords(interaction.guild.id);
    const entries = Object.entries(records);

    if (entries.length === 0) {
        return interaction.editReply('現在、勉強ロールを付与されているユーザーはいません。');
    }

    // ロールを実際に持っているメンバーのみ表示（ロールが手動削除された場合を除外）
    await interaction.guild.members.fetch().catch(() => {});

    const studyRole = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === STUDY_ROLE_NAME.toLowerCase()
    );

    const lines = [];
    for (const [userId, record] of entries) {
        const member = interaction.guild.members.cache.get(userId);
        if (!member) continue;

        // ロールを持っていない場合はデータを自動クリーン
        const roleId = record.roleId || studyRole?.id;
        if (roleId && !member.roles.cache.has(roleId)) {
            deleteStudyRecord(interaction.guild.id, userId);
            continue;
        }

        const assignedAt = `<t:${Math.floor(record.assignedAt / 1000)}:d>`;
        lines.push(`- ${member} | 科目: **${record.subject}** | 付与日: ${assignedAt}`);
    }

    if (lines.length === 0) {
        return interaction.editReply('現在、勉強ロールを付与されているユーザーはいません。');
    }

    const embed = new EmbedBuilder()
        .setTitle('勉強ロール保持者一覧')
        .setDescription(lines.join('\n'))
        .setColor(0x3498db)
        .setFooter({ text: `合計: ${lines.length}人` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

// ==============================================
// メインエクスポート
// ==============================================
export async function execute(interaction) {
    // 管理者権限チェック
    if (!isAdmin(interaction.member)) {
        return interaction.reply({
            content: 'このコマンドは管理者専用です。',
            ephemeral: true
        });
    }

    const sub = interaction.options.getSubcommand();

    try {
        if (sub === 'give')   await handleGive(interaction);
        else if (sub === 'remove') await handleRemove(interaction);
        else if (sub === 'list')   await handleList(interaction);
    } catch (err) {
        console.error(`[StudyRole] コマンドエラー (${sub}):`, err);
        const msg = { content: 'コマンド処理中にエラーが発生しました。', ephemeral: true };
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(msg).catch(() => {});
        } else {
            await interaction.followUp(msg).catch(() => {});
        }
    }
}
