import {buildContext,parseUpdate,prepareUpdate,MAX_AI_BYTES} from '../domain/ai.js';
export function mountAI({repository,isBusy,isDemo,lock,onSaved,onError,getDate}){
 const $=id=>document.getElementById(id);let pending=null;
 const status=message=>{$('ai-status').textContent=message;};
 function sync(){$('ai-apply').disabled=isBusy()||!pending||!$('ai-confirm').checked;}
 function reset(){pending=null;$('ai-confirm').checked=false;$('ai-preview').replaceChildren();sync();}
 $('ai-open').addEventListener('click',()=>{if(isBusy()||isDemo())return;reset();$('ai-file').value='';$('ai-source').value='';$('ai-output').value='';$('ai-from').value=getDate();$('ai-to').value=getDate();status('AIへの送信は行いません。出力ファイルには学習内容・メモが含まれます。渡す前に内容を確認してください。');$('ai-dialog').showModal();});
 $('ai-dialog').addEventListener('cancel',e=>{if(isBusy())e.preventDefault();});
 $('ai-close').addEventListener('click',()=>{if(!isBusy())$('ai-dialog').close();});
 $('ai-confirm').addEventListener('change',sync);
 $('ai-source').addEventListener('input',()=>{reset();status('JSONを変更しました。プレビューし直してください。');});
 $('ai-file').addEventListener('change',async()=>{if(isBusy())return;reset();const file=$('ai-file').files[0];if(!file)return;lock(true);try{if(file.size>MAX_AI_BYTES)throw Error('更新JSONは2MB以内にしてください。');$('ai-source').value=await file.text();status('読み込みました。「変更をプレビュー」で確認してください。');}catch(e){status(e.message);}finally{lock(false);sync();}});
 $('ai-export').addEventListener('click',async()=>{
  if(isBusy()||isDemo())return;lock(true);
  try{const context=await buildContext(await repository.load(),{kind:$('ai-scope').value,from:$('ai-from').value,to:$('ai-to').value});const source=JSON.stringify(context,null,2);$('ai-output').value=source;const url=URL.createObjectURL(new Blob([source],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`stardia-context-${context.scope.kind}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('相談用JSONのダウンロードを開始しました。これは完全バックアップとしては使えません。');}
  catch(e){status(e.message);}finally{lock(false);sync();}
 });
 $('ai-inspect').addEventListener('click',async()=>{
  if(isBusy()||isDemo())return;reset();lock(true);
  try{const update=parseUpdate($('ai-source').value),preview=await prepareUpdate(await repository.load(),update);pending=update;
   const summary=document.createElement('p');summary.textContent=`追加 ${preview.counts.add}件 / 変更 ${preview.counts.update}件 / 削除（アーカイブ）${preview.counts.delete}件`;$('ai-preview').append(summary);
   for(const change of preview.changes){const section=document.createElement('section');section.className=change.type==='deleteSchedule'?'ai-change danger':'ai-change';const title=document.createElement('h3');title.textContent=`${change.type==='deleteSchedule'?'削除（実績は保持）':change.type}：${change.item}`;const detail=document.createElement('pre');detail.textContent=`ID: ${change.id}\n変更前：\n${JSON.stringify(change.before,null,2)}\n変更後：\n${JSON.stringify(change.after,null,2)}\n変更しない関連実績ID：${change.preservedRecordIds.join(', ')||'なし'}`;section.append(title,detail);$('ai-preview').append(section);}
   const warning=document.createElement('p');warning.textContent=preview.warnings.join('\n')||'予定変更で過去の実績は変更しません。';$('ai-preview').append(warning);status('まだ保存していません。日付・学習項目・変更前後を確認してから一括適用してください。');
  }catch(e){reset();status(e.message);}finally{lock(false);sync();}
 });
 $('ai-apply').addEventListener('click',async()=>{
  if(isBusy()||isDemo()||!pending||!$('ai-confirm').checked)return;const update=pending;pending=null;lock(true);status('一括保存中…');
  try{const data=await repository.applyAIUpdate(update);onSaved(data);status('全件をブラウザに保存しました。同じJSONは再適用できません。');$('ai-source').value='';$('ai-file').value='';}
  catch(e){status('適用できませんでした。元のデータは保持しています。 '+e.message);onError(e);}
  finally{$('ai-confirm').checked=false;lock(false);sync();}
 });
}
