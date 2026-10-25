import {createIndexedDBRepository} from '../dist/src/storage/indexeddb.js';
import {normalizePreferences} from '../dist/src/storage/preferences.js';
const result=document.getElementById('result'),mode=new URLSearchParams(location.search).get('mode');
const assert=(v,m)=>{if(!v)throw Error(m);};
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('UI timed out');}
const semantic=b=>JSON.stringify({projects:b.projects,uiPreferences:b.uiPreferences});
try{
 const repo=createIndexedDBRepository();let data=await repo.load();
 if(!data.project)data=await repo.mutate({type:'createProject',input:{name:'架空の旧環境',goal:''}},data.revision);
 if(mode==='export'){
  data=await repo.mutate({type:'updateProject',input:{name:'<img src=x onerror=alert(1)>',goal:'架空の移行テスト'}},data.revision);
  if(!data.records.length)data=await repo.mutate({type:'addRecord',input:{date:'2026-10-25',subject:'架空データ',minutes:15,note:'移行確認'}},data.revision);
  const meta=await repo.initializePreferences(normalizePreferences(null));await repo.savePreferences(normalizePreferences({theme:'dark',accent:'pink',visibility:{stats:false}}),meta.preferencesRevision);
 }
 const frame=document.createElement('iframe');frame.src='../dist/';frame.style.width='390px';frame.style.height='844px';document.body.append(frame);await until(()=>frame.contentDocument?.documentElement.dataset.ready==='true');const doc=frame.contentDocument;
 doc.querySelector('#backup-open').click();
 if(mode==='export'){
  window.exportExpected=(await repo.exportBackup()).backup;
  doc.querySelector('#backup-download').click();await until(()=>doc.querySelector('#backup-status').textContent.includes('ダウンロードを開始'));
 }else{
  const text=await(await fetch('../.local/transfer.json')).text(),backup=JSON.parse(text);
  async function select(contents){const transfer=new frame.contentWindow.DataTransfer();transfer.items.add(new frame.contentWindow.File([contents],'restore.json',{type:'application/json'}));doc.querySelector('#backup-file').files=transfer.files;doc.querySelector('#backup-file').dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));await until(()=>!doc.querySelector('#backup-file').disabled);}
  async function apply(){doc.querySelector('#restore-confirm').click();doc.querySelector('#restore-apply').click();doc.querySelector('#restore-apply').click();await until(()=>!doc.querySelector('#backup-file').disabled);}
  await select('{');assert(doc.querySelector('#backup-status').textContent.includes('JSON'),'invalid JSON visible');assert(doc.querySelector('#restore-apply').disabled,'invalid restore disabled');
  await select(text);assert(doc.querySelector('#restore-summary').textContent.includes('<img'),'safe summary text');assert(!doc.querySelector('#restore-summary img'),'no HTML injection');assert(doc.querySelector('#restore-apply').disabled,'confirmation required');
  const before=await repo.exportBackup(),proto=frame.contentWindow.IDBObjectStore.prototype,put=proto.put;
  proto.put=function(...args){if(this.name==='metadata')throw new frame.contentWindow.DOMException('capacity','QuotaExceededError');return put.apply(this,args);};
  await apply();proto.put=put;assert(doc.querySelector('#backup-status').textContent.includes('復元できません'),'failure visible');assert(semantic((await repo.exportBackup()).backup)===semantic(before.backup),'failure retained workspace and preferences');
  await select(text);data=await repo.load();await repo.mutate({type:'updateProject',input:{name:'別タブの更新',goal:''}},data.revision);await apply();assert(doc.querySelector('#backup-status').textContent.includes('別のタブ'),'restore conflict visible');assert((await repo.load()).project.name==='別タブの更新','newer data retained');
  await select(text);const revision=(await repo.exportBackup()).revision;await apply();
  const restored=await repo.exportBackup();assert(restored.revision===revision+1,'double click commits once');assert(semantic(restored.backup)===semantic(backup),'cross-profile backup round trip matches');
  assert(doc.documentElement.dataset.theme==='dark','theme restored');assert(doc.querySelector('#card-stats').hidden,'visibility restored');assert(doc.documentElement.style.getPropertyValue('--accent')==='#bd377a','accent restored');
  doc.querySelector('#backup-close').click();frame.contentWindow.location.reload();await until(()=>frame.contentDocument!==doc&&frame.contentDocument?.documentElement.dataset.ready==='true');const next=frame.contentDocument;assert(next.documentElement.dataset.theme==='dark'&&next.querySelector('#card-stats').hidden,'settings persist after restart');
  next.querySelector('#switch-mode').click();await until(()=>next.querySelector('#mode-label').textContent==='架空デモ');assert(next.querySelector('#backup-open').disabled,'demo cannot export/restore');assert(semantic((await repo.exportBackup()).backup)===semantic(backup),'demo excluded');
 }
 await repo.close();result.textContent='PASS actual JSON '+mode+' via separate browser profile';result.dataset.result='passed';
}catch(e){result.textContent='FAIL '+e.stack;result.dataset.result='failed';}
