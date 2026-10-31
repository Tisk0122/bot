// ==============================================
// handlers/memberJoinHandler.js
// 新しくサーバーに参加したメンバーに対して、
// 募集DM通知を受け取るかどうかの設定DMを自動送信する
// (既存メンバーへは /recruit-notify-init で一括対応)
// ==============================================

import { sendPreferenceSetupDm } from '../commands/recruit-notify-init.js';
import { getDmPreference, getAllDmPrompts, markDmPrompted } from '../utils/recruitStore.js';

export function initMemberJoinNotifier(client) {
    client.on('guildMemberAdd', async member => {
        try {
            if (member.user.bot) return;

            // 既に設定済み（過去に参加していた等）ならスキップ
            const existing = getDmPreference(member.guild.id, member.id);
            const alreadyPrompted = getAllDmPrompts(member.guild.id)[member.id];
            if (existing || alreadyPrompted) return;

            const ok = await sendPreferenceSetupDm(member, member.guild);
            if (ok) {
                markDmPrompted(member.guild.id, member.id);
                console.log(`[INFO] 新規メンバーに募集DM通知の設定案内を送信: ${member.user.tag} (${member.id})`);
            } else {
                console.log(`[INFO] 新規メンバーへの設定案内DM送信に失敗（DMを閉じている可能性）: ${member.user.tag} (${member.id})`);
            }
        } catch (err) {
            console.error('[ERROR] memberJoinHandler 処理エラー:', err);
        }
    });

    console.log('[INFO] 新規メンバー向け募集DM通知の初期案内を有効化しました。');
}
