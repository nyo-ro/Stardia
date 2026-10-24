# Studyからの選択移植

移植元は `C:\data\Study`。既存環境への書き込みやGit操作は行わず、ソースから関数・設計を選択移植した。フォルダ単位のコピーはしていない。

| 元のコード | Stardia | 変更 |
|---|---|---|
| index.htmlのlocalDate/d/mondayOf/plusDays/minText | domain/date.js | ES Module化、引数の明示、日付検証 |
| index.htmlのesc | ui/html.js | 純粋関数化 |
| dashboard-ui.jsのnormalizeUIConfig/テーマ/アクセント | storage/preferences.js | 専用キー、カードを限定、保存失敗対応 |
| index.htmlのtaskProgressMap/aggregateResults | domain/study.js | 進捗・集計の考え方を再実装。state依存・試験固有指標を除外 |
| dashboard-ui.js / dashboard.cssのカード・週表示・設定 | app.js / styles.css | 参考に再実装。インラインイベント・グローバル関数依存を解消 |
| checks/frontend.test.cjsの回帰観点 | tests/ | 実行方法と架空データは新規作成 |

学習記録フォームは小さく新規実装。元の詳細フォーム、科目A/B分析、週次レビュー、Patch、公開集計JSONの仕組みは移植していない。自動テストもそのままコピーしたものではない。

元の.git、学習JSON、個人サンプル、public-build、ログ、設定、画像はコピーしていない。星マークは新規SVG。デモは現在日付を起点に生成する架空の計画。

v0.0.1は旧Study形式と互換ではない。将来のインポートではv2/v3のID、未知の項目、進捗、教材参照を保持し、元ファイルに書き戻さない。
