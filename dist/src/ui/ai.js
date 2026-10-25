import {buildContext,parseUpdate,prepareUpdate,MAX_AI_BYTES} from '../domain/ai.js';
export function mountAI({navigate,repository,isBusy,isDemo,lock,onSaved,onError,getDate}){
 const $=id=>document.getElementById(id);let pending=null;
 const status=(message,kind='info')=>{$('ai-status').textContent=message;$('ai-status').dataset.kind=kind;};
 function sync(){$('ai-apply').disabled=isBusy()||!pending||!$('ai-confirm').checked;}
 function reset(){pending=null;$('ai-confirm').checked=false;$('ai-preview').replaceChildren();sync();}
 $('ai-from').value=getDate();$('ai-to').value=getDate();status('AIへの送信は行いません。出力には学習内容・メモを含みます。渡す前に内容を確認してください。');
 $('ai-close').addEventListener('click',()=>{if(!isBusy())navigate('today');});
 $('ai-confirm').addEventListener('change',sync);
 $('ai-source').addEventListener('input',()=>{reset();status('JSONを変更しました。プレビューし直してください。');});
 $('ai-file').addEventListener('change',async()=>{if(isBusy())return;reset();const file=$('ai-file').files[0];if(!file)return;lock(true);try{if(file.size>MAX_AI_BYTES)throw Error('更新JSONは2MB以内にしてください。');$('ai-source').value=await file.text();status('読み込みました。「変更をプレビュー」で確認してください。');}catch(e){status(e.message,'error');}finally{lock(false);sync();}});
 $('ai-export').addEventListener('click',async()=>{
  if(isBusy()||isDemo())return;lock(true);
  try{const context=await buildContext(await repository.load(),{kind:$('ai-scope').value,from:$('ai-from').value,to:$('ai-to').value});const source=JSON.stringify(context,null,2);$('ai-output').value=source;const url=URL.createObjectURL(new Blob([source],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`stardia-context-${context.scope.kind}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('相談用JSONのダウンロードを開始しました。これは完全バックアップとしては使えません。');}
  catch(e){status(e.message,'error');}finally{lock(false);sync();}
 });
 $('ai-inspect').addEventListener('click',async()=>{
  if(isBusy()||isDemo())return;reset();lock(true);
  try{const update=parseUpdate($('ai-source').value),preview=await prepareUpdate(await repository.load(),update);pending=update;
   const summary=document.createElement('p');summary.textContent=`追加 ${preview.counts.add}件 / 変更 ${preview.counts.update}件 / 削除（アーカイブ）${preview.counts.delete}件`;$('ai-preview').append(summary);
   const operationNames={addRecord:'実績を追加',updateRecord:'実績を変更',addSchedule:'予定を追加',updateSchedule:'予定を変更',deleteSchedule:'削除（実績は保持）'};
   const labels={date:'日付',subject:'学習した内容',minutes:'時間（分）',note:'メモ',itemId:'学習項目ID',scheduleId:'関連予定ID',required:'必須／任意',status:'完了状態',archived:'アーカイブ'};
   const display=(key,value)=>value===null||value===undefined?'—':key==='required'?(value?'必須':'任意'):key==='archived'?(value?'アーカイブ済み':'有効'):key==='status'?(value==='completed'?'完了':'未完了'):String(value);
   for(const change of preview.changes){
    const section=document.createElement('section');section.className='ai-change '+(change.type.startsWith('delete')?'change-delete':change.type.startsWith('add')?'change-add':'change-update');
    const title=document.createElement('h3');title.textContent=`${operationNames[change.type]}：${change.item} ／ ${change.after.date}`;section.append(title);
    const table=document.createElement('table'),head=document.createElement('thead');head.innerHTML='<tr><th scope="col">項目</th><th scope="col">変更前</th><th scope="col">変更後</th></tr>';table.append(head);const body=document.createElement('tbody');
    for(const [key,label]of Object.entries(labels)){if(!Object.hasOwn(change.after,key))continue;const changed=change.before?.[key]!==change.after[key];if(!changed&&!['date','subject'].includes(key))continue;const row=document.createElement('tr');if(changed)row.className='changed-field';const name=document.createElement('th');name.scope='row';name.textContent=label+(changed?'（変更）':'');row.append(name);for(const value of [change.before?.[key],change.after[key]]){const cell=document.createElement('td');cell.textContent=display(key,value);row.append(cell);}body.append(row);}table.append(body);section.append(table);
    const preserved=document.createElement('p');preserved.className='muted small';preserved.textContent=`対象ID：${change.id} ／ 保持する関連実績：${change.preservedRecordIds.length}件`;section.append(preserved);
    const details=document.createElement('details'),summary=document.createElement('summary'),raw=document.createElement('pre');summary.textContent='JSON全文・関連IDを確認';raw.textContent=JSON.stringify(change,null,2);details.append(summary,raw);section.append(details);$('ai-preview').append(section);
   }
   const warning=document.createElement('p');warning.className='review-warning';warning.textContent=preview.warnings.join('\n')||'予定変更で過去の実績は変更しません。';$('ai-preview').append(warning);status('まだ保存していません。日付・学習項目・変更前後を確認してから一括適用してください。');$('ai-input').open=false;$('ai-preview').tabIndex=-1;$('ai-preview').focus();$('ai-preview').scrollIntoView({block:'start'});
  }catch(e){reset();status(e.message,'error');}finally{lock(false);sync();}
 });
 $('ai-apply').addEventListener('click',async()=>{
  if(isBusy()||isDemo()||!pending||!$('ai-confirm').checked)return;const update=pending;pending=null;lock(true);status('一括保存中…');
  try{const data=await repository.applyAIUpdate(update);onSaved(data);status('全件をブラウザに保存しました。同じJSONは再適用できません。');$('ai-source').value='';$('ai-file').value='';}
  catch(e){status('適用できませんでした。元のデータは保持しています。 '+e.message,'error');onError(e);}
  finally{$('ai-confirm').checked=false;lock(false);sync();}
 });
 return {sync,dirty:()=>$('ai-source').value.trim().length>0,clear(){reset();$('ai-source').value='';$('ai-file').value='';$('ai-output').value='';}};
}
