
import {createIndexedDBRepository} from '../dist/src/storage/indexeddb.js';
import {accents} from '../dist/src/storage/preferences.js';
const assert=(v,m)=>{if(!v)throw Error(m);};
const wait=()=>new Promise(r=>setTimeout(r,40));
async function until(fn){for(let n=0;n<150;n++){if(fn())return;await wait();}throw Error('polish timeout');}
export async function runPolishUI(frame){
 let doc=frame.contentDocument;const win=frame.contentWindow,repo=createIndexedDBRepository();let count=0;
 const test=async(name,fn)=>{try{await fn();count++;}catch(e){throw Error(name+': '+e.message);}};
 const nav=v=>doc.querySelector('#navigation [data-view='+v+']').click();
 function filter(id,value){const el=doc.getElementById(id);el.value=value;el.dispatchEvent(new win.Event(el.type==='search'?'input':'change',{bubbles:true}));}
 async function refresh(){doc.querySelector('#reload-data').click();await until(()=>!doc.querySelector('#reload-data').disabled);}
 const mutate=async command=>repo.mutate(command,(await repo.load()).revision);
 let itemId,planId,beforeRecords,archived;
 try{
 await mutate({type:'addItem',input:{title:'復帰確認の架空項目',description:'synthetic'}});
 itemId=(await repo.load()).project.items.at(-1).id;
 await mutate({type:'addSchedule',input:{itemId,date:'2032-09-01',minutes:30,required:true}});
 planId=(await repo.load()).project.schedules.at(-1).id;
 await mutate({type:'addRecord',input:{itemId,scheduleId:planId,date:'2032-09-01',subject:'復帰確認の実績',minutes:25,note:'保持する',completeSchedule:true}});
 beforeRecords=(await repo.load()).records;
 await mutate({type:'deleteItem',id:itemId});archived=await repo.load();await refresh();
 await test('archived schedules are visible and parent prerequisite is explained',async()=>{
 nav('plans');filter('plan-mode','all');filter('plan-search','復帰確認');filter('plan-state','archived');
 assert(doc.querySelector('#plans-list').textContent.includes('先に学習項目'),'missing prerequisite');
 assert(!doc.querySelector('#plans-list [data-unarchive-plan]'),'restoration offered for archived parent');
 assert(!doc.querySelector('#plans-list [data-task]'),'archived completion offered');
 nav('items');filter('item-search','復帰確認');filter('item-state','archived');
 assert(doc.querySelector('[data-unarchive-item]'),'item restore missing');
 });
 await test('restore failure keeps archive and exposes error without false success',async()=>{
 const proto=win.IDBObjectStore.prototype,put=proto.put;
 try{proto.put=function(){throw new win.DOMException('synthetic quota','QuotaExceededError');};doc.querySelector('[data-unarchive-item]').click();await until(()=>!doc.querySelector('#reload-data').disabled);}finally{proto.put=put;}
 assert(JSON.stringify(await repo.load())===JSON.stringify(archived),'failed restore changed data');
 assert(doc.querySelector('#save-status').dataset.error==='true','failure hidden');
 assert(doc.activeElement.matches('[data-unarchive-item]'),'retry focus lost');
 });
 await test('stale restore rejects other tab update and permits explicit reviewed retry',async()=>{
 await mutate({type:'updateProject',input:{name:archived.project.name,description:archived.project.description,goal:archived.project.goal}});
 const newer=JSON.stringify(await repo.load());doc.querySelector('[data-unarchive-item]').click();await until(()=>!doc.querySelector('#reload-data').disabled);
 assert(JSON.stringify(await repo.load())===newer,'conflict overwrote data');assert(doc.querySelector('#save-status').textContent.includes('別のタブ'),'conflict hidden');
 await refresh();doc.querySelector('[data-unarchive-item]').click();await until(()=>!doc.querySelector('#reload-data').disabled);
 const s=await repo.load();assert(!s.project.items.find(i=>i.id===itemId).archived,'item not restored');assert(s.project.schedules.find(s=>s.id===planId).archived,'schedule auto restored');assert(doc.activeElement.id==='page-heading','removed button focus not recovered');
 });
 await test('schedule restore retains history progress and persists reload',async()=>{
 nav('plans');doc.querySelector('[data-unarchive-plan]').click();await until(()=>!doc.querySelector('#reload-data').disabled);
 const s=await repo.load(),plan=s.project.schedules.find(s=>s.id===planId);
 assert(!plan.archived&&plan.status==='completed'&&plan.date==='2032-09-01','restored plan altered');
 assert(JSON.stringify(s.records)===JSON.stringify(beforeRecords),'records changed');
 const old=doc;win.location.reload();await until(()=>frame.contentDocument!==old&&frame.contentDocument?.documentElement?.dataset.ready==='true');doc=frame.contentDocument;
 assert(doc.querySelector('#plan-state').value==='archived','archive filter lost');
 filter('plan-state','active');assert(doc.querySelector('#plans-list [data-task]').checked,'restored completion absent');
 const backup=(await repo.exportBackup()).backup;assert(backup.projects.find(p=>p.projectId===s.projectId).project.schedules.some(p=>p.id===planId&&!p.archived),'backup lost restored schedule');
 });
 await test('plan record and restored card focus target only visible content',async()=>{
 doc.querySelector('#plans-list [data-record-schedule]').click();doc.querySelector('[data-close=record-dialog]').click();await until(()=>doc.activeElement.matches('#plans-list [data-record-schedule]'));
 doc.querySelector('#plans-list [data-task]').click();await until(()=>!doc.querySelector('#reload-data').disabled);assert(doc.activeElement.matches('#plans-list [data-task]'),'checkbox focused hidden dashboard');
 nav('records');filter('record-from','');filter('record-to','');filter('record-search','復帰確認');doc.querySelector('#records-list [data-edit-record]').click();doc.querySelector('[data-close=record-dialog]').click();await until(()=>doc.activeElement.matches('#records-list [data-edit-record]'));
 assert(doc.querySelector('#list-status').textContent.includes('件'),'result announcement missing');
 nav('today');doc.querySelector('#settings-toggle').click();doc.querySelector('[data-card=stats]').click();await until(()=>!doc.querySelector('#settings-toggle').disabled);doc.querySelector('#settings-close').click();await wait();doc.querySelector('[data-restore=stats]').click();await until(()=>doc.activeElement.id==='card-stats');
 });
 await test('core text contrast across themes and accents, dialogs labelled',async()=>{
 const root=doc.documentElement,theme=root.dataset.theme,accent=root.style.getPropertyValue('--accent');
 function luminance(color){const numbers=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return numbers[0]*.2126+numbers[1]*.7152+numbers[2]*.0722;}
 function contrast(fg,bg){const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
 try{for(const t of ['light','dark','purple'])for(const [,color]of Object.values(accents)){root.dataset.theme=t;root.style.setProperty('--accent',color);for(const selector of ['.nav-link[aria-current]','.button.primary']){const cs=win.getComputedStyle(doc.querySelector(selector));assert(contrast(cs.color,cs.backgroundColor)>=4.5,'contrast '+t+' '+color+' '+selector);}}}finally{root.dataset.theme=theme;root.style.setProperty('--accent',accent);}
 for(const dialog of doc.querySelectorAll('dialog'))assert(doc.getElementById(dialog.getAttribute('aria-labelledby')),'dialog without accessible label');
 assert(doc.documentElement.scrollWidth<=win.innerWidth,'overflow');
 });
 }finally{await repo.close();win.confirm=()=>true;}
 return count;
}
