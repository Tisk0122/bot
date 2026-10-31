# Discord公式ステータス監視・取得精度改善

## 実際に確認した問題

2026年11月1日 02:12（日本時間）のDiscord公式Statuspage APIを確認したところ、`summary.json` の全体 `status.indicator` が `none`（All Systems Operational）である一方、同じ応答内の `incidents` と `incidents/unresolved.json` に、`investigating`・`major` の未解決障害が含まれていました。そのため、集約indicatorのみを表示する実装では障害を正常扱いしてしまいます。

## 参照する公式API

- `GET /api/v2/summary.json` — 全体状態、サービス状態、未解決案件、メンテナンスの統合表示。
- `GET /api/v2/status.json` — 全体状態の補助ソース。
- `GET /api/v2/components.json` — サービス／コンポーネント別の状態。
- `GET /api/v2/incidents/unresolved.json` — `investigating` / `identified` / `monitoring` の進行中インシデント専用一覧。取得成功時はこの一覧を現在の未解決判定の基準にする。
- `GET /api/v2/incidents.json` — 直近のインシデント履歴。解決状態への遷移や未解決API障害時のフォールバックに使用。
- `GET /api/v2/scheduled-maintenances.json` — メンテナンス履歴。
- `GET /api/v2/scheduled-maintenances/active.json` — 実施中メンテナンス。
- `GET /api/v2/scheduled-maintenances/upcoming.json` — 予定メンテナンス。

公開Status APIはステータスページの表示用読み取りAPIで、Atlassianのサポート資料ではManage APIとは異なりStatus APIはレート制限対象外と説明されています。

## 改善した判定

- `summary.status.indicator` の値だけで全体状態を決めない。
- 未解決インシデントの影響度、サービスごとの状態を合成し、最も重大な異常を優先。
- `unresolved.json` が成功した場合は専用の未解決一覧を優先し、キャッシュの古い `summary` / `incidents.json` が解決済み案件を再び障害中に戻さないようにする。
- `unresolved.json` が失敗した場合は `summary.incidents` と `incidents.json` から補完。
- 状態値が未知、または必要データが欠落した場合は「正常」にせず「状態を確認できません」とする。
- APIのHTTP 429/5xx、タイムアウト等は再試行。取得不能が続けば監視APIの通信障害を通知し、復旧時も通知。
- メンテナンスの一覧・実施中・予定中APIも照合し、画像に表示。

## 通知と再起動

- 初回起動時に存在する未解決障害も1回通知（旧バージョンの状態ファイルに通知履歴がない案件も移行検出）。
- 新規障害、インシデント更新、解決をそれぞれ通知。
- コンポーネント状態の悪化・改善・メンテナンス開始／終了を通知。
- 同じポーリング内の障害通知と全体状態通知が重複しないように制御。
- 状態を `data/discord_status_state.json` に保存し、通常の再起動では同じイベントを再通知しない。
- Discordへの通知送信に失敗した場合は記録を再試行可能に戻す。

## 検証

- 全JavaScriptファイルの `node --check`。
- 全JSONファイルのJSON.parse。
- 実際のDiscord公式APIで確認された「indicator=none + 未解決major」をローカルHTTPモックで再現し、全体状態をmajorと判定するテスト。
- 未解決専用APIの一時失敗時にsummary／全インシデント履歴へフォールバックするテスト。
- 未解決専用APIが空で、古い全履歴にactiveが残っている場合に障害を復活させないテスト。
- 同じIDについて未解決APIはactive、履歴APIは古いresolvedを返す競合でも未解決APIを優先するテスト。
- 未知のindicatorを正常扱いせず、maintenance indicatorを有効な状態として扱うテスト。
- メンテナンス情報がステータス画像の描画入力へ渡ることを確認。
- 初回起動時の既存障害検出、および状態ファイルを保持した再起動での重複通知抑止テスト。

## 制限

Botが監視できるのはDiscordがStatuspageに公開した情報です。Discord内部で発生していても公開前・未掲載の障害は取得できません。公開APIの更新遅延、ネットワーク障害、ホスティング側の停止があるため、完全なリアルタイム検知や未公開障害の検知は保証できません。

既存プロジェクトは Node.js 24 以上を指定しています。`data/discord_status_state.json` は永続ボリュームに保存してください。
