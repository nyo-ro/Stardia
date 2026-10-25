# v0.0.4 データ構造（schemaVersion 2）

## プロジェクト単位のスナップショット

`{schemaVersion:2, projectId, revision, project, records}`。project=nullは削除済み／未作成の環境。revisionは保存先だけが管理する競合検知番号。

| エンティティ | フィールド | 役割 |
|---|---|---|
| Project | id, name, description, goal, startDate, targetDate, items, schedules | 学習環境。任意の日付はnull |
| StudyItem | id, title, description, archived | 学ぶ内容そのもの。分類・方法・階層の固定なし |
| StudySchedule | id, itemId, date, minutes, required, status, archived | ある項目をいつ・何分学ぶか。名称は保持せずitemIdで参照 |
| StudyRecord | id, projectId, date, subject, minutes, note, itemId, scheduleId | 学習した事実。subjectは記録時の内容として保持 |

IDはプロジェクト内・エンティティ種別内で一意。関連付けにはprojectIdとitemId/scheduleIdを使う。同じ文字列を異なるエンティティ種別で使うことは可能。新規IDはUUID、旧タスクの移行では既存IDを維持する。

## 参照規則

- 全予定のitemIdは、そのプロジェクトのitemsに存在する。
- 記録のitemIdとscheduleIdは任意（null可）。scheduleIdがあればitemIdも必要で、予定のitemIdと一致する。
- 同じ項目を複数の予定から参照できる。日付は一意制約にせず、同日の複数予定も許可。
- 記録がある予定のitemId変更は禁止。日付・時間・必須設定は変更できるが記録は更新しない。
- 名称変更はStudyItemだけを更新。予定は新名称を表示し、StudyRecord.subjectは書き換えない。
- 新規記録は自由記述だけでも作成できる。旧記録は項目・予定を推測せずnullに移行する。

## 削除と進捗

項目削除はarchived=trueとし、関連する全予定もarchived=trueにする。予定削除はその予定をarchiveする。既存の参照・状態・実績は保持し、バックアップへ含める。削除済み項目・予定に新規の予定や実績は追加できないが、既存記録の内容・メモは編集できる。

日次・週次の予定と完了率は有効な予定だけを対象にする。実績時間・学習日数は記録から集計するので予定削除で減らない。完了状態は予定単位のunstarted/completed。記録保存時に関連予定を完了にする操作は同じトランザクション内で実施する。記録の編集・削除で予定の完了状態を自動で巻き戻さない。

プロジェクト削除はitems・schedules・recordsを一式削除し、revision付きの空スナップショットを残す。移行前退避も同時に削除。確認ダイアログで範囲を明示する。

## 入力検証

名前・項目名・記録内容は1〜100文字、説明と記録メモは最大1000文字、目標は最大300文字。日付は実在するYYYY-MM-DD。開始日と目標日が両方ある場合は開始日≦目標日。時間は1〜1440分の整数。予定日をプロジェクト期間内に強制しない（目標日は目安）。

参照、重複ID、archived、進捗、未知のキーを保存前と復元前に検証する。将来の分類・親子関係・学習方法は、StudyItemへの追加定義と明示的なschemaVersion移行で扱う。現在の名称から分類を推測しない。

## schemaVersion 1からの移行

旧project.tasksの各要素をStudyItemとStudyScheduleへ1対1で変換。両者のIDは旧task.idを使用する。名前はitemへ移し、date/minutes/required/statusはscheduleへ維持。archivedはfalse。descriptionは空、プロジェクトの任意日付はnull。記録のID・日時・内容・時間・メモは維持しitemId/scheduleIdをnullにする。同名タスクを自動統合しない。

変換前後の件数・名前・日時・時間・必須フラグ・進捗・全記録フィールドを実行時に検証する。旧スナップショットは変更せず、変換結果を別オブジェクトとして構築する。
