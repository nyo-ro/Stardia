# v0.0.2 保存設計

## 物理形式

IndexedDB名 `stardia.learning.v1`、DB version 1、object store `projects`、keyPath `projectId`。
1プロジェクトにつき `{schemaVersion:1, projectId, revision, project, records}` を保存する。
`project` は `{id,name,goal,tasks}`。tasksは日付・予定分数・必須フラグ・進捗を保持する。recordsはprojectId・date・subject・minutes・note・idを持つ。

UIの現在のprojectIdは `default`。Repositoryには別のIDを渡せる。複数プロジェクトの選択画面は未実装。小規模データを想定し、変更時にそのプロジェクト全体を読み書きする。大規模化時のストア分割は後続の検討対象。

## 契約

- `load()`: 存在しない場合はrevision 0・project nullの空スナップショットを返す。DBへの初期データ書込はしない。
- `mutate(command, expectedRevision)`: 共通domain処理で検証し、更新後スナップショットを返す。
- `close()`: 接続を閉じる。

create/update/deleteProject、add/update/deleteTask、setTaskStatus、add/update/deleteRecordをサポートする。revisionチェック・取得・全変更・putは同じreadwrite transactionに含め、oncompleteでのみ成功を返す。readwrite transactionが直列化されるため、二つのタブが同じrevisionで書こうとすると一方だけ成功する。

プロジェクト削除ではrevision付きの空データを残す。削除・再作成後に古いタブが同じrevisionとして認識することを防ぐ。タスク削除は記録を削除しない。記録とタスクの直接参照は現在の形式では持たない。

## 失敗・競合

失敗時はtransactionをabortし、保存済みデータを維持。容量不足・書込禁止などのエラーはUIまで返す。IndexedDBが使えなくても実データをメモリ保存へ切り替えない。初期作成が中断された場合は再試行可能。未知のschemaVersion、将来のDB versionは読み込みを拒否し、自動リセットしない。onversionchangeで接続を閉じ、古い画面による更新を止める。

競合時は入力を保持。明示的な最新読込でフォームの基準revisionを更新し、最新の対象項目を表示する。利用者が比較・修正して再保存する。競合通知は保存を試みた時点で行い、他タブの更新を自動で画面へ反映しない。

## デモ

架空データはcreateDemoから新規生成し、MemoryRepositoryだけに渡す。IndexedDBには一切seedしない。UI設定のみ共通。旧v0.0.1の学習内容は元々メモリ内のため移行できない。表示設定キーは維持する。

## 次版のバックアップ案（実装前）

外側に `type: stardia_backup`, `schemaVersion`, `exportedAt`, `projects`, `uiPreferences` を持つ。全計画・記録・進捗・将来の互換項目を含め、復元時は検証→確認→原子的置換とする。ローカルrevisionはバックアップの数値をそのまま採用せず、復元時の競合保護用に更新する。仕様確定と往復テストはv0.0.3で実施。

完全バックアップ、永続化許可の要求、DBの自動修復、旧Study JSONインポート、クラウド同期は未実装。IndexedDBの永続性はブラウザの保存領域が保持される範囲であり、手動消去やディスク障害に対するバックアップではない。
