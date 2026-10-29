
import {createIndexedDBRepository} from '../dist/src/storage/indexeddb.js';
const assert=(v,m)=>{if(!v)throw Error(m);};
const pause=()=>new Promise(r=>setTimeout(r,40));
async function until(fn,label){for(let i=0;i<160;i++){if(fn())return;await pause();}throw Error('entry flow timeout '+label);}
export async function runEntryFlow(frame){
 let doc=frame.contentDocument;const win=frame.contentWindow,repo=createIndexedDBRepository();let count=0;
 const test=async(name,fn)=>{try{await fn();count++;}catch(e){throw Error(name+': '+e.message);}};
 const visible=el=>!!el&&el.getClientRects().length>0;
 const nav=name=>doc.querySelector('#navigation [data-view='+name+']').click();
 async function reload(){const old=doc;win.location.reload();await until(()=>frame.contentDocument!==old&&frame.contentDocument?.documentElement?.dataset.ready==='true','reload');doc=frame.contentDocument;win.confirm=()=>true;}
 async function failSave(form){
 const proto=win.IDBObjectStore.prototype,put=proto.put;
 try{proto.put=function(){throw new win.DOMException('synthetic','QuotaExceededError');};form.requestSubmit();await until(()=>form.querySelector('.form-error').textContent&&!doc.querySelector('#reload-data').disabled,'failed save');}finally{proto.put=put;}
 }
 try{
 await test('empty setup has a single theme entry and optional details',async()=>{
 assert(!visible(doc.querySelector('#project-edit'))&&!visible(doc.querySelector('#item-add'))&&!visible(doc.querySelector('#add-record')),'duplicate empty entry');
 nav('items');assert(visible(doc.querySelector('#project-edit')),'empty detail view has no setup entry');nav('today');doc.querySelector('#onboarding [data-create=project]').click();
 assert(!doc.querySelector('#project-details').open,'initial details expanded');
 const form=doc.querySelector('#project-form');form.elements.name.value='導線確認の架空テーマ';
 await failSave(form);assert((await repo.load()).project===null,'failed theme persisted');
 assert(form.elements.name.value==='導線確認の架空テーマ','theme input lost');
 form.requestSubmit();await until(()=>doc.documentElement.dataset.view==='plans'&&!doc.querySelector('#project-dialog').open,'theme to plan');
 assert((await repo.load()).project.name==='導線確認の架空テーマ','theme save');
 assert(visible(doc.querySelector('#plan-new'))&&doc.querySelector('#task-add').disabled,'empty choices');
 });
 let savedId;
 await test('content failure stays in step one, success advances with stable ID',async()=>{
 doc.querySelector('#plan-new').click();const form=doc.querySelector('#item-form');form.elements.title.value='架空の教材を読む';
 await failSave(form);assert(doc.querySelector('#item-dialog').open&&!doc.querySelector('#task-dialog').open,'advanced after failure');assert((await repo.load()).project.items.length===0,'partial content');
 form.requestSubmit();await until(()=>doc.querySelector('#task-dialog').open,'date step');
 savedId=(await repo.load()).project.items[0].id;assert(doc.querySelector('#task-form').elements.itemId.value===savedId,'wrong selected content');
 assert(doc.querySelector('#task-entry-help').textContent.includes('保存済み'),'saved boundary not explained');
 doc.querySelector('[data-close=task-dialog]').click();await until(()=>!doc.querySelector('#task-dialog').open,'cancel date');await pause();
 assert(doc.activeElement.id==='task-add','cancel focus');
 await reload();assert((await repo.load()).project.items.length===1&&(await repo.load()).project.schedules.length===0,'cancelled date lost content');
 });
 await test('resume saved content without duplication and preserve failed date input',async()=>{
 doc.querySelector('#task-add').click();const form=doc.querySelector('#task-form');form.elements.itemId.value=savedId;form.elements.date.value='2032-08-01';form.elements.minutes.value='35';
 await failSave(form);assert(form.elements.date.value==='2032-08-01','date input lost');assert((await repo.load()).project.schedules.length===0,'failed date persisted');
 form.requestSubmit();await until(()=>!doc.querySelector('#task-dialog').open,'schedule save');await pause();
 const s=await repo.load();assert(s.project.items.length===1&&s.project.schedules.length===1,'duplicate item');assert(s.project.schedules[0].itemId===savedId,'reference lost');
 assert(doc.querySelector('#plans-list').textContent.includes('2032-08-01'),'created plan not visible');
 });
 await test('daily creation routes to plan and item shortcuts use same workspace',async()=>{
 nav('today');assert(!visible(doc.querySelector('#item-add'))&&!visible(doc.querySelector('#task-add')),'creation leaks to today');assert(visible(doc.querySelector('#plan-link')),'plan entry missing');assert(doc.querySelector('#add-record').textContent.includes('予定外'),'unscheduled record unclear');
 const before=JSON.stringify(await repo.load());doc.querySelector('#plan-link').click();assert(doc.documentElement.dataset.view==='plans','plan navigation');
 nav('items');doc.querySelector('[data-plan-item]').click();assert(doc.documentElement.dataset.view==='plans'&&doc.querySelector('#task-dialog').open,'item shortcut bypasses plan');doc.querySelector('[data-close=task-dialog]').click();await pause();assert(doc.activeElement.id==='task-add','shortcut focus');assert(JSON.stringify(await repo.load())===before,'navigation wrote data');
 });
 await test('conflict retains planning draft and explicit refresh resumes the same flow',async()=>{
 doc.querySelector('#plan-new').click();const form=doc.querySelector('#item-form');form.elements.title.value='競合後に確認した架空内容';
 const current=await repo.load();await repo.mutate({type:'updateProject',input:{name:current.project.name,goal:'別タブで更新した架空目標'}},current.revision);
 form.requestSubmit();await until(()=>form.querySelector('.form-error').textContent.includes('別のタブ')&&!doc.querySelector('#reload-data').disabled,'conflict');
 assert(doc.querySelector('#item-dialog').open&&form.elements.title.value==='競合後に確認した架空内容','conflict discarded draft');
 assert(!(await repo.load()).project.items.some(i=>i.title==='競合後に確認した架空内容'),'conflicting item saved');
 form.querySelector('[data-refresh]').click();await until(()=>!!form.querySelector('.latest-data')&&!doc.querySelector('#reload-data').disabled,'review current');
 form.requestSubmit();await until(()=>doc.querySelector('#task-dialog').open,'retry next step');
 assert((await repo.load()).project.goal==='別タブで更新した架空目標','retry overwrote concurrent project');
 doc.querySelector('[data-close=task-dialog]').click();await pause();
 });
 await test('new content cancellation and history keep existing data',async()=>{
 const before=JSON.stringify(await repo.load());doc.querySelector('#plan-new').click();doc.querySelector('#item-form').elements.title.value='保存しない下書き';win.confirm=()=>false;doc.querySelector('[data-close=item-dialog]').click();assert(doc.querySelector('#item-dialog').open,'discarded without consent');win.confirm=()=>true;doc.querySelector('[data-close=item-dialog]').click();await pause();assert(doc.activeElement.id==='plan-new','content cancel focus');
 nav('today');nav('plans');win.history.back();await until(()=>doc.documentElement.dataset.view==='today','back');win.history.forward();await until(()=>doc.documentElement.dataset.view==='plans','forward');assert(JSON.stringify(await repo.load())===before,'cancel or history mutated data');
 assert(doc.documentElement.scrollWidth<=win.innerWidth,'entry overflow');
 });
 }finally{
 const s=await repo.load();if(s.project)await repo.mutate({type:'deleteProject'},s.revision);
 await repo.close();win.confirm=()=>true;win.sessionStorage.removeItem('stardia.ui.session.v1');win.history.replaceState(null,'',win.location.pathname+'?view=today');await reload();
 }
 return count;
}
