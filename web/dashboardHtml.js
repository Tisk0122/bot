// ==============================================
// web/dashboardHtml.js
// 管理者ダッシュボード (リニューアル版)
// ==============================================

export const DASHBOARD_HTML = /* html */`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>hinansaba 管理ダッシュボード</title>
<style>
:root {
  --bg:        #0b0d11;
  --surface:   #13161d;
  --surface2:  #1a1e28;
  --surface3:  #222737;
  --border:    #2c3040;
  --border2:   #3a4055;
  --text:      #e8eaf0;
  --text2:     #9ba3b8;
  --text3:     #5c6480;
  --accent:    #5865f2;
  --accent-h:  #4752c4;
  --green:     #3ba55c;
  --green-bg:  rgba(59,165,92,.12);
  --red:       #ed4245;
  --red-bg:    rgba(237,66,69,.12);
  --yellow:    #faa81a;
  --yellow-bg: rgba(250,168,26,.12);
  --radius:    10px;
  --radius-sm: 6px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;font-size:14px;line-height:1.5}

/* ── Layout ── */
.layout{display:flex;height:100vh;overflow:hidden}

/* ── Sidebar ── */
.sidebar{
  width:220px;min-width:220px;background:var(--surface);
  border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
}
.sidebar-logo{
  padding:20px 18px 14px;
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;gap:10px;
}
.sidebar-logo svg{flex-shrink:0;color:var(--accent)}
.sidebar-logo-text{font-size:13px;font-weight:700;color:var(--text);line-height:1.2}
.sidebar-logo-sub{font-size:11px;color:var(--text3);font-weight:400}

.sidebar-status{
  margin:12px;padding:10px 12px;
  background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);
}
.status-dot{
  display:inline-block;width:8px;height:8px;border-radius:50%;
  background:var(--text3);margin-right:6px;vertical-align:middle;
  transition:background .3s;
}
.status-dot.online{background:var(--green)}
.status-dot.offline{background:var(--red)}
.status-label{font-size:12px;font-weight:600}
.status-meta{font-size:11px;color:var(--text3);margin-top:4px;line-height:1.5}

.sidebar-nav{flex:1;overflow-y:auto;padding:8px 0}
.nav-group-label{
  font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:var(--text3);padding:12px 18px 4px;
}
.nav-item{
  display:flex;align-items:center;gap:10px;
  padding:9px 18px;cursor:pointer;font-size:13px;color:var(--text2);
  border-radius:0;transition:background .15s,color .15s;position:relative;
  border:none;background:none;width:100%;text-align:left;
}
.nav-item:hover{background:var(--surface2);color:var(--text)}
.nav-item.active{background:var(--surface3);color:var(--text);font-weight:600}
.nav-item.active::before{
  content:'';position:absolute;left:0;top:4px;bottom:4px;
  width:3px;background:var(--accent);border-radius:0 3px 3px 0;
}
.nav-item svg{opacity:.7;flex-shrink:0}
.nav-item.active svg{opacity:1;color:var(--accent)}
.nav-badge{
  margin-left:auto;font-size:11px;font-weight:700;
  padding:1px 6px;border-radius:999px;
  background:var(--surface3);color:var(--text2);min-width:20px;text-align:center;
}

.sidebar-footer{
  padding:12px;border-top:1px solid var(--border);
}
.uptime-label{font-size:11px;color:var(--text3);text-align:center}

/* ── Main area ── */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}

.topbar{
  padding:0 28px;height:52px;
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  background:var(--surface);flex-shrink:0;
}
.topbar-title{font-size:15px;font-weight:700;color:var(--text)}
.topbar-actions{display:flex;gap:8px;align-items:center}

.content{flex:1;overflow-y:auto;padding:24px 28px 60px}

/* ── Tab panes ── */
.pane{display:none}
.pane.active{display:block}

/* ── Cards ── */
.card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:var(--radius);padding:20px 22px;margin-bottom:18px;
}
.card-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:14px;flex-wrap:wrap;gap:10px;
}
.card-title{font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px}
.card-title svg{color:var(--accent)}
.card-desc{font-size:12px;color:var(--text3);margin-top:3px}

/* ── Stat grid ── */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.stat{
  background:var(--surface2);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:16px;
}
.stat-num{font-size:26px;font-weight:800;line-height:1}
.stat-label{font-size:11px;color:var(--text3);margin-top:6px;font-weight:500}
.stat-num.green{color:var(--green)}
.stat-num.red{color:var(--red)}
.stat-num.yellow{color:var(--yellow)}

/* ── Toolbar ── */
.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.search-wrap{position:relative;display:flex;align-items:center}
.search-wrap svg{position:absolute;left:9px;color:var(--text3);pointer-events:none}
input[type=text],input[type=search]{
  background:var(--surface2);border:1px solid var(--border);color:var(--text);
  padding:7px 10px 7px 32px;border-radius:var(--radius-sm);font-size:13px;
  outline:none;transition:border .15s;width:220px;
}
input[type=text]:focus,input[type=search]:focus{border-color:var(--accent)}
select{
  background:var(--surface2);border:1px solid var(--border);color:var(--text);
  padding:7px 10px;border-radius:var(--radius-sm);font-size:13px;outline:none;cursor:pointer;
}
textarea{
  background:var(--surface2);border:1px solid var(--border);color:var(--text);
  padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;
  font-family:monospace;width:100%;min-height:180px;resize:vertical;outline:none;
  transition:border .15s;
}
textarea:focus{border-color:var(--accent)}

/* ── Buttons ── */
.btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:7px 14px;border-radius:var(--radius-sm);font-size:13px;font-weight:600;
  border:none;cursor:pointer;transition:filter .15s,opacity .15s;white-space:nowrap;
  text-decoration:none;
}
.btn:hover{filter:brightness(1.12)}
.btn:active{filter:brightness(.92)}
.btn:disabled{opacity:.45;pointer-events:none}
.btn-primary{background:var(--accent);color:#fff}
.btn-secondary{background:var(--surface2);border:1px solid var(--border);color:var(--text)}
.btn-danger{background:var(--red-bg);border:1px solid var(--red);color:var(--red)}
.btn-success{background:var(--green-bg);border:1px solid var(--green);color:var(--green)}
.btn-icon{padding:6px 8px}
.btn-sm{padding:5px 10px;font-size:12px}

/* ── Table ── */
.table-wrap{overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:13px;min-width:500px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border)}
th{
  background:var(--surface2);color:var(--text3);font-size:11px;
  font-weight:700;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;
}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.018)}
td.actions-cell{white-space:nowrap}

/* ── Pills / Badges ── */
.pill{
  display:inline-flex;align-items:center;gap:4px;
  padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;
}
.pill-green{background:var(--green-bg);color:#6be08a}
.pill-red{background:var(--red-bg);color:#ff8b96}
.pill-yellow{background:var(--yellow-bg);color:#ffc947}
.pill-gray{background:rgba(108,117,125,.2);color:#9ba3b8}
.pill-accent{background:rgba(88,101,242,.18);color:#8b98ff}

/* ── Avatar ── */
.avatar{width:26px;height:26px;border-radius:50%;vertical-align:middle;margin-right:8px;background:var(--surface3)}
.user-cell{display:flex;align-items:center;min-width:0}
.user-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}

/* ── Empty state ── */
.empty{
  text-align:center;padding:48px 20px;color:var(--text3);
}
.empty svg{opacity:.3;margin-bottom:12px}
.empty p{font-size:13px}

/* ── File rows ── */
.file-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:10px;
}
.file-row:last-child{border-bottom:none}
.file-name{font-family:monospace;font-size:13px;font-weight:600;color:var(--text)}
.file-meta{font-size:11px;color:var(--text3);margin-top:3px}
.file-badge{
  display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:700;
  background:var(--green-bg);color:var(--green);margin-right:6px;
}
.file-badge.missing{background:var(--red-bg);color:var(--red)}

/* ── Import panel ── */
.import-panel{
  border:1px solid var(--accent);background:rgba(88,101,242,.06);
  border-radius:var(--radius);padding:20px 22px;margin-bottom:18px;
}
.import-panel h3{font-size:14px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}

/* ── Toast ── */
.toast-stack{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column-reverse;gap:8px;z-index:1000}
.toast{
  background:var(--surface2);border:1px solid var(--border);color:var(--text);
  padding:12px 16px;border-radius:var(--radius-sm);font-size:13px;
  opacity:0;transform:translateY(10px);pointer-events:none;
  transition:all .25s ease;max-width:340px;line-height:1.4;
}
.toast.show{opacity:1;transform:translateY(0);pointer-events:auto}
.toast.success{border-left:3px solid var(--green)}
.toast.error{border-left:3px solid var(--red)}
.toast.info{border-left:3px solid var(--accent)}

/* ── Modal ── */
.modal-backdrop{
  position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:200;
  display:flex;align-items:center;justify-content:center;padding:20px;
  opacity:0;pointer-events:none;transition:opacity .2s;
}
.modal-backdrop.open{opacity:1;pointer-events:auto}
.modal{
  background:var(--surface);border:1px solid var(--border2);border-radius:var(--radius);
  width:100%;max-width:480px;padding:24px;
  transform:scale(.95);transition:transform .2s;
}
.modal-backdrop.open .modal{transform:scale(1)}
.modal-title{font-size:15px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.modal-title svg{color:var(--red)}
.modal-body{font-size:13px;color:var(--text2);line-height:1.65;margin-bottom:20px}
.modal-body strong{color:var(--text)}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px}

/* ── Responsive ── */
@media(max-width:768px){
  .sidebar{width:180px;min-width:180px}
  .content{padding:16px 14px 60px}
  .topbar{padding:0 14px}
  .nav-item{padding:9px 12px}
  .stat-num{font-size:20px}
}
@media(max-width:540px){
  .layout{flex-direction:column}
  .sidebar{width:100%;min-width:0;height:auto;border-right:none;border-bottom:1px solid var(--border)}
  .sidebar-nav{display:flex;flex-direction:row;overflow-x:auto;padding:4px}
  .nav-group-label{display:none}
  .nav-item{white-space:nowrap;padding:8px 12px;border-radius:6px}
  .nav-item.active::before{display:none}
  .sidebar-footer{display:none}
  .main{height:calc(100vh - 160px)}
}

/* ── Skeleton loader ── */
.skeleton{background:linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%);background-size:200%;animation:skeleton-anim 1.5s infinite;border-radius:4px;height:14px;display:inline-block}
@keyframes skeleton-anim{0%{background-position:200%}100%{background-position:-200%}}

/* ── Confirm row highlight ── */
tr.deleting td{background:var(--red-bg)!important;transition:background .15s}
</style>
</head>
<body>

<div class="layout">

  <!-- ===== SIDEBAR ===== -->
  <aside class="sidebar">
    <div class="sidebar-logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <div>
        <div class="sidebar-logo-text">hinansaba</div>
        <div class="sidebar-logo-sub">管理ダッシュボード</div>
      </div>
    </div>

    <div class="sidebar-status" id="sidebar-status">
      <div><span class="status-dot" id="status-dot"></span><span class="status-label" id="status-label">読み込み中…</span></div>
      <div class="status-meta" id="status-meta"></div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-group-label">メニュー</div>
      <button class="nav-item active" data-pane="overview">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        概要
      </button>
      <button class="nav-item" data-pane="prefs">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        通知設定
        <span class="nav-badge" id="badge-prefs">-</span>
      </button>
      <button class="nav-item" data-pane="recruits">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        募集一覧
        <span class="nav-badge" id="badge-recruits">-</span>
      </button>
      <button class="nav-item" data-pane="study">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        勉強ロール
        <span class="nav-badge" id="badge-study">-</span>
      </button>
      <button class="nav-item" data-pane="data">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        データ管理
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="uptime-label" id="uptime-label">稼働時間: -</div>
    </div>
  </aside>

  <!-- ===== MAIN ===== -->
  <div class="main">
    <div class="topbar">
      <div class="topbar-title" id="topbar-title">概要</div>
      <div class="topbar-actions">
        <button class="btn btn-secondary btn-sm" id="refresh-btn" onclick="refreshCurrent()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          更新
        </button>
      </div>
    </div>

    <div class="content">

      <!-- ===== 概要 ===== -->
      <div class="pane active" id="pane-overview">
        <div class="stat-grid" id="overview-stats">
          <div class="stat"><div class="stat-num skeleton" style="width:60px"> </div><div class="stat-label">メンバー数</div></div>
          <div class="stat"><div class="stat-num skeleton" style="width:40px"> </div><div class="stat-label">通知オン</div></div>
          <div class="stat"><div class="stat-num skeleton" style="width:40px"> </div><div class="stat-label">アクティブ募集</div></div>
          <div class="stat"><div class="stat-num skeleton" style="width:40px"> </div><div class="stat-label">勉強ロール数</div></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                最近の募集
              </div>
              <div class="card-desc">直近10件を表示しています</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ゲーム</th><th>日時</th><th>参加</th><th>不参加</th><th>作成</th></tr></thead>
              <tbody id="overview-recruit-tbody"><tr><td colspan="5" class="empty" style="padding:20px;text-align:center;color:var(--text3)">読み込み中…</td></tr></tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                最近の勉強ロール付与
              </div>
              <div class="card-desc">直近5件を表示しています</div>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ユーザー</th><th>科目</th><th>付与日時</th></tr></thead>
              <tbody id="overview-study-tbody"><tr><td colspan="3" class="empty" style="padding:20px;text-align:center;color:var(--text3)">読み込み中…</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ===== 通知設定 ===== -->
      <div class="pane" id="pane-prefs">
        <div class="stat-grid" id="pref-stats"></div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                募集DM通知の設定状況
              </div>
              <div class="card-desc">メンバーごとの通知受け取り設定一覧です</div>
            </div>
          </div>
          <div class="toolbar">
            <div class="search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="pref-search" placeholder="ユーザー名で検索…">
            </div>
            <select id="pref-filter">
              <option value="all">すべて</option>
              <option value="in">受け取る</option>
              <option value="out">受け取らない</option>
              <option value="unset">未設定</option>
            </select>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ユーザー</th><th>Discord ID</th><th>設定</th><th>操作</th></tr></thead>
              <tbody id="pref-tbody"></tbody>
            </table>
          </div>
          <div class="empty" id="pref-empty" style="display:none">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            <p>該当するメンバーがいません</p>
          </div>
        </div>
      </div>

      <!-- ===== 募集一覧 ===== -->
      <div class="pane" id="pane-recruits">
        <div class="stat-grid" id="recruit-stats"></div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                募集一覧
              </div>
              <div class="card-desc">作成日時の新しい順に表示しています</div>
            </div>
          </div>
          <div class="toolbar">
            <div class="search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="recruit-search" placeholder="ゲーム名で検索…">
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ゲーム</th><th>日時</th><th>定員</th><th>参加</th><th>不参加</th><th>?</th><th>作成日時</th><th>操作</th></tr></thead>
              <tbody id="recruit-tbody"></tbody>
            </table>
          </div>
          <div class="empty" id="recruit-empty" style="display:none">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <p>募集がありません</p>
          </div>
        </div>
      </div>

      <!-- ===== 勉強ロール ===== -->
      <div class="pane" id="pane-study">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                勉強ロール保持者
              </div>
              <div class="card-desc">おべんきょVCへの入室が許可されているメンバー一覧です</div>
            </div>
          </div>
          <div class="toolbar">
            <div class="search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="study-search" placeholder="ユーザー名で検索…">
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ユーザー</th><th>Discord ID</th><th>科目</th><th>付与日時</th><th>操作</th></tr></thead>
              <tbody id="study-tbody"></tbody>
            </table>
          </div>
          <div class="empty" id="study-empty" style="display:none">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <p>勉強ロール保持者がいません</p>
          </div>
        </div>
      </div>

      <!-- ===== データ管理 ===== -->
      <div class="pane" id="pane-data">
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                データファイル一覧
              </div>
              <div class="card-desc">再デプロイ時のデータ引き継ぎや、バックアップにご使用ください。インポートは自動バックアップ後に上書きされます。</div>
            </div>
          </div>
          <div id="file-list"><div style="color:var(--text3);font-size:13px">読み込み中…</div></div>
        </div>

        <div class="import-panel" id="import-panel" style="display:none">
          <h3>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
            インポート：<span id="import-filename" style="font-family:monospace;color:var(--accent)"></span>
          </h3>
          <textarea id="import-textarea" placeholder="ここにJSONを貼り付け、またはファイルを選択してください…"></textarea>
          <div style="margin-top:6px;margin-bottom:14px">
            <input type="file" id="import-file-input" accept="application/json" style="font-size:12px;color:var(--text2)">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="submitImport()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              インポートする
            </button>
            <button class="btn btn-secondary" onclick="closeImportPanel()">キャンセル</button>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:10px">⚠ 既存データを上書きします。実行前に必ずエクスポートして保存してください。</div>
        </div>
      </div>

    </div><!-- /content -->
  </div><!-- /main -->
</div><!-- /layout -->

<!-- ===== 削除確認モーダル ===== -->
<div class="modal-backdrop" id="modal-backdrop">
  <div class="modal">
    <div class="modal-title">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span id="modal-title-text">確認</span>
    </div>
    <div class="modal-body" id="modal-body"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-danger" id="modal-confirm-btn" onclick="confirmModal()">削除する</button>
    </div>
  </div>
</div>

<!-- ===== Toast ===== -->
<div class="toast-stack" id="toast-stack"></div>

<script>
// =============================================
// ユーティリティ
// =============================================
const API = {
  status:       '/admin/api/status',
  preferences:  '/admin/api/preferences',
  delPref:      (uid)   => '/admin/api/preferences/' + uid,
  recruitments: '/admin/api/recruitments',
  closeRecruit: (id)    => '/admin/api/recruitments/' + id + '/close',
  delRecruit:   (id)    => '/admin/api/recruitments/' + id,
  studyRoles:   '/admin/api/study-roles',
  delStudy:     (uid)   => '/admin/api/study-roles/' + uid,
  files:        '/admin/api/files',
  exportFile:   (name)  => '/admin/api/export/' + encodeURIComponent(name),
  importFile:   (name)  => '/admin/api/import/' + encodeURIComponent(name),
};

let toastId = 0;
function toast(msg, type = 'info') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  stack.appendChild(el);
  requestAnimationFrame(() => { el.classList.add('show'); });
  const id = ++toastId;
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3500);
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function fmtDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function fmtUptime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + '時間' + m + '分' : m + '分';
}

// =============================================
// モーダル
// =============================================
let modalCallback = null;
function openModal(title, body, btnLabel = '削除する', btnClass = 'btn-danger') {
  return new Promise(resolve => {
    document.getElementById('modal-title-text').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    const btn = document.getElementById('modal-confirm-btn');
    btn.textContent = btnLabel;
    btn.className = 'btn ' + btnClass;
    modalCallback = resolve;
    document.getElementById('modal-backdrop').classList.add('open');
  });
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  if (modalCallback) { modalCallback(false); modalCallback = null; }
}
function confirmModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  if (modalCallback) { modalCallback(true); modalCallback = null; }
}
document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// =============================================
// ナビゲーション
// =============================================
const PANE_TITLES = {
  overview: '概要', prefs: '通知設定',
  recruits: '募集一覧', study: '勉強ロール', data: 'データ管理'
};
let currentPane = 'overview';

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const pane = btn.dataset.pane;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pane-' + pane).classList.add('active');
    document.getElementById('topbar-title').textContent = PANE_TITLES[pane] || pane;
    currentPane = pane;
    refreshCurrent();
  });
});

function refreshCurrent() {
  const fns = { overview: loadOverview, prefs: loadPreferences, recruits: loadRecruitments, study: loadStudyRoles, data: loadFiles };
  if (fns[currentPane]) fns[currentPane]();
  loadStatus();
}

// =============================================
// ステータス
// =============================================
async function loadStatus() {
  try {
    const data = await apiFetch(API.status);
    const dot   = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    const meta  = document.getElementById('status-meta');
    dot.className = 'status-dot ' + (data.ready ? 'online' : 'offline');
    label.textContent = data.ready ? '稼働中' : '未接続';
    meta.textContent = (data.guildName || '不明なサーバー') + ' · ' + (data.memberCount ?? '?') + '人 · ' + (data.botTag || '?');
    const uptimeEl = document.getElementById('uptime-label');
    if (uptimeEl) uptimeEl.textContent = '稼働時間: ' + fmtUptime(data.uptimeSeconds || 0);
  } catch { /* silent */ }
}

// =============================================
// 汎用 fetch
// =============================================
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = 'HTTPエラー ' + res.status;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// =============================================
// 概要タブ
// =============================================
async function loadOverview() {
  const [statusData, prefData, recruitData, studyData] = await Promise.allSettled([
    apiFetch(API.status),
    apiFetch(API.preferences),
    apiFetch(API.recruitments),
    apiFetch(API.studyRoles),
  ]);

  const s = statusData.value || {};
  const p = prefData.value || { members: [] };
  const r = recruitData.value || { recruitments: [] };
  const st = studyData.value || { records: [] };

  const inCount = (p.members || []).filter(m => m.preference === 'in').length;

  document.getElementById('overview-stats').innerHTML = [
    ['メンバー数',     s.memberCount ?? '-',     ''],
    ['通知オン',      inCount,                   'green'],
    ['アクティブ募集', r.total ?? '-',            'yellow'],
    ['勉強ロール数',   st.total ?? '-',           'accent'],
  ].map(([label, num, cls]) =>
    '<div class="stat"><div class="stat-num' + (cls ? ' ' + cls : '') + '">' + num + '</div><div class="stat-label">' + label + '</div></div>'
  ).join('');

  // 最近の募集
  const recruits = (r.recruitments || []).slice(0, 10);
  const rtbody = document.getElementById('overview-recruit-tbody');
  if (recruits.length === 0) {
    rtbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">募集がありません</td></tr>';
  } else {
    rtbody.innerHTML = recruits.map(r =>
      '<tr><td>' + esc(r.game) + '</td><td>' + esc(r.datetime || '-') + '</td>' +
      '<td><span class="pill pill-green">' + r.counts.join + '</span></td>' +
      '<td><span class="pill pill-red">' + r.counts.decline + '</span></td>' +
      '<td>' + fmtDate(r.createdAt) + '</td></tr>'
    ).join('');
  }

  // 最近の勉強ロール
  const studyList = (st.records || []).slice(0, 5);
  const stbody = document.getElementById('overview-study-tbody');
  if (studyList.length === 0) {
    stbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text3)">記録がありません</td></tr>';
  } else {
    stbody.innerHTML = studyList.map(r =>
      '<tr>' +
      '<td><div class="user-cell">' + (r.avatarUrl ? '<img class="avatar" src="' + esc(r.avatarUrl) + '" onerror="this.style.display=\'none\'">' : '') + '<span class="user-name">' + esc(r.displayName) + '</span></div></td>' +
      '<td>' + (r.subject ? '<span class="pill pill-accent">' + esc(r.subject) + '</span>' : '<span style="color:var(--text3)">-</span>') + '</td>' +
      '<td>' + fmtDate(r.assignedAt) + '</td></tr>'
    ).join('');
  }
}

// =============================================
// 通知設定タブ
// =============================================
let prefData = [];

async function loadPreferences() {
  try {
    const data = await apiFetch(API.preferences);
    prefData = data.members || [];
    document.getElementById('badge-prefs').textContent = prefData.length;
    renderPreferences();
  } catch (err) {
    toast('通知設定の取得に失敗しました: ' + err.message, 'error');
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

  const counts = {};
  for (const m of prefData) counts[m.preference] = (counts[m.preference] || 0) + 1;

  document.getElementById('pref-stats').innerHTML = [
    ['受け取る',     counts['in']    || 0, 'green'],
    ['受け取らない', counts['out']   || 0, 'red'],
    ['未設定',       counts['unset'] || 0, ''],
    ['合計',         prefData.length,       ''],
  ].map(([label, num, cls]) =>
    '<div class="stat"><div class="stat-num' + (cls ? ' ' + cls : '') + '">' + num + '</div><div class="stat-label">' + label + '</div></div>'
  ).join('');

  const tbody = document.getElementById('pref-tbody');
  document.getElementById('pref-empty').style.display = filtered.length ? 'none' : 'block';

  tbody.innerHTML = filtered.map(m => {
    const pillClass = m.preference === 'in' ? 'pill-green' : m.preference === 'out' ? 'pill-red' : 'pill-gray';
    const pillLabel = m.preference === 'in' ? '受け取る' : m.preference === 'out' ? '受け取らない' : '未設定';
    return '<tr id="pref-row-' + m.userId + '">' +
      '<td><div class="user-cell"><img class="avatar" src="' + esc(m.avatarUrl) + '" onerror="this.style.display=\'none\'"><span class="user-name">' + esc(m.displayName) + '</span></div></td>' +
      '<td style="font-family:monospace;font-size:12px;color:var(--text3)">' + m.userId + '</td>' +
      '<td><span class="pill ' + pillClass + '">' + pillLabel + '</span></td>' +
      '<td class="actions-cell">' +
        (m.preference !== 'unset'
          ? '<button class="btn btn-danger btn-sm btn-icon" title="設定をリセット" onclick="deletePref(' + "'" + m.userId + "'" + ',this)">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
            '</button>'
          : '<span style="color:var(--text3);font-size:12px">-</span>') +
      '</td></tr>';
  }).join('');
}

async function deletePref(userId, btn) {
  const confirmed = await openModal(
    '通知設定をリセット',
    'このユーザー (<strong>' + esc(userId) + '</strong>) の通知設定を削除（未設定に戻す）しますか？',
    'リセットする', 'btn-danger'
  );
  if (!confirmed) return;
  btn.disabled = true;
  try {
    await apiFetch(API.delPref(userId), { method: 'DELETE' });
    toast('通知設定をリセットしました', 'success');
    await loadPreferences();
  } catch (err) {
    toast('削除に失敗しました: ' + err.message, 'error');
    btn.disabled = false;
  }
}

document.getElementById('pref-search').addEventListener('input', renderPreferences);
document.getElementById('pref-filter').addEventListener('change', renderPreferences);

// =============================================
// 募集一覧タブ
// =============================================
let recruitData = [];

async function loadRecruitments() {
  try {
    const data = await apiFetch(API.recruitments);
    recruitData = data.recruitments || [];
    document.getElementById('badge-recruits').textContent = recruitData.length;
    renderRecruitments();
  } catch (err) {
    toast('募集一覧の取得に失敗しました: ' + err.message, 'error');
  }
}

function renderRecruitments() {
  const search = document.getElementById('recruit-search').value.trim().toLowerCase();
  const filtered = recruitData.filter(r =>
    !search || (r.game || '').toLowerCase().includes(search)
  );

  const counts = { total: recruitData.length };
  const joinTotal = recruitData.reduce((s, r) => s + r.counts.join, 0);

  document.getElementById('recruit-stats').innerHTML = [
    ['募集総数', counts.total, ''],
    ['総参加者', joinTotal,    'green'],
  ].map(([label, num, cls]) =>
    '<div class="stat"><div class="stat-num' + (cls ? ' ' + cls : '') + '">' + num + '</div><div class="stat-label">' + label + '</div></div>'
  ).join('');

  const tbody = document.getElementById('recruit-tbody');
  document.getElementById('recruit-empty').style.display = filtered.length ? 'none' : 'block';

  tbody.innerHTML = filtered.map(r => {
    const now = Date.now();
    const expired = r.expiresAt && r.expiresAt < now;
    return '<tr id="recruit-row-' + esc(r.id) + '">' +
      '<td><span style="font-weight:600">' + esc(r.game) + '</span>' +
        (expired ? ' <span class="pill pill-gray" style="font-size:10px">期限切れ</span>' : '') +
      '</td>' +
      '<td>' + esc(r.datetime || '-') + '</td>' +
      '<td>' + (r.capacity || '-') + '</td>' +
      '<td><span class="pill pill-green">' + r.counts.join + '</span></td>' +
      '<td><span class="pill pill-red">' + r.counts.decline + '</span></td>' +
      '<td><span class="pill pill-gray">' + r.counts.unsure + '</span></td>' +
      '<td style="font-size:12px;color:var(--text3)">' + fmtDate(r.createdAt) + '</td>' +
      '<td class="actions-cell">' +
        '<button class="btn btn-secondary btn-sm btn-icon" title="募集を強制終了" onclick="closeRecruit(' + "'" + esc(r.id) + "'" + ',this)">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
        '</button>' +
        ' <button class="btn btn-danger btn-sm btn-icon" title="データを削除" onclick="deleteRecruit(' + "'" + esc(r.id) + "'" + ',this)">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
        '</button>' +
      '</td></tr>';
  }).join('');
}

async function closeRecruit(id, btn) {
  const confirmed = await openModal(
    '募集を強制終了',
    '募集 ID: <strong>' + esc(id) + '</strong> を強制終了します。<br>Discordのメッセージも終了済みに更新されます。',
    '終了する', 'btn-danger'
  );
  if (!confirmed) return;
  btn.disabled = true;
  try {
    await apiFetch(API.closeRecruit(id), { method: 'POST' });
    toast('募集を終了しました', 'success');
    await loadRecruitments();
  } catch (err) {
    toast('終了に失敗しました: ' + err.message, 'error');
    btn.disabled = false;
  }
}

async function deleteRecruit(id, btn) {
  const confirmed = await openModal(
    '募集データを削除',
    '募集 ID: <strong>' + esc(id) + '</strong> のデータを削除します。<br><br>この操作はDiscordのメッセージを変更しません。データのみを削除します。',
    '削除する', 'btn-danger'
  );
  if (!confirmed) return;
  const row = document.getElementById('recruit-row-' + id);
  if (row) row.classList.add('deleting');
  try {
    await apiFetch(API.delRecruit(id), { method: 'DELETE' });
    toast('募集データを削除しました', 'success');
    await loadRecruitments();
  } catch (err) {
    toast('削除に失敗しました: ' + err.message, 'error');
    if (row) row.classList.remove('deleting');
  }
}

document.getElementById('recruit-search').addEventListener('input', renderRecruitments);

// =============================================
// 勉強ロールタブ
// =============================================
let studyData = [];

async function loadStudyRoles() {
  try {
    const data = await apiFetch(API.studyRoles);
    studyData = data.records || [];
    document.getElementById('badge-study').textContent = studyData.length;
    renderStudyRoles();
  } catch (err) {
    toast('勉強ロール一覧の取得に失敗しました: ' + err.message, 'error');
  }
}

function renderStudyRoles() {
  const search = document.getElementById('study-search').value.trim().toLowerCase();
  const filtered = studyData.filter(r =>
    !search || r.tag.toLowerCase().includes(search) || r.displayName.toLowerCase().includes(search)
  );

  const tbody = document.getElementById('study-tbody');
  document.getElementById('study-empty').style.display = filtered.length ? 'none' : 'block';

  tbody.innerHTML = filtered.map(r =>
    '<tr id="study-row-' + r.userId + '">' +
    '<td><div class="user-cell">' + (r.avatarUrl ? '<img class="avatar" src="' + esc(r.avatarUrl) + '" onerror="this.style.display=\'none\'">' : '') + '<span class="user-name">' + esc(r.displayName) + '</span></div></td>' +
    '<td style="font-family:monospace;font-size:12px;color:var(--text3)">' + r.userId + '</td>' +
    '<td>' + (r.subject ? '<span class="pill pill-accent">' + esc(r.subject) + '</span>' : '<span style="color:var(--text3)">未設定</span>') + '</td>' +
    '<td style="font-size:12px;color:var(--text3)">' + fmtDate(r.assignedAt) + '</td>' +
    '<td class="actions-cell">' +
      '<button class="btn btn-danger btn-sm btn-icon" title="記録を削除" onclick="deleteStudy(' + "'" + r.userId + "'" + ',this)">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
      '</button>' +
    '</td></tr>'
  ).join('');
}

async function deleteStudy(userId, btn) {
  const rec = studyData.find(r => r.userId === userId);
  const confirmed = await openModal(
    '勉強ロール記録を削除',
    'ユーザー <strong>' + esc(rec?.displayName || userId) + '</strong> の勉強ロール記録を削除します。<br>※Discordのロール自体は自動では剥奪されません。<code>/study-role remove</code> コマンドも実行してください。',
    '削除する', 'btn-danger'
  );
  if (!confirmed) return;
  const row = document.getElementById('study-row-' + userId);
  if (row) row.classList.add('deleting');
  try {
    await apiFetch(API.delStudy(userId), { method: 'DELETE' });
    toast('記録を削除しました', 'success');
    await loadStudyRoles();
  } catch (err) {
    toast('削除に失敗しました: ' + err.message, 'error');
    if (row) row.classList.remove('deleting');
  }
}

document.getElementById('study-search').addEventListener('input', renderStudyRoles);

// =============================================
// データ管理タブ
// =============================================
let currentImportFile = null;

async function loadFiles() {
  try {
    const data = await apiFetch(API.files);
    const container = document.getElementById('file-list');
    container.innerHTML = data.files.map(f => {
      const size = f.exists ? formatBytes(f.size) : '未作成';
      const modified = f.modifiedAt ? fmtDate(new Date(f.modifiedAt).getTime()) : '-';
      const badgeCls = f.exists ? '' : ' missing';
      return '<div class="file-row">' +
        '<div>' +
          '<div class="file-name">' +
            '<span class="file-badge' + badgeCls + '">' + (f.exists ? '存在' : '未作成') + '</span>' +
            esc(f.name) +
          '</div>' +
          '<div class="file-meta">' + size + '　最終更新: ' + modified + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<button class="btn btn-secondary btn-sm" onclick="copyFile(' + "'" + f.name + "'" + ')" ' + (!f.exists ? 'disabled' : '') + '>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            'コピー' +
          '</button>' +
          '<a class="btn btn-secondary btn-sm" href="' + API.exportFile(f.name) + '" download ' + (!f.exists ? 'style="pointer-events:none;opacity:.4"' : '') + '>' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            'ダウンロード' +
          '</a>' +
          '<button class="btn btn-primary btn-sm" onclick="openImportPanel(' + "'" + f.name + "'" + ')">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>' +
            'インポート' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (err) {
    toast('ファイル一覧の取得に失敗しました: ' + err.message, 'error');
  }
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}

async function copyFile(name) {
  try {
    const res = await fetch(API.exportFile(name));
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    toast(name + ' をクリップボードにコピーしました', 'success');
  } catch (err) {
    toast('コピーに失敗しました: ' + err.message, 'error');
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

document.getElementById('import-file-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    JSON.parse(text); // バリデーション
    document.getElementById('import-textarea').value = text;
    toast('ファイルを読み込みました。内容を確認してからインポートしてください。', 'info');
  } catch (err) {
    toast('JSONの形式が不正です: ' + err.message, 'error');
  }
});

async function submitImport() {
  if (!currentImportFile) return;
  const content = document.getElementById('import-textarea').value.trim();
  if (!content) { toast('JSONを入力してください', 'error'); return; }
  try { JSON.parse(content); } catch (err) { toast('JSONの形式が不正です: ' + err.message, 'error'); return; }

  const confirmed = await openModal(
    'データをインポート',
    '<strong>' + esc(currentImportFile) + '</strong> を上書きします。<br>上書き前に自動バックアップされますが、この操作は取り消せません。',
    'インポートする', 'btn-primary'
  );
  if (!confirmed) return;

  try {
    const data = await apiFetch(API.importFile(currentImportFile), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: content
    });
    toast(currentImportFile + ' をインポートしました（' + (data.keys || 0) + ' 件）', 'success');
    closeImportPanel();
    loadFiles();
  } catch (err) {
    toast('インポートに失敗しました: ' + err.message, 'error');
  }
}

// =============================================
// 初期化
// =============================================
loadStatus();
loadOverview();
loadPreferences();
loadRecruitments();
loadStudyRoles();
loadFiles();
setInterval(loadStatus, 30000);
</script>
</body>
</html>`;
