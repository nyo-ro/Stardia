# v0.0.5 保存・バックアップ設計

## IndexedDB

DB名 `stardia.learning.v1`、DB version **3**。

- `projects`（keyPath: projectId）: `{schemaVersion:2, projectId, revision, project, records}`。
- `metadata`（keyPath: key）: `{key:'workspace', revision, preferencesRevision, preferences}`。

- `migrationBackups`（keyPath: projectId）: `{projectId, sourceSchemaVersion:1, snapshot}`。移行前の原本。

DB version 1/2からのアップグレードトランザクション内で全プロジェクトを検証し、旧schemaVersion 1だけを新schemaVersion 2に変換する。変換対象は原本をmigrationBackupsへ退避してから書き換える。1件でも失敗したらストア追加・原本退避・変換・更新番号・DB versionの変更すべてをロールバックする。変更したproject revisionとworkspace revisionは増加させる。旧タブはversionchangeで接続を閉じる。

設定ストアがなかった旧版の場合だけ、初回起動でlocalStorage設定を引き継ぐ。既存metadataがあれば上書きしない。移行前原本は現在の学習環境とは別の回復用データであり、通常のバックアップには含めない。プロジェクト削除では対応する原本、一式復元では全原本を同じトランザクションで削除する。

projectにitems（StudyItem）とschedules（StudySchedule）を分離。recordsはitemId/scheduleIdを任意参照し、記録時のsubjectを保持する。名称や予定日変更で過去の記録を書き換えない。詳細は [DATA_MODEL.md](DATA_MODEL.md)。

UIの選択対象はdefaultプロジェクト。保存層は複数projectIdを扱い、バックアップは全projectIdを含む。複数プロジェクトを選択する画面は未実装。

## 更新と競合

通常更新はprojectsとmetadataを含むreadwrite transactionで、対象プロジェクトrevisionの照合→変更→プロジェクトrevisionとworkspace revisionの加算を行う。設定更新はpreferencesRevisionを照合し、preferencesRevisionとworkspace revisionを加算する。成功はtransaction.oncompleteだけで通知する。

保存失敗時はabortし、データと設定の両方を維持する。フォーム入力は保持。競合は保存時に検知し、自動マージ・自動再送しない。IndexedDBが使えなくても実データをメモリ保存へ切り替えない。

## バックアップ形式 v2（v1読込互換）

```json
{
  "type": "stardia_backup",
  "schemaVersion": 2,
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

projectsの各要素は `{projectId, project, records}`。学習項目はproject.items、予定・進捗はproject.schedulesに含む。削除済みの項目・予定も実績の参照用に含める。保存層のrevisionと削除済みプロジェクトのtombstoneは輸送用JSONに含めない。createdAt以外の学習内容と表示設定が往復で一致することを検証する。

exportBackupはprojectsとmetadataを同じreadonly transactionで取得し、完了後にJSON用の独立したオブジェクトを返す。以後の更新は生成済みスナップショットへ影響しない。UIの未保存入力は対象外。

## 復元

1. 10MB上限を確認し、JSON構文・type・バージョン・UTC作成日時・必須項目・型・文字数・日付・時間・進捗・設定を検証。
2. プロジェクトID、学習項目ID・予定ID・記録IDの重複（プロジェクト内・各種類内）と、予定→項目、実績→項目／予定、projectIdの参照整合性を検証。IDには英数字・ハイフン・アンダースコアを使用。
3. 旧バックアップv1は旧形式の厳密な検証後、各プロジェクトをv2へ変換し、件数・進捗・記録内容の一致を確認する。未知の項目は黙って削除せず拒否する。将来形式は専用の移行処理で扱う。
4. 読込後に現在のworkspace revisionと概要を取得。利用者が一式置換を確認。
5. restoreBackupで再検証し、単一readwrite transaction内でworkspace revisionを照合して全プロジェクトと表示設定を置換。
6. 復元後のrevisionは現在値から増加させ、バックアップ内の値は採用しない。削除された既存projectIdには空のtombstoneを残し、defaultにも必ずrevisionを付ける。古いタブによる更新を拒否する。
7. metadataのrevision・preferencesRevisionも更新。途中のどのputが失敗してもtransaction全体を取り消す。

学習データのストアをclearしてから入れ直す方式は使わない。移行前の退避ストアだけは一式復元時にclearするが、同じトランザクションのため失敗時は復元される。復元完了後は返されたデータ・設定で画面を更新する。失敗や競合時は確認を無効にし、ファイルの選び直しを求める。二重クリックと読込中の操作をロックする。概要にはtextContentを使い、JSONをHTMLとして解釈しない。

## デモと制約

デモはMemoryRepository専用。バックアップの読み書きは常に実IndexedDBを対象とし、デモ画面では操作ボタンを無効化する。表示設定は両モードで共通。

最大10MB、最大1000プロジェクト。各プロジェクトの項目・予定・記録は各100000件以内。全体をメモリ上で処理するため巨大データ向けのストリーミング処理はない。完全バックアップはStardia形式のみで、旧Study JSONの直接取り込みは未実装。ブラウザ保存は手動消去やディスク故障に耐えるバックアップではなく、別途JSONを保管する必要がある。暗号化、クラウド同期、自動バックアップ、未知形式の自動修復は未実装。

## AI一括更新（v0.0.5）

DB version 3、snapshot schemaVersion 2、完全バックアップschemaVersion 2を維持。追加移行はない。

`domain/ai.js`は形式検証・コンテキスト抽出・SHA-256・コピー上の差分計算を担当。`repository.applyAIUpdate`は最新snapshotをloadし、更新JSONのrevision/digestを照合して全操作を準備する。Web Cryptoは非同期なのでreadwrite transactionの外で実施する。

その後、通常の保存transaction内で現在snapshotのcanonical表現と準備前のbaselineを比較する。この2回目の照合により、非同期準備中やタブ間の競合を検出する。全変更済みaggregateを1回putし、metadataのworkspace revisionを同じtransactionで1だけ進める。project revisionも1だけ進める。途中失敗は両方をrollbackする。設定と移行原本には変更を加えない。

プレビュー時のデータ・準備結果を信頼してそのまま保存せず、確認後にもJSONから再検証する。学習項目改名・GUI操作・復元などによって更新元が変わったら拒否する。復元を含め既存のrevision/tombstone規則は維持する。AI更新後の全エンティティは通常バックアップで保持され、旧v1バックアップ読込も従来どおり。

本形式は認証・署名ではない。改変された更新内容を許可するかは利用者のプレビュー承認で決定する。重複判定の範囲と制約は[AI_JSON.md](AI_JSON.md)を参照。
