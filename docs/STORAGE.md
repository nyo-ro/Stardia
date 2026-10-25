# v0.0.3 保存・バックアップ設計

## IndexedDB

DB名 `stardia.learning.v1`、DB version **2**。

- `projects`（keyPath: projectId）: `{schemaVersion:1, projectId, revision, project, records}`。
- `metadata`（keyPath: key）: `{key:'workspace', revision, preferencesRevision, preferences}`。

version 1からはmetadataストアだけを追加し、既存projectsを書き換えない。UI起動時、metadataがない場合だけ旧localStorageの設定を正規化して保存する。以後localStorageに残る値は使わず、設定もIndexedDBで管理する。旧タブはversionchangeで接続を閉じ、新版を開き直す必要がある。

projectはid・name・goal・tasksを持つ。tasksはid・title・date・minutes・required・status（unstarted/completed）、recordsはid・projectId・date・subject・minutes・noteを持つ。現行形式では記録とタスクの直接参照はない。

UIの選択対象はdefaultプロジェクト。保存層は複数projectIdを扱い、バックアップは全projectIdを含む。複数プロジェクトを選択する画面は未実装。

## 更新と競合

通常更新はprojectsとmetadataを含むreadwrite transactionで、対象プロジェクトrevisionの照合→変更→プロジェクトrevisionとworkspace revisionの加算を行う。設定更新はpreferencesRevisionを照合し、preferencesRevisionとworkspace revisionを加算する。成功はtransaction.oncompleteだけで通知する。

保存失敗時はabortし、データと設定の両方を維持する。フォーム入力は保持。競合は保存時に検知し、自動マージ・自動再送しない。IndexedDBが使えなくても実データをメモリ保存へ切り替えない。

## バックアップ形式 v1

```json
{
  "type": "stardia_backup",
  "schemaVersion": 1,
  "createdAt": "2026-10-25T00:00:00.000Z",
  "projects": [],
  "uiPreferences": {
    "version": 1,
    "theme": "light",
    "accent": "purple",
    "visibility": {"today": true, "week": true, "stats": true, "recent": true}
  }
}
```

projectsの各要素は `{projectId, project, records}`。計画・進捗はproject.tasksに含む。保存層のrevisionと削除済みプロジェクトのtombstoneは輸送用JSONに含めない。createdAt以外の学習内容と表示設定が往復で一致することを検証する。

exportBackupはprojectsとmetadataを同じreadonly transactionで取得し、完了後にJSON用の独立したオブジェクトを返す。以後の更新は生成済みスナップショットへ影響しない。UIの未保存入力は対象外。

## 復元

1. 10MB上限を確認し、JSON構文・type・バージョン・UTC作成日時・必須項目・型・文字数・日付・時間・進捗・設定を検証。
2. プロジェクトID、タスクID、記録IDの重複（各種類内）と、project.id / records.projectIdの参照関係を検証。IDには英数字・ハイフン・アンダースコアを使用。
3. 未知の項目も黙って削除せず拒否する。将来形式は新バージョンと専用の移行処理で扱う。
4. 読込後に現在のworkspace revisionと概要を取得。利用者が一式置換を確認。
5. restoreBackupで再検証し、単一readwrite transaction内でworkspace revisionを照合して全プロジェクトと表示設定を置換。
6. 復元後のrevisionは現在値から増加させ、バックアップ内の値は採用しない。削除された既存projectIdには空のtombstoneを残し、defaultにも必ずrevisionを付ける。古いタブによる更新を拒否する。
7. metadataのrevision・preferencesRevisionも更新。途中のどのputが失敗してもtransaction全体を取り消す。

DB削除・store.clearによる初期化は使わない。復元完了後は返されたデータ・設定で画面を更新する。失敗や競合時は確認を無効にし、ファイルの選び直しを求める。二重クリックと読込中の操作をロックする。概要にはtextContentを使い、JSONをHTMLとして解釈しない。

## デモと制約

デモはMemoryRepository専用。バックアップの読み書きは常に実IndexedDBを対象とし、デモ画面では操作ボタンを無効化する。表示設定は両モードで共通。

最大10MB、最大1000プロジェクト。全体をメモリ上で処理するため巨大データ向けのストリーミング処理はない。完全バックアップはStardia形式のみで、旧Study JSONの直接取り込みは未実装。ブラウザ保存は手動消去やディスク故障に耐えるバックアップではなく、別途JSONを保管する必要がある。暗号化、クラウド同期、自動バックアップ、未知形式の自動修復は未実装。
