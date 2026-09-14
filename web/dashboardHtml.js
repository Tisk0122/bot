// ==============================================
// web/dashboardHtml.js
// 管理者ダッシュボードのHTML(単一ページ)。
// バニラJS + fetch でAPI(/admin/api/*)を呼び出す。
// ==============================================

export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>hinansaba 管理者ダッシュボード</title>
<style>
  :root {
    --bg: #0f1115;
    --panel: #171a21;
    --panel-2: #1e222b;
    --border: #2a2f3a;
    --text: #e6e8ec;
    --muted: #8b93a3;
    --accent: #5865f2;
    --green: #28a745;
    --red: #dc3545;
    --gray: #6c757d;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
  }
  header {
    padding: 20px 28px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
  header h1 { font-size: 18px; margin: 0; }
  header .status { font-size: 13px; color: var(--muted); }
  header .status b { color: var(--text); }
  nav {
    display: flex;
    gap: 4px;
    padding: 0 28px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
  }
  nav button {
    background: none;
    border: none;
    color: var(--muted);
    padding: 12px 16px;
    font-size: 14px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  nav button.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  main { padding: 24px 28px 60px; max-width: 1100px; margin: 0 auto; }
  .tab { display: none; }
  .tab.active { display: block; }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 20px;
    margin-bottom: 18px;
  }
  .card h2 { margin: 0 0 12px; font-size: 15px; color: var(--text); }
  .card p.desc { color: var(--muted); font-size: 13px; margin: -4px 0 14px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
  input[type=text], textarea {
    background: var(--panel-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 13px;
  }
  input[type=text] { width: 240px; }
  textarea { width: 100%; min-height: 160px; font-family: monospace; resize: vertical; }
  select {
    background: var(--panel-2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 13px;
  }
  button.btn {
    background: var(--accent);
    color: white;
    border: none;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }
  button.btn.secondary { background: var(--panel-2); border: 1px solid var(--border); color: var(--text); }
  button.btn.danger { background: var(--red); }
  button.btn:hover { filter: brightness(1.1); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .02em; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; }
  .pill.in { background: rgba(40,167,69,.15); color: #6be08a; }
  .pill.out { background: rgba(220,53,69,.15); color: #ff8b96; }
  .pill.unset { background: rgba(108,117,125,.2); color: #b8bfc9; }
  .avatar { width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 8px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 12px; }
  .stat { background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
  .stat .num { font-size: 24px; font-weight: 700; }
  .stat .label { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .empty { color: var(--muted); font-size: 13px; padding: 20px 0; text-align: center; }
  .file-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 8px; }
  .file-row:last-child { border-bottom: none; }
  .file-name { font-family: monospace; font-size: 13px; }
  .file-meta { color: var(--muted); font-size: 12px; }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .toast {
    position: fixed; bottom: 20px; right: 20px; background: var(--panel-2);
    border: 1px solid var(--border); color: var(--text); padding: 12px 16px;
    border-radius: 8px; font-size: 13px; opacity: 0; transform: translateY(10px);
    transition: all .25s ease; pointer-events: none; z-index: 50;
    max-width: 320px;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.error { border-color: var(--red); }
  .note { font-size: 12px; color: var(--muted); margin-top: 8px; line-height: 1.6; }
  code { background: var(--panel-2); padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>

<header>
  <h1>🛠 hinansaba 管理者ダッシュボード</h1>
  <div class="status" id="status-line">読み込み中…</div>
</header>

<nav>
  <button class="tab-btn active" data-tab="prefs">📨 通知設定</button>
  <button class="tab-btn" data-tab="recruits">🎮 募集一覧</button>
  <button class="tab-btn" data-tab="data">💾 データの引き継ぎ</button>
</nav>

<main>

  <!-- ============ 通知設定タブ ============ -->
  <section class="tab active" id="tab-prefs">
    <div class="card">
      <h2>募集DM通知の設定状況</h2>
      <p class="desc">サーバーメンバーごとの「募集をDMで受け取るか」の設定一覧です。</p>
      <div class="stat-grid" id="pref-stats"></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <input type="text" id="pref-search" placeholder="ユーザー名で検索…">
        <select id="pref-filter">
          <option value="all">すべて表示</option>
          <option value="in">受け取る のみ</option>
          <option value="out">受け取らない のみ</option>
          <option value="unset">未設定 のみ</option>
        </select>
        <button class="btn secondary" onclick="loadPreferences()">🔄 再読み込み</button>
      </div>
      <table>
        <thead>
          <tr><th>ユーザー</th><th>ID</th><th>設定</th></tr>
        </thead>
        <tbody id="pref-tbody"></tbody>
      </table>
      <div class="empty" id="pref-empty" style="display:none;">該当するメンバーがいません。</div>
    </div>
  </section>

  <!-- ============ 募集一覧タブ ============ -->
  <section class="tab" id="tab-recruits">
    <div class="card">
      <h2>募集一覧</h2>
      <p class="desc">これまでに作成された募集と、参加状況の集計です。</p>
      <div class="toolbar">
        <button class="btn secondary" onclick="loadRecruitments()">🔄 再読み込み</button>
      </div>
      <table>
        <thead>
          <tr><th>ゲーム</th><th>日時</th><th>定員</th><th>✅参加</th><th>❌不参加</th><th>🤔わからない</th><th>作成日時</th></tr>
        </thead>
        <tbody id="recruit-tbody"></tbody>
      </table>
      <div class="empty" id="recruit-empty" style="display:none;">まだ募集がありません。</div>
    </div>
  </section>

  <!-- ============ データ引き継ぎタブ ============ -->
  <section class="tab" id="tab-data">
    <div class="card">
      <h2>💾 データのダウンロード / コピー / アップロード</h2>
      <p class="desc">
        プロジェクトを更新・再デプロイする際、このJSONデータを保存しておき、更新後にインポートすることで
        設定や募集履歴を引き継げます。
      </p>
      <div id="file-list"></div>
      <div class="note">
        ⚠ インポートは既存データを<strong>上書き</strong>します（上書き前に自動でバックアップを作成します）。
        中身が正しいJSONであることを確認してから実行してください。
      </div>
    </div>

    <div class="card" id="import-panel" style="display:none;">
      <h2>📥 インポート: <span id="import-filename" style="font-family:monospace;"></span></h2>
      <textarea id="import-textarea" placeholder="ここにJSONを貼り付け、またはファイルを選択してください"></textarea>
      <div class="toolbar" style="margin-top:10px;">
        <input type="file" id="import-file-input" accept="application/json">
        <button class="btn" onclick="submitImport()">この内容でインポートする</button>
        <button class="btn secondary" onclick="closeImportPanel()">キャンセル</button>
      </div>
    </div>
  </section>

</main>

<div class="toast" id="toast"></div>

<script>
const API = {
  status: '/admin/api/status',
  preferences: '/admin/api/preferences',
  recruitments: '/admin/api/recruitments',
  files: '/admin/api/files',
  exportFile: (name) => '/admin/api/export/' + encodeURIComponent(name),
  importFile: (name) => '/admin/api/import/' + encodeURIComponent(name)
};

let prefData = [];
let currentImportFile = null;

function showToast(msg, isError) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ---------- タブ切り替え ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ---------- ステータス ----------
async function loadStatus() {
  try {
    const res = await fetch(API.status);
    const data = await res.json();
    document.getElementById('status-line').innerHTML =
      (data.ready ? '🟢 稼働中' : '🔴 未接続') +
      ' ・ <b>' + (data.guildName || '不明') + '</b>' +
      ' ・ メンバー数: <b>' + (data.memberCount ?? '?') + '</b>' +
      ' ・ Bot: <b>' + (data.botTag || '?') + '</b>';
  } catch (err) {
    document.getElementById('status-line').textContent = 'ステータス取得に失敗しました';
  }
}

// ---------- 通知設定 ----------
async function loadPreferences() {
  try {
    const res = await fetch(API.preferences);
    const data = await res.json();
    prefData = data.members || [];
    renderPreferences();
  } catch (err) {
    showToast('通知設定の取得に失敗しました: ' + err.message, true);
  }
}

function renderPreferences() {
  const search = document.getElementById('pref-search').value.trim().toLowerCase();
  const filter = document.getElementById('pref-filter').value;

  const filtered = prefData.filter(m => {
    if (filter !== 'all' && m.preference !== filter) return false;
    if (search && !m.tag.toLowerCase().includes(search) && !m.displayName.toLowerCase().includes(search)) return false;
    return true;
  });

  const counts = { in: 0, out: 0, unset: 0 };
  for (const m of prefData) counts[m.preference] = (counts[m.preference] || 0) + 1;

  document.getElementById('pref-stats').innerHTML = [
    ['🔔 受け取る', counts.in || 0],
    ['🔕 受け取らない', counts.out || 0],
    ['❔ 未設定', counts.unset || 0],
    ['👥 合計', prefData.length]
  ].map(([label, num]) =>
    '<div class="stat"><div class="num">' + num + '</div><div class="label">' + label + '</div></div>'
  ).join('');

  const tbody = document.getElementById('pref-tbody');
  document.getElementById('pref-empty').style.display = filtered.length ? 'none' : 'block';

  tbody.innerHTML = filtered.map(m => {
    const pillLabel = m.preference === 'in' ? '🔔 受け取る' : m.preference === 'out' ? '🔕 受け取らない' : '❔ 未設定';
    return '<tr>' +
      '<td><img class="avatar" src="' + m.avatarUrl + '"><span>' + escapeHtml(m.displayName) + '</span></td>' +
      '<td>' + m.userId + '</td>' +
      '<td><span class="pill ' + m.preference + '">' + pillLabel + '</span></td>' +
      '</tr>';
  }).join('');
}

document.getElementById('pref-search').addEventListener('input', renderPreferences);
document.getElementById('pref-filter').addEventListener('change', renderPreferences);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

// ---------- 募集一覧 ----------
async function loadRecruitments() {
  try {
    const res = await fetch(API.recruitments);
    const data = await res.json();
    const list = data.recruitments || [];
    const tbody = document.getElementById('recruit-tbody');
    document.getElementById('recruit-empty').style.display = list.length ? 'none' : 'block';

    tbody.innerHTML = list.map(r => {
      const created = new Date(r.createdAt).toLocaleString('ja-JP');
      return '<tr>' +
        '<td>' + escapeHtml(r.game) + '</td>' +
        '<td>' + escapeHtml(r.datetime || '-') + '</td>' +
        '<td>' + (r.capacity || '-') + '</td>' +
        '<td>' + r.counts.join + '</td>' +
        '<td>' + r.counts.decline + '</td>' +
        '<td>' + r.counts.unsure + '</td>' +
        '<td>' + created + '</td>' +
        '</tr>';
    }).join('');
  } catch (err) {
    showToast('募集一覧の取得に失敗しました: ' + err.message, true);
  }
}

// ---------- データ引き継ぎ ----------
async function loadFiles() {
  try {
    const res = await fetch(API.files);
    const data = await res.json();
    const container = document.getElementById('file-list');
    container.innerHTML = data.files.map(f => {
      const size = f.exists ? (f.size + ' bytes') : '未作成';
      const modified = f.modifiedAt ? new Date(f.modifiedAt).toLocaleString('ja-JP') : '-';
      return '<div class="file-row">' +
        '<div>' +
          '<div class="file-name">' + f.name + '</div>' +
          '<div class="file-meta">' + size + ' ・ 最終更新: ' + modified + '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<button class="btn secondary" onclick="copyFile(&quot;' + f.name + '&quot;)">📋 コピー</button>' +
          '<a class="btn secondary" style="text-decoration:none;" href="' + API.exportFile(f.name) + '" download>⬇ ダウンロード</a>' +
          '<button class="btn" onclick="openImportPanel(&quot;' + f.name + '&quot;)">📥 インポート</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (err) {
    showToast('ファイル一覧の取得に失敗しました: ' + err.message, true);
  }
}

async function copyFile(name) {
  try {
    const res = await fetch(API.exportFile(name));
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    showToast(name + ' の内容をコピーしました');
  } catch (err) {
    showToast('コピーに失敗しました: ' + err.message, true);
  }
}

function openImportPanel(name) {
  currentImportFile = name;
  document.getElementById('import-filename').textContent = name;
  document.getElementById('import-panel').style.display = 'block';
  document.getElementById('import-textarea').value = '';
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-panel').scrollIntoView({ behavior: 'smooth' });
}

function closeImportPanel() {
  document.getElementById('import-panel').style.display = 'none';
  currentImportFile = null;
}

document.getElementById('import-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  document.getElementById('import-textarea').value = text;
});

async function submitImport() {
  if (!currentImportFile) return;
  const content = document.getElementById('import-textarea').value;

  if (!content.trim()) {
    showToast('JSONの内容を入力してください', true);
    return;
  }

  try {
    JSON.parse(content);
  } catch (err) {
    showToast('JSONの形式が不正です: ' + err.message, true);
    return;
  }

  if (!confirm(currentImportFile + ' を上書きします。よろしいですか？（自動バックアップされます）')) return;

  try {
    const res = await fetch(API.importFile(currentImportFile), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: content
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'インポートに失敗しました');
    showToast(currentImportFile + ' をインポートしました');
    closeImportPanel();
    loadFiles();
    loadPreferences();
    loadRecruitments();
  } catch (err) {
    showToast('インポートに失敗しました: ' + err.message, true);
  }
}

// ---------- 初期読み込み ----------
loadStatus();
loadPreferences();
loadRecruitments();
loadFiles();
setInterval(loadStatus, 30000);
</script>
</body>
</html>`;
