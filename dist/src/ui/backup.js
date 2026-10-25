import {parseBackup,backupSummary,MAX_BACKUP_BYTES} from '../domain/backup.js';
export function mountBackup({repository,isBusy,isDemo,lock,onRestore,onError}){
 const $=id=>document.getElementById(id);let pending=null;
 const status=message=>{$('backup-status').textContent=message;};
 function reset(){pending=null;$('restore-confirm').checked=false;$('restore-apply').disabled=true;$('restore-summary').textContent='';}
 $('backup-open').addEventListener('click',()=>{if(isBusy()||isDemo())return;reset();$('backup-file').value='';status('バックアップには実データと表示設定が含まれます。ファイルは大切に保管してください。');$('backup-dialog').showModal();});
 $('backup-dialog').addEventListener('cancel',event=>{if(isBusy())event.preventDefault();});
 $('backup-close').addEventListener('click',()=>{if(!isBusy())$('backup-dialog').close();});
 $('backup-download').addEventListener('click',async()=>{
  if(isBusy()||isDemo())return;lock(true);
  try{const {backup}=await repository.exportBackup();const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'});if(blob.size>MAX_BACKUP_BYTES)throw new Error('バックアップが10MBを超えています。現バージョンの復元上限を超えるため出力を中止しました。');const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`stardia-backup-${backup.createdAt.replace(/[:.]/g,'-')}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('JSONのダウンロードを開始しました。保存先を確認してください。');}
  catch(error){status(error.message);onError(error);}finally{lock(false);$('restore-apply').disabled=!pending||!$('restore-confirm').checked;}
 });
 $('backup-file').addEventListener('change',async()=>{
  if(isBusy())return;reset();const file=$('backup-file').files[0];if(!file)return;lock(true);
  try{if(file.size>MAX_BACKUP_BYTES)throw new Error('バックアップは10MB以内のJSONを選択してください。');const backup=parseBackup(await file.text());const current=await repository.exportBackup();const from=backupSummary(backup),to=backupSummary(current.backup);pending={backup,revision:current.revision};$('restore-summary').textContent=`作成日時：${backup.createdAt}\n復元する内容：${from.projects}プロジェクト / ${from.items}学習項目 / ${from.tasks}予定 / ${from.records}記録\n名前：${backup.projects.filter(p=>p.project).map(p=>p.project.name).join('、')||'なし'}\n現在の内容：${to.projects}プロジェクト / ${to.items}学習項目 / ${to.tasks}予定 / ${to.records}記録\nテーマ・アクセント・カードの表示設定も置き換えます。`;status('内容を確認し、現在の学習環境を一式置換する場合だけチェックしてください。');}
  catch(error){reset();status(error.message);}finally{lock(false);$('restore-apply').disabled=true;}
 });
 $('restore-confirm').addEventListener('change',()=>{$('restore-apply').disabled=isBusy()||!pending||!$('restore-confirm').checked;});
 $('restore-apply').addEventListener('click',async()=>{
  if(isBusy()||isDemo()||!pending||!$('restore-confirm').checked)return;
  const selected=pending;pending=null;lock(true);
  try{const result=await repository.restoreBackup(selected.backup,selected.revision);onRestore(result);status('学習データと表示設定を復元しました。');$('restore-summary').textContent='';$('backup-file').value='';}
  catch(error){status('復元できませんでした。元のデータは保持されています。ファイルを選び直して再確認してください。 '+error.message);onError(error);}
  finally{$('restore-confirm').checked=false;lock(false);$('restore-apply').disabled=true;}
 });
}
