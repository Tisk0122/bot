// ==============================================
// web/dashboardHtml.js
// 管理者ダッシュボード (リニューアル版)
// ==============================================

export const DASHBOARD_HTML = /* html */`<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%235865f2%22/%3E%3Cpath d=%22M32 10 51 18v14c0 12-8 19-19 23C21 51 13 44 13 32V18z%22 fill=%22none%22 stroke=%22white%22 stroke-width=%224%22/%3E%3C/svg%3E">
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

/* ── Server-grade boot / loading overlay ── */
.boot-overlay{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;background:rgba(7,9,14,.96);backdrop-filter:blur(18px);transition:opacity .45s ease,visibility .45s ease}
.boot-overlay.is-hidden{opacity:0;visibility:hidden;pointer-events:none}
.boot-panel{width:min(460px,calc(100vw - 36px));padding:30px;border:1px solid rgba(88,101,242,.28);border-radius:18px;background:linear-gradient(145deg,#171b28,#0e1119);box-shadow:0 24px 90px rgba(0,0,0,.55),0 0 55px rgba(88,101,242,.08)}
.boot-brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}
.boot-mark{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:rgba(88,101,242,.16);border:1px solid rgba(88,101,242,.35);color:#aab2ff;font-size:20px}
.boot-brand strong{display:block;font-size:14px;letter-spacing:.04em}
.boot-brand small{display:block;color:var(--text3);font-size:11px;margin-top:2px}
.boot-orbit{height:116px;display:grid;place-items:center;position:relative;margin:0 auto 20px}
.boot-orbit:before,.boot-orbit:after{content:'';position:absolute;border:1px solid rgba(88,101,242,.22);border-radius:50%;animation:boot-spin 5s linear infinite}
.boot-orbit:before{width:92px;height:92px;border-top-color:#8791ff;border-right-color:#8791ff}
.boot-orbit:after{width:66px;height:66px;border-bottom-color:#3ba55c;animation-direction:reverse;animation-duration:3.2s}
.boot-core{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#6875ff,#343eaa);box-shadow:0 0 32px rgba(88,101,242,.45);display:grid;place-items:center;color:white;font-weight:800}
@keyframes boot-spin{to{transform:rotate(360deg)}}
.boot-title{text-align:center;font-size:16px;font-weight:700}
.boot-subtitle{text-align:center;color:var(--text3);font-size:12px;margin-top:5px}
.boot-progress{height:5px;background:#252a3a;border-radius:99px;overflow:hidden;margin:23px 0 14px}
.boot-progress>span{display:block;height:100%;width:12%;border-radius:99px;background:linear-gradient(90deg,#5865f2,#8b98ff,#3ba55c);box-shadow:0 0 14px rgba(88,101,242,.5);transition:width .35s ease}
.boot-meta{display:flex;justify-content:space-between;gap:12px;color:var(--text3);font-size:11px;font-family:ui-monospace,monospace}
.boot-steps{display:grid;gap:9px;margin-top:22px}
.boot-step{display:flex;align-items:center;gap:9px;color:var(--text3);font-size:12px}
.boot-step .step-icon{width:17px;height:17px;border:1px solid var(--border2);border-radius:50%;display:grid;place-items:center;font-size:9px}
.boot-step.active{color:var(--text)}
.boot-step.done{color:#6be08a}
.boot-step.done .step-icon{border-color:var(--green);background:var(--green-bg)}
.boot-error{display:none;margin-top:18px;padding:12px;border:1px solid rgba(237,66,69,.35);border-radius:9px;background:var(--red-bg);color:#ff9ca4;font-size:12px;line-height:1.6}
.boot-error.show{display:block}
.boot-retry{display:none;width:100%;margin-top:12px;padding:10px;border:0;border-radius:8px;background:var(--accent);color:white;font-weight:700;cursor:pointer}
.boot-retry.show{display:block}
@media(prefers-reduced-motion:reduce){.boot-orbit:before,.boot-orbit:after{animation:none}.skeleton{animation:none}}


/* ── Management forms ── */
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.form-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.form-field.full{grid-column:1/-1}
.form-label{font-size:12px;font-weight:700;color:var(--text2)}
.form-help{font-size:11px;color:var(--text3);line-height:1.55}
.form-control{width:100%;min-width:0;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:10px 11px;border-radius:8px;font:inherit;font-size:13px;outline:none;transition:border .15s,box-shadow .15s}
.form-control:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(88,101,242,.12)}
.form-control::placeholder{color:var(--text3)}
.form-control.textarea{min-height:112px;resize:vertical;font-family:inherit}
.action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}
.action-card{margin:0;padding:20px}
.action-card .card-header{margin-bottom:16px}
.action-card .card-title{font-size:14px}
.action-card .card-desc{max-width:520px;line-height:1.6}
.form-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;align-items:center}
.section-intro{margin:0 0 18px}
.section-intro h2{font-size:20px;letter-spacing:-.02em;margin-bottom:5px}
.section-intro p{font-size:12px;color:var(--text3);line-height:1.65}
.config-status{display:flex;align-items:center;gap:9px;padding:12px 14px;border:1px solid var(--border);background:var(--surface2);border-radius:9px;font-size:12px;color:var(--text2);margin-bottom:16px}
.config-status .status-dot{flex-shrink:0}
.notice{padding:12px 14px;border:1px solid rgba(250,168,26,.28);background:var(--yellow-bg);border-radius:9px;color:#f7cd77;font-size:12px;line-height:1.6;margin-top:14px}
.inline-select{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:5px 7px;border-radius:6px;font-size:12px;max-width:135px}
.action-result{font-size:12px;color:var(--text3);min-height:16px}
@media(max-width:900px){.action-grid{grid-template-columns:1fr}}
@media(max-width:600px){.form-grid{grid-template-columns:1fr}.form-field.full{grid-column:auto}.action-card{padding:16px}}

/* ── Confirm row highlight ── */
tr.deleting td{background:var(--red-bg)!important;transition:background .15s}
</style>
</head>
<body>

<div class="boot-overlay" id="boot-overlay" role="status" aria-live="polite">
  <div class="boot-panel">
    <div class="boot-brand">
      <div class="boot-mark">⌘</div>
      <div><strong>HINANSABA CONTROL</strong><small>SERVER MANAGEMENT SYSTEM</small></div>
    </div>
    <div class="boot-orbit"><div class="boot-core">H</div></div>
    <div class="boot-title" id="boot-title">サーバーへ接続しています</div>
    <div class="boot-subtitle" id="boot-subtitle">管理データベースとAPIの応答を確認中...</div>
    <div class="boot-progress"><span id="boot-progress-bar"></span></div>
    <div class="boot-meta"><span id="boot-stage">INITIALIZING</span><span id="boot-percent">12%</span></div>
    <div class="boot-steps">
      <div class="boot-step active" id="boot-step-connection"><span class="step-icon">1</span>サーバー接続を確認</div>
      <div class="boot-step" id="boot-step-api"><span class="step-icon">2</span>APIエンドポイントを初期化</div>
      <div class="boot-step" id="boot-step-data"><span class="step-icon">3</span>管理データを取得</div>
      <div class="boot-step" id="boot-step-render"><span class="step-icon">4</span>ダッシュボードを構築</div>
    </div>
    <div class="boot-error" id="boot-error"></div>
    <button class="boot-retry" id="boot-retry" onclick="bootDashboard()">再接続して読み込む</button>
  </div>
</div>

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
      <button class="nav-item" data-pane="config">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.02a1.7 1.7 0 0 0-1.78.48l-.06.06h-3.4l-.02-.08a1.7 1.7 0 0 0-1.34-1.24 1.7 1.7 0 0 0-1.34 1.24l-.02.08h-3.4l-.06-.06a1.7 1.7 0 0 0-1.78-.48l-.08.02-1.7-2.94.06-.06A1.7 1.7 0 0 0 3.4 15l-.08-.02v-3.4l.08-.02a1.7 1.7 0 0 0 1.24-1.34 1.7 1.7 0 0 0-1.24-1.34l-.08-.02V5.46l.08-.02a1.7 1.7 0 0 0 1.24-1.34 1.7 1.7 0 0 0-1.24-1.34l-.08-.02 1.7-2.94.08.02a1.7 1.7 0 0 0 1.78-.48l.06-.06h3.4l.02.08a1.7 1.7 0 0 0 1.34 1.24 1.7 1.7 0 0 0 1.34-1.24l.02-.08h3.4l.06.06a1.7 1.7 0 0 0 1.78.48l.08-.02 1.7 2.94-.06.06A1.7 1.7 0 0 0 20.6 5l.08.02v3.4l-.08.02a1.7 1.7 0 0 0-1.24 1.34 1.7 1.7 0 0 0 1.24 1.34l.08.02v3.4z" transform="translate(0 1) scale(.92)"/></svg>
        サーバー設定
      </button>
      <button class="nav-item" data-pane="actions">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>
        管理操作
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

      <!-- ===== サーバー設定 ===== -->
      <div class="pane" id="pane-config">
        <div class="section-intro">
          <h2>サーバー設定</h2>
          <p>通常コマンドやBotの環境変数で管理していたチャンネル・ロール設定を、ここから一元管理できます。保存後は対応する機能へ即時反映されます。</p>
        </div>
        <div class="config-status" id="config-health"><span class="status-dot online"></span><span>サーバー設定を読み込んでいます…</span></div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">チャンネル設定</div><div class="card-desc">機能ごとの送信先・対象VCを指定します。</div></div></div>
          <div class="form-grid">
            <label class="form-field"><span class="form-label">認証チャンネル</span><select class="form-control" id="cfg-verification"></select><span class="form-help">認証ボードを設置するテキストチャンネル。</span></label>
            <label class="form-field"><span class="form-label">認証申請チャンネル</span><select class="form-control" id="cfg-moderation"></select><span class="form-help">メンバーが認証を申請した際、管理者向けの承認ボタンを送信。</span></label>
            <label class="form-field"><span class="form-label">BAN管理チャンネル</span><select class="form-control" id="cfg-ban"></select><span class="form-help">既存のメッセージ式BAN管理コマンドとBANリストの送信先。</span></label>
            <label class="form-field"><span class="form-label">勉強VC</span><select class="form-control" id="cfg-study-vc"></select><span class="form-help">勉強中ロール以外の接続を拒否するボイスチャンネル。</span></label>
            <label class="form-field"><span class="form-label">勉強VCログ</span><select class="form-control" id="cfg-study-log"></select><span class="form-help">勉強VCの入退室ログをサイレント送信。</span></label>
            <label class="form-field"><span class="form-label">管理ログチャンネル</span><select class="form-control" id="cfg-log"></select><span class="form-help">BAN・解除・メッセージ削除などの監査ログ。</span></label>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">ロール・動作設定</div><div class="card-desc">入室資格や自動処理の基本ルールを設定します。</div></div></div>
          <div class="form-grid">
            <label class="form-field"><span class="form-label">勉強ロール名</span><input class="form-control" id="cfg-study-role-name" type="text" maxlength="80" placeholder="勉強中"><span class="form-help">未作成の場合は保存時に自動作成し、勉強VCの接続権限も設定。</span></label>
            <label class="form-field"><span class="form-label">管理者ロール</span><select class="form-control" id="cfg-admin-role"></select><span class="form-help">設定したロール、またはDiscord標準の「管理者」権限を持つメンバーに管理操作を許可。空欄でも管理者権限で利用できます。</span></label>
            <label class="form-field"><span class="form-label">認証済みロール</span><select class="form-control" id="cfg-verified-role"></select><span class="form-help">認証承認時に対象メンバーへ付与するロール。</span></label>
          </div>
          <div class="notice">勉強VCの保存時はDiscordのチャンネル権限も更新します。@everyone は接続拒否、勉強ロールは接続許可になります。Botには「チャンネルの管理」「ロールの管理」「メンバーを移動」権限が必要です。</div>
          <div class="form-actions"><button class="btn btn-primary" onclick="saveGuildConfig()">設定を保存</button><button class="btn btn-secondary" onclick="loadConfig()">変更を取り消す</button><button class="btn btn-secondary" onclick="syncStudyVcPermissions()">勉強VCの権限を再適用</button><span class="action-result" id="config-result"></span></div>
        </div>
      </div>

      <!-- ===== 通知設定 ===== -->
      <div class="pane" id="pane-prefs">
        <div class="stat-grid" id="pref-stats"></div>
        <div class="card">
          <div class="card-header"><div><div class="card-title">通知設定の初期案内を送信</div><div class="card-desc">/recruit-notify-init と同等。募集DM通知が未設定のキャッシュ済みメンバーへ、受け取り設定ボタン付きDMを送信します。</div></div></div>
          <div class="notice">一度に最大50人ずつ送信します。未処理が残る場合は再実行してください。Discord Gatewayの全メンバー取得は使用しないため、現在Botのキャッシュにいないメンバーは対象外です。DMを受信拒否しているメンバーには届きません。</div>
          <div class="form-actions"><button class="btn btn-primary" id="pref-init-btn" onclick="sendPreferenceInit()">初期案内DMを送信</button><span class="action-result" id="pref-init-result"></span></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                募集DM通知の設定状況
              </div>
              <div class="card-desc" id="pref-cache-note">メンバーごとの通知受け取り設定一覧です</div>
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

      <!-- ===== 管理操作 ===== -->
      <div class="pane" id="pane-actions">
        <div class="section-intro">
          <h2>管理操作センター</h2>
          <p>スラッシュコマンドで実行していた投稿・募集・認証・削除操作を、この画面から実行できます。実行前に送信先と内容を確認してください。</p>
        </div>
        <div class="action-grid">
          <div class="card action-card">
            <div class="card-header"><div><div class="card-title">お知らせを送信</div><div class="card-desc">/announce と同等。ロールメンション付きの公式お知らせを投稿します。</div></div></div>
            <div class="form-grid">
              <label class="form-field full"><span class="form-label">タイトル</span><input class="form-control" id="announce-title" maxlength="256" placeholder="例：サーバーからのお知らせ"></label>
              <label class="form-field full"><span class="form-label">本文</span><textarea class="form-control textarea" id="announce-message" maxlength="4096" placeholder="お知らせ内容を入力…"></textarea></label>
              <label class="form-field"><span class="form-label">送信先</span><select class="form-control text-channel-select" id="announce-channel"></select></label>
              <label class="form-field"><span class="form-label">メンションロール（任意）</span><select class="form-control role-select" id="announce-role"></select></label>
              <label class="form-field"><span class="form-label">Embedカラー</span><input class="form-control" id="announce-color" type="text" value="#ffc107" placeholder="#5865f2 / blue / green"></label>
            </div>
            <div class="form-actions"><button class="btn btn-primary" onclick="submitAnnouncement()">お知らせを送信</button></div>
          </div>

          <div class="card action-card">
            <div class="card-header"><div><div class="card-title">カスタムEmbed</div><div class="card-desc">/embed と同等。画像・サムネイル・フッターを設定して投稿します。</div></div></div>
            <div class="form-grid">
              <label class="form-field full"><span class="form-label">タイトル</span><input class="form-control" id="embed-title" maxlength="256" placeholder="Embedタイトル"></label>
              <label class="form-field full"><span class="form-label">本文</span><textarea class="form-control textarea" id="embed-description" maxlength="4096" placeholder="Embed本文…"></textarea></label>
              <label class="form-field"><span class="form-label">送信先</span><select class="form-control text-channel-select" id="embed-channel"></select></label>
              <label class="form-field"><span class="form-label">カラー</span><input class="form-control" id="embed-color" value="#5865f2" placeholder="#5865f2"></label>
              <label class="form-field full"><span class="form-label">フッター（任意）</span><input class="form-control" id="embed-footer" maxlength="2048" placeholder="フッターテキスト"></label>
              <label class="form-field full"><span class="form-label">画像URL（任意）</span><input class="form-control" id="embed-image" type="url" placeholder="https://example.com/image.png"></label>
              <label class="form-field full"><span class="form-label">サムネイルURL（任意）</span><input class="form-control" id="embed-thumbnail" type="url" placeholder="https://example.com/thumb.png"></label>
            </div>
            <div class="form-actions"><button class="btn btn-primary" onclick="submitEmbed()">Embedを送信</button></div>
          </div>

          <div class="card action-card">
            <div class="card-header"><div><div class="card-title">参加者募集を作成</div><div class="card-desc">/recruit と同等。参加ボタン付き募集を投稿し、通知オンのキャッシュ済みメンバーへDMできます。</div></div></div>
            <div class="form-grid">
              <label class="form-field full"><span class="form-label">ゲーム・イベント名</span><input class="form-control" id="recruit-game" maxlength="256" placeholder="例：VALORANT カスタム"></label>
              <label class="form-field full"><span class="form-label">詳細（任意）</span><textarea class="form-control textarea" id="recruit-description" maxlength="4000" placeholder="ルール・参加条件など"></textarea></label>
              <label class="form-field"><span class="form-label">日時（任意）</span><input class="form-control" id="recruit-datetime" maxlength="200" placeholder="今すぐ / 21:00〜 / 未定"></label>
              <label class="form-field"><span class="form-label">定員（任意）</span><input class="form-control" id="recruit-capacity" type="number" min="1" max="999" placeholder="指定なし"></label>
              <label class="form-field"><span class="form-label">有効期限</span><select class="form-control" id="recruit-expiry"><option value="1">1時間</option><option value="6">6時間</option><option value="12">12時間</option><option value="24" selected>24時間</option><option value="48">48時間</option><option value="72">72時間</option><option value="168">7日間</option></select></label>
              <label class="form-field"><span class="form-label">投稿先</span><select class="form-control text-channel-select" id="recruit-channel"></select></label>
            </div>
            <label class="form-field" style="margin-top:12px"><span class="form-label"><input id="recruit-notify-optin" type="checkbox" checked style="margin-right:7px">通知オンのメンバーへDMを送信</span><span class="form-help">Gatewayの全メンバー取得は行わず、キャッシュ済みメンバーだけを対象にします。</span></label>
            <div class="form-actions"><button class="btn btn-primary" onclick="submitRecruit()">募集を作成</button></div>
          </div>

          <div class="card action-card">
            <div class="card-header"><div><div class="card-title">認証ボードを設置</div><div class="card-desc">/setup-verify と同等。サーバー設定で指定した認証チャンネルにボタンを設置します。</div></div></div>
            <div class="config-status"><span class="status-dot online"></span><span id="verify-channel-summary">認証チャンネルを確認中…</span></div>
            <p class="form-help">既に設置済みのボードがあっても、新しいボードを追加で投稿します。重複投稿に注意してください。</p>
            <div class="form-actions"><button class="btn btn-primary" onclick="setupVerifyBoard()">認証ボードを設置</button></div>
          </div>

          <div class="card action-card">
            <div class="card-header"><div><div class="card-title">ニックネームを管理</div><div class="card-desc">既存の「ニックネーム」メッセージ操作をダッシュボードから実行します。</div></div></div>
            <div class="form-grid">
              <label class="form-field full"><span class="form-label">対象ユーザーID</span><input class="form-control" id="nickname-user-id" inputmode="numeric" placeholder="123456789012345678"></label>
              <label class="form-field full"><span class="form-label">新しいニックネーム</span><input class="form-control" id="nickname-value" maxlength="32" placeholder="1〜32文字"></label>
            </div>
            <div class="form-help">Botに「ニックネームの管理」権限が必要です。対象メンバーよりBotのロールが上位である必要があります。</div>
            <div class="form-actions"><button class="btn btn-primary" onclick="submitNickname('set')">ニックネームを変更</button><button class="btn btn-secondary" onclick="submitNickname('reset')">元に戻す</button></div>
          </div>

          <div class="card action-card">
            <div class="card-header"><div><div class="card-title">BAN・BAN解除</div><div class="card-desc">サーバーのモデレーション操作。実行にはBotの「メンバーをBAN」権限が必要です。</div></div></div>
            <div class="form-grid">
              <label class="form-field"><span class="form-label">操作</span><select class="form-control" id="ban-action"><option value="ban">BANする</option><option value="unban">BANを解除する</option></select></label>
              <label class="form-field"><span class="form-label">DiscordユーザーID</span><input class="form-control" id="ban-user-id" inputmode="numeric" placeholder="123456789012345678"></label>
              <label class="form-field full"><span class="form-label">理由</span><input class="form-control" id="ban-reason" maxlength="450" placeholder="理由を入力（監査ログに記録）"></label>
            </div>
            <div class="notice">BANは対象ユーザーのサーバー参加を禁止します。IDと理由を必ず確認してから実行してください。</div>
            <div class="form-actions"><button class="btn btn-danger" onclick="submitBanAction()">操作を確認して実行</button></div>
          </div>

          <div class="card action-card">
            <div class="card-header"><div><div class="card-title">メッセージ一括削除</div><div class="card-desc">/purge と同等。指定チャンネルの直近メッセージを最大100件削除します。</div></div></div>
            <div class="form-grid">
              <label class="form-field full"><span class="form-label">対象チャンネル</span><select class="form-control text-channel-select" id="purge-channel"></select></label>
              <label class="form-field"><span class="form-label">削除件数（1〜100）</span><input class="form-control" id="purge-count" type="number" min="1" max="100" value="20"></label>
              <label class="form-field"><span class="form-label">ユーザーIDで絞り込み（任意）</span><input class="form-control" id="purge-user-id" placeholder="Discord ID"></label>
            </div>
            <div class="notice">削除されたメッセージは復元できません。14日以上前のメッセージはDiscordの仕様により一括削除対象外です。</div>
            <div class="form-actions"><button class="btn btn-danger" onclick="submitPurge()">削除対象を確認して実行</button></div>
          </div>
        </div>
      </div>

      <!-- ===== 勉強ロール ===== -->
      <div class="pane" id="pane-study">
        <div class="card">
          <div class="card-header"><div><div class="card-title">勉強ロールを管理</div><div class="card-desc">/study-role give・remove と同じ操作を実行できます。ユーザーIDはDiscordのプロフィールからコピーできます。</div></div></div>
          <div class="form-grid">
            <label class="form-field"><span class="form-label">ユーザーID</span><input class="form-control" id="study-target-id" inputmode="numeric" placeholder="例：123456789012345678"></label>
            <label class="form-field"><span class="form-label">勉強する内容</span><input class="form-control" id="study-target-subject" maxlength="100" placeholder="数学 / 英語 / 資格勉強など"></label>
          </div>
          <div class="form-actions"><button class="btn btn-primary" onclick="submitStudyRole('give')">勉強ロールを付与</button><button class="btn btn-danger" onclick="submitStudyRole('remove')">勉強ロールを剥奪</button></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                勉強ロール管理記録
              </div>
              <div class="card-desc">Botが管理している勉強ロールの付与記録です。手動でロールを変更した場合は実際の状態と異なることがあります。</div>
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
            <p>勉強ロールの記録がありません</p>
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
  config:       '/admin/api/config',
  actionStudy:  '/admin/api/actions/study-role',
  actionStudyVcSync: '/admin/api/actions/study-vc-sync',
  actionVerify: '/admin/api/actions/setup-verify',
  actionAnnounce:'/admin/api/actions/announce',
  actionEmbed:  '/admin/api/actions/embed',
  actionRecruit:'/admin/api/actions/recruit',
  actionPurge:  '/admin/api/actions/purge',
  actionBan:    '/admin/api/actions/ban',
  actionNickname: '/admin/api/actions/nickname',
  actionPrefInit: '/admin/api/actions/recruit-notify-init',
  setPref:      (uid) => '/admin/api/preferences/' + uid,
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
  overview: '概要', config: 'サーバー設定', actions: '管理操作', prefs: '通知設定',
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
  const fns = { overview: loadOverview, config: loadConfig, actions: loadConfig, prefs: loadPreferences, recruits: loadRecruitments, study: loadStudyRoles, data: loadFiles };
  const loader = fns[currentPane];
  if (loader) Promise.resolve().then(loader).catch(err => {
    // 各ローダーは必要に応じて個別通知する。ここでは未処理Promiseだけを防止する。
    console.error('[Dashboard] pane load failed:', currentPane, err);
  });
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...opts,
      signal: opts.signal || controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(opts.headers || {})
      }
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      let msg = 'HTTP ' + res.status + ' ' + res.statusText;
      if (contentType.includes('application/json')) {
        try { const d = await res.json(); msg = d.error || msg; } catch {}
      }
      throw new Error(msg);
    }
    if (!contentType.includes('application/json')) {
      const body = await res.text();
      throw new Error('JSON以外の応答を受信しました。認証切れまたはサーバー側エラーの可能性があります: ' + body.slice(0, 120));
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('サーバー応答がタイムアウトしました（25秒）');
    if (err instanceof TypeError) throw new Error('サーバーに接続できません。ネットワークまたはサーバー状態を確認してください。');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// =============================================
// 概要タブ
// =============================================
async function loadOverview() {
  const [statusResult, prefResult, recruitResult, studyResult] = await Promise.allSettled([
    apiFetch(API.status),
    apiFetch(API.preferences),
    apiFetch(API.recruitments),
    apiFetch(API.studyRoles),
  ]);

  const ok = result => result.status === 'fulfilled';
  const s = ok(statusResult) ? statusResult.value : {};
  const p = ok(prefResult) ? prefResult.value : null;
  const r = ok(recruitResult) ? recruitResult.value : null;
  const st = ok(studyResult) ? studyResult.value : null;

  // APIの一部が失敗しても、取得に成功したカード・一覧はそのまま表示する。
  // ひとつの失敗で概要全体が空白になることを防ぐ。
  prefData = p?.members || [];
  recruitData = r?.recruitments || [];
  studyData = st?.records || [];
  if (p) updatePreferenceCacheNote(p);
  else document.getElementById('pref-cache-note').textContent = '通知データを取得できませんでした。更新して再試行してください。';

  document.getElementById('badge-prefs').textContent = p ? prefData.length : '—';
  document.getElementById('badge-recruits').textContent = r ? recruitData.length : '—';
  document.getElementById('badge-study').textContent = st ? studyData.length : '—';
  renderPreferences();
  if (!p) {
    document.getElementById('pref-tbody').innerHTML = '<tr><td colspan="4" class="empty" style="text-align:center;padding:20px;color:var(--danger)">通知設定を取得できませんでした</td></tr>';
    document.getElementById('pref-empty').style.display = 'none';
  }
  renderRecruitments();
  renderStudyRoles();

  const inCount = prefData.filter(m => m.preference === 'in').length;
  document.getElementById('overview-stats').innerHTML = [
    ['メンバー数',     s.memberCount ?? '—',     ''],
    ['通知オン',      p ? inCount : '—',          'green'],
    ['アクティブ募集', r?.total ?? '—',           'yellow'],
    ['勉強ロール数',   st?.total ?? '—',           'accent'],
  ].map(([label, num, cls]) =>
    '<div class="stat"><div class="stat-num' + (cls ? ' ' + cls : '') + '">' + esc(num) + '</div><div class="stat-label">' + label + '</div></div>'
  ).join('');

  // 最近の募集
  const recruits = (r?.recruitments || []).slice(0, 10);
  const rtbody = document.getElementById('overview-recruit-tbody');
  if (!r) {
    rtbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--danger)">募集データの取得に失敗しました</td></tr>';
  } else if (recruits.length === 0) {
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
  const studyList = (st?.records || []).slice(0, 5);
  const stbody = document.getElementById('overview-study-tbody');
  if (!st) {
    stbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--danger)">勉強ロールデータの取得に失敗しました</td></tr>';
  } else if (studyList.length === 0) {
    stbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text3)">記録がありません</td></tr>';
  } else {
    stbody.innerHTML = studyList.map(r =>
      '<tr>' +
      '<td><div class="user-cell">' + (r.avatarUrl ? '<img class="avatar" src="' + esc(r.avatarUrl) + '" onerror="this.remove()">' : '') + '<span class="user-name">' + esc(r.displayName) + '</span></div></td>' +
      '<td>' + (r.subject ? '<span class="pill pill-accent">' + esc(r.subject) + '</span>' : '<span style="color:var(--text3)">-</span>') + '</td>' +
      '<td>' + fmtDate(r.assignedAt) + '</td></tr>'
    ).join('');
  }

  const failures = [statusResult, prefResult, recruitResult, studyResult].filter(result => !ok(result));
  if (failures.length) {
    const reason = failures.map(result => result.reason?.message || '不明なAPIエラー').join(' / ');
    toast('概要の一部データを取得できませんでした。取得できた情報は表示しています: ' + reason, 'error');
  }
}

// =============================================
// 通知設定タブ
// =============================================
let prefData = [];

function updatePreferenceCacheNote(data) {
  const note = document.getElementById('pref-cache-note');
  if (!note) return;
  if (Number.isFinite(Number(data?.fetchedMemberCount))) {
    const fetched = Number(data.fetchedMemberCount);
    const cached = Number(data.cachedMemberCount || 0);
    note.textContent = 'Discordからサーバーメンバー ' + fetched.toLocaleString('ja-JP') + ' 人を取得しました（Bot内キャッシュ ' + cached.toLocaleString('ja-JP') + ' 人）。保存済み設定のサーバー外ユーザーも一覧に含みます。';
  } else {
    note.textContent = 'メンバーごとの通知受け取り設定一覧です';
  }
}

async function loadPreferences() {
  try {
    const data = await apiFetch(API.preferences);
    prefData = data.members || [];
    updatePreferenceCacheNote(data);
    document.getElementById('badge-prefs').textContent = prefData.length;
    renderPreferences();
  } catch (err) {
    toast('通知設定の取得に失敗しました: ' + err.message, 'error');
    throw err;
  }
}

function renderPreferences() {
  const search = document.getElementById('pref-search').value.trim().toLowerCase();
  const filter = document.getElementById('pref-filter').value;

  const filtered = prefData.filter(m => {
    if (filter !== 'all' && m.preference !== filter) return false;
    if (search && !(m.tag || '').toLowerCase().includes(search) && !(m.displayName || '').toLowerCase().includes(search)) return false;
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
    const pillClass = m.preference === 'in' ? 'pill-green' : m.preference === 'out' ? 'pill-red' : m.promptedAt ? 'pill-accent' : 'pill-gray';
    const pillLabel = m.preference === 'in' ? '受け取る' : m.preference === 'out' ? '受け取らない' : m.promptedAt ? '案内済・未回答' : '未設定';
    return '<tr id="pref-row-' + m.userId + '">' +
      '<td><div class="user-cell">' + (m.avatarUrl ? '<img class="avatar" src="' + esc(m.avatarUrl) + '" onerror="this.remove()">' : '') + '<span class="user-name">' + esc(m.displayName) + '</span>' + (m.isGuildMember ? '' : '<span class="pill pill-gray">サーバー外</span>') + '</div></td>' +
      '<td style="font-family:monospace;font-size:12px;color:var(--text3)">' + m.userId + '</td>' +
      '<td><span class="pill ' + pillClass + '">' + pillLabel + '</span></td>' +
      '<td class="actions-cell"><div style="display:flex;align-items:center;gap:6px">' +
        '<select class="inline-select" id="pref-select-' + esc(m.userId) + '">' +
          '<option value="unset" ' + (m.preference === 'unset' ? 'selected' : '') + '>未設定</option>' +
          '<option value="in" ' + (m.preference === 'in' ? 'selected' : '') + '>受け取る</option>' +
          '<option value="out" ' + (m.preference === 'out' ? 'selected' : '') + '>受け取らない</option>' +
        '</select>' +
        '<button class="btn btn-secondary btn-sm" onclick="updatePreference(' + "'" + m.userId + "'" + ',this)">保存</button>' +
      '</div></td></tr>';
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

async function updatePreference(userId, btn) {
  const select = document.getElementById('pref-select-' + userId);
  if (!select) return;
  const value = select.value;
  btn.disabled = true;
  try {
    if (value === 'unset') await apiFetch(API.delPref(userId), { method: 'DELETE' });
    else await apiFetch(API.setPref(userId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preference: value }) });
    toast('通知設定を更新しました', 'success');
    await loadPreferences();
  } catch (err) {
    toast('通知設定の更新に失敗しました: ' + err.message, 'error');
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
    throw err;
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
    throw err;
  }
}

function renderStudyRoles() {
  const search = document.getElementById('study-search').value.trim().toLowerCase();
  const filtered = studyData.filter(r =>
    !search || (r.tag || '').toLowerCase().includes(search) || (r.displayName || '').toLowerCase().includes(search)
  );

  const tbody = document.getElementById('study-tbody');
  document.getElementById('study-empty').style.display = filtered.length ? 'none' : 'block';

  tbody.innerHTML = filtered.map(r =>
    '<tr id="study-row-' + r.userId + '">' +
    '<td><div class="user-cell">' + (r.avatarUrl ? '<img class="avatar" src="' + esc(r.avatarUrl) + '" onerror="this.remove()">' : '') + '<span class="user-name">' + esc(r.displayName) + '</span></div></td>' +
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
// サーバー設定・管理操作
// =============================================
let currentConfigData = null;

function setSelectOptions(selectId, items, selectedValue, emptyLabel, filterType) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const filtered = filterType ? items.filter(item => item.type === filterType) : items;
  let html = emptyLabel ? '<option value="">' + esc(emptyLabel) + '</option>' : '';
  html += filtered.map(item => '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>').join('');
  el.innerHTML = html;
  el.value = selectedValue || '';
}

function populateActionChannels(channels) {
  document.querySelectorAll('.text-channel-select').forEach(el => {
    const current = el.value;
    setSelectOptions(el.id, channels, current, 'チャンネルを選択', 'text');
  });
}

async function loadConfig() {
  try {
    const data = await apiFetch(API.config);
    currentConfigData = data;
    const cfg = data.config || {};
    const channels = data.channels || [];
    const roles = data.roles || [];
    setSelectOptions('cfg-verification', channels, cfg.verificationChannelId, '未設定', 'text');
    setSelectOptions('cfg-moderation', channels, cfg.moderationChannelId, '未設定', 'text');
    setSelectOptions('cfg-ban', channels, cfg.banChannelId, '未設定', 'text');
    setSelectOptions('cfg-study-vc', channels, cfg.studyVoiceChannelId, '選択してください', 'voice');
    setSelectOptions('cfg-study-log', channels, cfg.studyLogChannelId, '未設定', 'text');
    setSelectOptions('cfg-log', channels, cfg.logChannelId, '未設定', 'text');
    setSelectOptions('cfg-admin-role', roles, cfg.adminRoleId, 'Discord権限で判定');
    setSelectOptions('cfg-verified-role', roles, cfg.verifiedRoleId, '未設定');
    setSelectOptions('announce-role', roles, '', 'メンションなし');
    populateActionChannels(channels);
    document.getElementById('cfg-study-role-name').value = cfg.studyRoleName || '勉強中';
    const health = document.getElementById('config-health');
    const study = data.studyVc || {};
    health.innerHTML = '<span class="status-dot ' + (study.enabled ? 'online' : 'offline') + '"></span><span>' +
      '勉強VC: ' + (study.enabled ? '有効' : '未設定') +
      ' · 設定はサーバーに保存されます</span>';
    const verifyChannel = channels.find(c => c.id === cfg.verificationChannelId);
    document.getElementById('verify-channel-summary').textContent = verifyChannel ? '#' + verifyChannel.name : '認証チャンネルが未設定です。サーバー設定で指定してください。';
    document.getElementById('config-result').textContent = '';
  } catch (err) {
    toast('サーバー設定の取得に失敗しました: ' + err.message, 'error');
    throw err;
  }
}

async function saveGuildConfig() {
  const payload = {
    verificationChannelId: document.getElementById('cfg-verification').value,
    moderationChannelId: document.getElementById('cfg-moderation').value,
    banChannelId: document.getElementById('cfg-ban').value,
    verifiedRoleId: document.getElementById('cfg-verified-role').value,
    studyVoiceChannelId: document.getElementById('cfg-study-vc').value,
    studyLogChannelId: document.getElementById('cfg-study-log').value,
    studyRoleName: document.getElementById('cfg-study-role-name').value.trim(),
    logChannelId: document.getElementById('cfg-log').value,
    adminRoleId: document.getElementById('cfg-admin-role').value
  };
  const button = document.querySelector('#pane-config .btn-primary');
  if (button) button.disabled = true;
  try {
    const data = await apiFetch(API.config, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    toast('サーバー設定を保存しました。対応機能に反映しました。', 'success');
    document.getElementById('config-result').textContent = '保存済み';
    await loadConfig();
    loadStatus();
  } catch (err) {
    toast('設定の保存に失敗しました: ' + err.message, 'error');
    document.getElementById('config-result').textContent = '保存に失敗しました';
  } finally {
    if (button) button.disabled = false;
  }
}

async function syncStudyVcPermissions() {
  const confirmed = await openModal(
    '勉強VCの入室制御を再適用',
    '設定済みの勉強ロールだけがVCへ接続できるよう、Discordのチャンネル権限を更新します。現在入室中のメンバーも再確認します。',
    '権限を再適用', 'btn-primary'
  );
  if (!confirmed) return;
  await runDashboardAction(API.actionStudyVcSync, {}, '勉強VCの権限を更新しました。');
  await loadConfig();
}

async function runDashboardAction(url, body, successLabel) {
  try {
    const data = await apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    toast(data.message || successLabel || '操作が完了しました。', 'success');
    return data;
  } catch (err) {
    toast('操作に失敗しました: ' + err.message, 'error');
    return null;
  }
}

async function sendPreferenceInit() {
  const confirmed = await openModal(
    '募集DM通知の初期案内',
    '未設定のキャッシュ済みメンバー最大50人へ、設定ボタン付きDMを送信します。DMを受け取れない設定のメンバーには届きません。<br><br>送信を開始しますか？',
    '送信を開始', 'btn-primary'
  );
  if (!confirmed) return;
  const button = document.getElementById('pref-init-btn');
  if (button) button.disabled = true;
  document.getElementById('pref-init-result').textContent = '送信中…';
  try {
    const data = await apiFetch(API.actionPrefInit, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    document.getElementById('pref-init-result').textContent = '送信 ' + data.sent + ' / 失敗 ' + data.failed + ' / 未処理 ' + data.remaining;
    toast(data.message, data.failed ? 'info' : 'success');
    await loadPreferences();
  } catch (err) {
    document.getElementById('pref-init-result').textContent = '送信に失敗しました';
    toast('初期案内DMの送信に失敗しました: ' + err.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function submitAnnouncement() {
  const payload = {
    title: document.getElementById('announce-title').value,
    message: document.getElementById('announce-message').value,
    channelId: document.getElementById('announce-channel').value,
    mentionRoleId: document.getElementById('announce-role').value,
    color: document.getElementById('announce-color').value
  };
  if (!payload.title.trim() || !payload.message.trim() || !payload.channelId) { toast('タイトル・本文・送信先を入力してください。', 'error'); return; }
  const confirmed = await openModal('お知らせを送信', '<strong>' + esc(payload.title) + '</strong> を選択したチャンネルへ送信します。内容を確認してください。', '送信する', 'btn-primary');
  if (!confirmed) return;
  const result = await runDashboardAction(API.actionAnnounce, payload);
  if (result) { document.getElementById('announce-title').value = ''; document.getElementById('announce-message').value = ''; }
}

async function submitEmbed() {
  const payload = {
    title: document.getElementById('embed-title').value,
    description: document.getElementById('embed-description').value,
    channelId: document.getElementById('embed-channel').value,
    color: document.getElementById('embed-color').value,
    footer: document.getElementById('embed-footer').value,
    imageUrl: document.getElementById('embed-image').value,
    thumbnailUrl: document.getElementById('embed-thumbnail').value
  };
  if (!payload.title.trim() || !payload.description.trim() || !payload.channelId) { toast('タイトル・本文・送信先を入力してください。', 'error'); return; }
  const confirmed = await openModal('カスタムEmbedを送信', '<strong>' + esc(payload.title) + '</strong> を選択したチャンネルへ送信します。', '送信する', 'btn-primary');
  if (!confirmed) return;
  const result = await runDashboardAction(API.actionEmbed, payload);
  if (result) { document.getElementById('embed-title').value = ''; document.getElementById('embed-description').value = ''; }
}

async function submitRecruit() {
  const payload = {
    game: document.getElementById('recruit-game').value,
    description: document.getElementById('recruit-description').value,
    datetime: document.getElementById('recruit-datetime').value,
    capacity: document.getElementById('recruit-capacity').value,
    expiresHours: Number(document.getElementById('recruit-expiry').value),
    channelId: document.getElementById('recruit-channel').value,
    notifyOptIn: document.getElementById('recruit-notify-optin').checked
  };
  if (!payload.game.trim() || !payload.channelId) { toast('募集名と投稿先を指定してください。', 'error'); return; }
  const confirmed = await openModal('参加者募集を作成', '<strong>' + esc(payload.game) + '</strong> の募集を投稿します。' + (payload.notifyOptIn ? '<br>通知オンのキャッシュ済みメンバーへDMも送信します。' : ''), '募集を作成', 'btn-primary');
  if (!confirmed) return;
  const result = await runDashboardAction(API.actionRecruit, payload);
  if (result) {
    document.getElementById('recruit-game').value = '';
    document.getElementById('recruit-description').value = '';
    await loadRecruitments();
    document.getElementById('badge-recruits').textContent = recruitData.length;
  }
}

async function setupVerifyBoard() {
  const confirmed = await openModal('認証ボードを設置', 'サーバー設定で指定した認証チャンネルに、新しい認証ボードを投稿します。既存のボードは削除されません。', '設置する', 'btn-primary');
  if (!confirmed) return;
  await runDashboardAction(API.actionVerify, {});
}

async function submitNickname(action) {
  const payload = {
    userId: document.getElementById('nickname-user-id').value.trim(),
    nickname: document.getElementById('nickname-value').value.trim(),
    action
  };
  if (!payload.userId) { toast('対象ユーザーIDを入力してください。', 'error'); return; }
  if (action === 'set' && !payload.nickname) { toast('新しいニックネームを入力してください。', 'error'); return; }
  const title = action === 'reset' ? 'ニックネームを元に戻す' : 'ニックネームを変更';
  const detail = action === 'reset' ? '対象ユーザーのニックネームをユーザー名に戻します。' : '新しいニックネーム: <strong>' + esc(payload.nickname) + '</strong>';
  const confirmed = await openModal(title, '対象ユーザーID: <strong>' + esc(payload.userId) + '</strong><br>' + detail, '実行する', 'btn-primary');
  if (!confirmed) return;
  const result = await runDashboardAction(API.actionNickname, payload);
  if (result) { document.getElementById('nickname-user-id').value = ''; document.getElementById('nickname-value').value = ''; }
}

async function submitBanAction() {
  const payload = {
    action: document.getElementById('ban-action').value,
    userId: document.getElementById('ban-user-id').value.trim(),
    reason: document.getElementById('ban-reason').value.trim()
  };
  if (!payload.userId) { toast('DiscordユーザーIDを入力してください。', 'error'); return; }
  const label = payload.action === 'ban' ? 'BAN' : 'BAN解除';
  const confirmed = await openModal(label + 'を実行', '対象ユーザーID: <strong>' + esc(payload.userId) + '</strong><br>理由: ' + esc(payload.reason || '管理者による操作') + '<br><br>この操作を実行してよろしいですか？', '実行する', 'btn-danger');
  if (!confirmed) return;
  const result = await runDashboardAction(API.actionBan, payload);
  if (result) { document.getElementById('ban-user-id').value = ''; document.getElementById('ban-reason').value = ''; }
}

async function submitPurge() {
  const payload = {
    channelId: document.getElementById('purge-channel').value,
    count: Number(document.getElementById('purge-count').value),
    userId: document.getElementById('purge-user-id').value.trim()
  };
  if (!payload.channelId) { toast('対象チャンネルを選択してください。', 'error'); return; }
  if (!Number.isInteger(payload.count) || payload.count < 1 || payload.count > 100) { toast('削除件数は1〜100件です。', 'error'); return; }
  const confirmed = await openModal('メッセージを一括削除', '<strong>#' + esc(document.getElementById('purge-channel').selectedOptions[0]?.textContent || '') + '</strong> の直近 ' + payload.count + ' 件を確認し、条件に一致するものを削除します。<br><br><strong>この操作は取り消せません。</strong>', '削除を実行', 'btn-danger');
  if (!confirmed) return;
  const result = await runDashboardAction(API.actionPurge, payload);
  if (result) toast(result.message || (result.deleted + '件削除しました。'), 'success');
}

async function submitStudyRole(action) {
  const payload = {
    userId: document.getElementById('study-target-id').value.trim(),
    subject: document.getElementById('study-target-subject').value.trim(),
    action
  };
  if (!payload.userId) { toast('ユーザーIDを入力してください。', 'error'); return; }
  if (action === 'give' && !payload.subject) { toast('付与する場合は勉強内容を入力してください。', 'error'); return; }
  if (action === 'remove') {
    const confirmed = await openModal('勉強ロールを剥奪', '指定したユーザーから勉強ロールを剥奪し、勉強記録を削除します。', '剥奪する', 'btn-danger');
    if (!confirmed) return;
  }
  const result = await runDashboardAction(API.actionStudy, payload);
  if (result) { document.getElementById('study-target-id').value = ''; await loadStudyRoles(); }
}

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
    throw err;
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
// =============================================
// サーバー接続・初期データ同期
// =============================================
const BOOT_STEPS = ['connection', 'api', 'data', 'render'];
function setBootStep(step, state) {
  const el = document.getElementById('boot-step-' + step);
  if (!el) return;
  el.classList.remove('active', 'done');
  if (state) el.classList.add(state);
  const icon = el.querySelector('.step-icon');
  if (icon) icon.textContent = state === 'done' ? '✓' : String(BOOT_STEPS.indexOf(step) + 1);
}
function setBootProgress(percent, stage, title, subtitle) {
  document.getElementById('boot-progress-bar').style.width = percent + '%';
  document.getElementById('boot-percent').textContent = percent + '%';
  document.getElementById('boot-stage').textContent = stage;
  document.getElementById('boot-title').textContent = title;
  document.getElementById('boot-subtitle').textContent = subtitle;
}
async function bootDashboard() {
  const overlay = document.getElementById('boot-overlay');
  const errorBox = document.getElementById('boot-error');
  const retry = document.getElementById('boot-retry');
  overlay.classList.remove('is-hidden');
  errorBox.classList.remove('show');
  retry.classList.remove('show');
  BOOT_STEPS.forEach(step => setBootStep(step, ''));
  setBootProgress(12, 'CONNECTING', 'サーバーへ接続しています', '管理APIの応答を確認中...');
  try {
    await apiFetch(API.status);
    setBootStep('connection', 'done');
    setBootStep('api', 'active');
    setBootProgress(36, 'API READY', 'API接続を確認しました', '各管理データの取得を開始します...');
    const tasks = [
      ['overview', loadOverview],
      ['config', loadConfig],
      ['files', loadFiles],
      ['status', loadStatus]
    ];
    setBootStep('api', 'done');
    setBootStep('data', 'active');
    setBootProgress(58, 'SYNCING DATA', '管理データを同期しています', 'Discord・募集・通知設定・ファイル情報を取得中...');
    const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));
    const failed = results.filter(r => r.status === 'rejected');
    setBootStep('data', 'done');
    setBootStep('render', 'active');
    setBootProgress(88, 'RENDERING', 'データを反映しています', '画面コンポーネントを最終確認中...');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    setBootStep('render', 'done');
    if (failed.length) {
      const labels = failed.map((result, index) => tasks[results.indexOf(result)]?.[0] || 'data').join(', ');
      setBootProgress(100, 'PARTIAL READY', '一部データを取得できませんでした', '管理画面は利用できます。該当タブの更新ボタンから再試行してください。');
      console.warn('[Dashboard] partial boot:', labels, failed.map(r => r.reason?.message));
    } else {
      setBootProgress(100, 'ONLINE', '接続完了', 'すべての初期化処理が完了しました');
    }
    setTimeout(() => overlay.classList.add('is-hidden'), 650);
  } catch (err) {
    setBootProgress(100, 'CONNECTION ERROR', '読み込みに失敗しました', 'サーバーとの通信を確立できませんでした');
    errorBox.textContent = err.message + '。サーバーログと /admin/api/status を確認してください。';
    errorBox.classList.add('show');
    retry.classList.add('show');
  }
}
document.getElementById('refresh-btn').addEventListener('click', () => {
  refreshCurrent();
});
bootDashboard();
setInterval(loadStatus, 30000);
</script>
</body>
</html>`;
