import {runBackupTests} from './backup.test.js';
import {STORAGE_KEY} from '../dist/src/storage/preferences.js';
import {createIndexedDBRepository,DB_NAME} from '../dist/src/storage/indexeddb.js';
import {runStorageTests} from './idb.test.js';
const result=document.getElementById('result');
const assert=(value,message)=>{if(!value)throw Error(message);};
const wait=()=>new Promise(resolve=>setTimeout(resolve,40));
async function until(fn,message){for(let i=0;i<150;i++){if(fn())return;await wait();}throw Error(message);}
async function ready(frame){await until(()=>frame.contentDocument?.documentElement.dataset.ready==='true','Application did not become ready');}
async function submit(doc,kind,values){const form=doc.getElementById(kind+'-form');for(const [key,value]of Object.entries(values)){if(typeof value==='boolean')form.elements[key].checked=value;else form.elements[key].value=value;}form.requestSubmit();await until(()=>!doc.getElementById(kind+'-dialog').open||form.querySelector('.form-error').textContent,'form did not finish');}
async function mount(hash=''){const f=document.createElement('iframe');f.style.width=new URLSearchParams(location.search).get('width')+'px';f.src='../dist/'+hash;document.body.append(f);await ready(f);f.contentWindow.confirm=()=>true;return f;}
try {
 const storageTests=await runStorageTests();const backupTests=await runBackupTests();
 localStorage.removeItem(STORAGE_KEY);
 await new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase(DB_NAME);q.onsuccess=resolve;q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('unexpected open test database'));});
 const frame=await mount();let doc=frame.contentDocument;
 assert(doc.querySelector('h1').textContent==='学びのダッシュボード','Japanese UI');
 assert(doc.documentElement.scrollWidth<=frame.contentWindow.innerWidth,'responsive');
 assert(frame.contentWindow.innerWidth===Number(new URLSearchParams(location.search).get('width')),'viewport');
 assert(doc.querySelector('#dashboard').textContent.includes('空の学習環境'),'new user empty');
 doc.querySelector('#project-edit').click();await submit(doc,'project',{name:'架空の永続テスト',goal:'テスト用'});
 doc.querySelector('#project-edit').click();await submit(doc,'project',{name:'編集したプロジェクト',goal:'更新した目標'});
 doc.querySelector('#project-edit').click();doc.querySelector('#project-delete').click();await until(()=>!doc.querySelector('#project-dialog').open,'project deleted');
 frame.contentWindow.location.reload();await wait();await ready(frame);doc=frame.contentDocument;frame.contentWindow.confirm=()=>true;
 assert(doc.querySelector('#dashboard').textContent.includes('空の学習環境'),'deleted project not recreated');
 doc.querySelector('#project-edit').click();await submit(doc,'project',{name:'架空の永続テスト',goal:'テスト用'});
 doc.querySelector('#task-add').click();await submit(doc,'task',{title:'架空の計画',minutes:'20'});
 const checkbox=doc.querySelector('[data-task]'),id=checkbox.dataset.task;checkbox.click();await until(()=>doc.querySelector('[data-task]').checked&&!doc.querySelector('[data-task]').disabled,'task saved');
 doc.querySelector('[data-edit-task]').click();await submit(doc,'task',{title:'更新した計画',minutes:'30'});assert(doc.querySelector('[data-task]').checked,'edit preserves progress');
 const viewDate=doc.querySelector('#view-date'),originalDate=viewDate.value;viewDate.value='2030-01-15';viewDate.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));assert(doc.querySelector('#card-today').textContent.includes('予定はありません'),'arbitrary date view');viewDate.value=originalDate;viewDate.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));
 doc.querySelector('#add-record').click();await submit(doc,'record',{subject:'<img src=x onerror=alert(1)>',minutes:'17',note:'架空テスト'});
 assert(doc.querySelector('.recent-list').textContent.includes('<img src=x'),'record text');assert(!doc.querySelector('.recent-list img'),'escaped HTML');
 doc.querySelector('[data-edit-record]').click();await submit(doc,'record',{subject:'更新した記録',minutes:'23'});
 doc.querySelector('[name=theme][value=dark]').click();await until(()=>doc.documentElement.dataset.theme==='dark'&&!doc.querySelector('[name=theme]').disabled,'theme save');doc.querySelector('[data-card=stats]').click();await until(()=>doc.querySelector('#card-stats').hidden,'hide saved');assert(doc.querySelector('#card-stats').hidden,'hide stats');doc.querySelector('[data-restore=stats]').click();await until(()=>!doc.querySelector('#card-stats').hidden,'restore settings saved');assert(!doc.querySelector('#card-stats').hidden,'restore stats');
 frame.contentWindow.location.reload();await wait();await ready(frame);doc=frame.contentDocument;frame.contentWindow.confirm=()=>true;
 assert(doc.documentElement.dataset.theme==='dark','theme persists');assert(doc.querySelector('.recent-list').textContent.includes('更新した記録'),'record persists');assert(doc.querySelector('[data-task]').checked,'progress persists');
 // Real UI save error: throw from IDB write after the editor has opened.
 doc.querySelector('#add-record').click();const proto=frame.contentWindow.IDBObjectStore.prototype,put=proto.put;
 proto.put=function(){throw new frame.contentWindow.DOMException('test capacity','QuotaExceededError');};
 await submit(doc,'record',{subject:'保存してはいけない記録',minutes:'9'});
 assert(doc.querySelector('#record-dialog').open,'failed save keeps form');assert(doc.querySelector('#form-error').textContent.includes('保存容量'),'visible save failure');assert(doc.querySelector('#record-form').elements.subject.value==='保存してはいけない記録','draft retained');assert(!doc.querySelector('.recent-list').textContent.includes('保存してはいけない'),'no false saved record');proto.put=put;doc.querySelector('[data-close=record-dialog]').click();await wait();
 // Two independently loaded UI documents hold the same revision.
 const second=await mount();const other=second.contentDocument;other.querySelector('#add-record').click();
 doc.querySelector('#add-record').click();await submit(doc,'record',{subject:'タブA',minutes:'10'});
 await submit(other,'record',{subject:'タブB',minutes:'11'});assert(other.querySelector('#form-error').textContent.includes('別のタブ'),'UI conflict detected');assert(other.querySelector('#record-dialog').open,'conflict draft retained');
 // Explicit refresh inside the dialog retains the draft and allows a reviewed retry.
 other.querySelector('#record-form [data-refresh]').click();await until(()=>other.querySelector('.recent-list').textContent.includes('タブA'),'refresh winner');
 assert(other.querySelector('#record-form').elements.subject.value==='タブB','draft survives refresh');
 await submit(other,'record',{});assert(!other.querySelector('#record-dialog').open,'reviewed retry succeeds');
 other.querySelector('#task-add').click();await submit(other,'task',{title:'削除する計画',minutes:'12'});
 const taskButtons=[...other.querySelectorAll('[data-edit-task]')];taskButtons.at(-1).click();other.querySelector('#task-delete').click();await until(()=>!other.querySelector('#task-dialog').open,'task deleted');
 assert(!other.querySelector('#dashboard').textContent.includes('削除する計画'),'task absent');
 other.querySelector('#add-record').click();await submit(other,'record',{subject:'削除する記録',minutes:'12'});
 const repo=createIndexedDBRepository();let snapshot=await repo.load();const deleteId=snapshot.records.find(x=>x.subject==='削除する記録').id;
 other.querySelector(`[data-edit-record="${deleteId}"]`).click();other.querySelector('#record-delete').click();await until(()=>!other.querySelector('#record-dialog').open,'delete record');assert(!(await repo.load()).records.some(x=>x.id===deleteId),'record removed');
 // Demo changes never flow into the real store.
 doc.querySelector('#switch-mode').click();await until(()=>doc.querySelector('#mode-label').textContent==='架空デモ','demo switch');
 const before=JSON.stringify(await repo.load());doc.querySelector('#add-record').click();await submit(doc,'record',{subject:'デモだけ',minutes:'5'});assert(JSON.stringify(await repo.load())===before,'demo isolated');
 frame.contentWindow.location.reload();await wait();await ready(frame);doc=frame.contentDocument;assert(!doc.querySelector('.recent-list').textContent.includes('デモだけ'),'demo resets');
 doc.querySelector('#switch-mode').click();await until(()=>doc.querySelector('#mode-label').textContent==='自分の学習','return real');assert(doc.querySelector('.recent-list').textContent.includes('更新した記録'),'real survives demo');
 // Durable expected snapshot read by a separate Chrome process.
 snapshot=await repo.load();localStorage.setItem('stardia.test.expected',JSON.stringify(snapshot));await repo.close();
 doc.querySelector('#settings-toggle').click();assert(doc.querySelector('#settings').hidden,'settings collapsed');
 result.textContent=`PASS: ${storageTests} IndexedDB tests; ${backupTests} backup tests; UI CRUD, errors, reload, demo isolation, two tabs`;result.dataset.result='passed';
} catch(error){result.textContent='FAIL: '+error.stack;result.dataset.result='failed';}
