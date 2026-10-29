import {createIndexedDBRepository} from '../dist/src/storage/indexeddb.js';
const assert=(v,m)=>{if(!v)throw Error(m);};
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Model UI timed out');}
export async function runModelUI(frame){
 let doc=frame.contentDocument;frame.contentWindow.confirm=()=>true;
 async function submit(kind,values){const form=doc.getElementById(kind+'-form');for(const[key,value]of Object.entries(values)){if(typeof value==='boolean')form.elements[key].checked=value;else form.elements[key].value=value;}form.requestSubmit();await until(()=>!doc.getElementById(kind+'-dialog').open||form.querySelector('.form-error').textContent);assert(!doc.getElementById(kind+'-dialog').open,form.querySelector('.form-error').textContent);await new Promise(r=>setTimeout(r,20));}
 const repo=createIndexedDBRepository();
 try{
 doc.querySelector('#project-edit').click();await submit('project',{description:'自分の学習環境',startDate:'2031-01-01',targetDate:'2031-02-01'});
 doc.querySelector('#navigation [data-view=items]').click();doc.querySelector('#item-add').click();await submit('item',{title:'自由な学び',description:'好きな方法で学習'});
 let snapshot=await repo.load();const itemId=snapshot.project.items.find(i=>i.title==='自由な学び').id;
 for(const[date,minutes]of[['2031-01-10','30'],['2031-01-12','45']]){doc.querySelector('#navigation [data-view=items]').click();doc.querySelector(`[data-plan-item="${itemId}"]`).click();await submit('task',{date,minutes});}
 snapshot=await repo.load();const plans=snapshot.project.schedules.filter(s=>s.itemId===itemId);assert(plans.length===2,'same item multiple dates');assert(plans.every(s=>!('title'in s)),'title duplicated');
 const scheduleId=plans[1].id;doc.querySelector('#navigation [data-view=plans]').click();
 doc.querySelector(`[data-record-schedule="${scheduleId}"]`).click();await submit('record',{minutes:'27',note:'当日の実績',completeSchedule:true});
 snapshot=await repo.load();const record=snapshot.records.find(r=>r.scheduleId===scheduleId);assert(record.itemId===itemId&&record.date==='2031-01-12','record links');assert(snapshot.project.schedules.find(s=>s.id===scheduleId).status==='completed','completion linked');
 doc.querySelector('#navigation [data-view=items]').click();doc.querySelector(`[data-edit-item="${itemId}"]`).click();await submit('item',{title:'改名した学び',description:'説明も編集'});
 doc.querySelector('#navigation [data-view=plans]').click();assert(doc.querySelector('#plans-list').textContent.includes('改名した学び'),'schedule title follows rename');
 doc.querySelector(`[data-edit-task="${scheduleId}"]`).click();await submit('task',{date:'2031-01-13',minutes:'60'});
 assert(JSON.stringify((await repo.load()).records.find(r=>r.id===record.id))===JSON.stringify(record),'historical record changed');
 const mode=doc.querySelector('#plan-mode');mode.value='week';mode.dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));assert(doc.querySelector('[data-date="2031-01-13"]').textContent.includes('1/1'),'weekly completion');
 doc.querySelector(`[data-edit-task="${scheduleId}"]`).click();doc.querySelector('#task-delete').click();await until(()=>!doc.querySelector('#task-dialog').open);assert(!(doc.querySelector(`[data-task="${scheduleId}"]`)),'schedule still visible');
 doc.querySelector('#navigation [data-view=items]').click();doc.querySelector(`[data-edit-item="${itemId}"]`).click();doc.querySelector('#item-delete').click();await until(()=>!doc.querySelector('#item-dialog').open);
 snapshot=await repo.load();assert(snapshot.project.items.find(i=>i.id===itemId).archived,'item not archived');assert(snapshot.project.schedules.filter(s=>s.itemId===itemId).every(s=>s.archived),'associated schedules remain active');assert(JSON.stringify(snapshot.records.find(r=>r.id===record.id))===JSON.stringify(record),'delete lost record');
 doc.querySelector('#navigation [data-view=records]').click();doc.querySelector('#records-list').querySelector(`[data-edit-record="${record.id}"]`).click();assert(doc.querySelector('#record-form').elements.itemId.selectedOptions[0].textContent.includes('削除済み'),'historical item label');await submit('record',{note:'履歴を保持して追記'});
 const backup=await repo.exportBackup();await repo.restoreBackup(backup.backup,backup.revision);
 frame.contentWindow.location.reload();await until(()=>frame.contentDocument!==doc&&frame.contentDocument?.documentElement?.dataset.ready==='true');doc=frame.contentDocument;
 assert((await repo.load()).records.find(r=>r.id===record.id).note==='履歴を保持して追記','restore lost record');
 doc.querySelector('#navigation [data-view=items]').click();doc.querySelector('#item-state').value='archived';doc.querySelector('#item-state').dispatchEvent(new frame.contentWindow.Event('change',{bubbles:true}));assert(doc.querySelector('#items-list').textContent.includes('改名した学び'),'archived reference missing');
 assert((await repo.load()).project.description==='自分の学習環境','project metadata lost');
 return 1;
 }finally{await repo.close();}
}
