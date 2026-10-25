import {views,VIEW_KEY,readViewState,defaultViewState} from './ui/view-state.js';
import {renderViews} from './ui/views.js';
import {mountAI} from './ui/ai.js';
import {mountBackup} from './ui/backup.js';
import {localDate,dateText} from './domain/date.js';
import {createDemo} from './domain/demo.js';
import {createMemoryRepository} from './storage/memory.js';
import {createIndexedDBRepository,storageMessage} from './storage/indexeddb.js';
import {themes,accents,cards,readPreferences} from './storage/preferences.js';
import {esc} from './ui/html.js';
const $=id=>document.getElementById(id);
const today=localDate();
const realRepository=createIndexedDBRepository();
const demoRepository=createMemoryRepository(createDemo(today));
let demo=location.hash==='#demo',repository=demo?demoRepository:realRepository;
let busy=false,available=false,editingId=null,editingKind=null,editRevision=null;
let storage;
try {storage=window.localStorage;} catch {storage=null;}
const prefResult=readPreferences(storage);
let preferences=prefResult.value,preferencesRevision=0,settingsReady=false;
let data=null;
let session;try{session=window.sessionStorage;}catch{session=null;}
const viewState=readViewState(session,today);
let currentView=Object.hasOwn(views,new URLSearchParams(location.search).get('view'))?new URLSearchParams(location.search).get('view'):'today';
let selectedDate=viewState.plans.from,historyIndex=Number.isSafeInteger(history.state?.stardiaIndex)?history.state.stardiaIndex:0,reverting=false,lastTrigger=null,returnFocus=null,initialForm='',aiController,backupController;
function remember(){try{session?.setItem(VIEW_KEY,JSON.stringify(viewState));}catch{}}
function formValue(form){return JSON.stringify([...form.elements].filter(e=>e.name).map(e=>[e.name,e.type==='checkbox'?e.checked:e.value]));}
function dirty(){return !!editingKind&&formValue($(`${editingKind}-form`))!==initialForm;}
function permitLeave(){if(busy)return false;if(dirty()&&!confirm('未保存の入力を破棄して移動しますか？'))return false;if(editingKind)$(`${editingKind}-dialog`).close();if($('settings').open)settingsOpen(false);return true;}
function routeURL(view){const url=new URL(location.href);url.searchParams.set('view',view);return url.pathname+url.search+url.hash;}
history.replaceState({stardiaIndex:historyIndex},'',routeURL(currentView));
function showView(focus=false){document.documentElement.dataset.view=currentView;for(const section of document.querySelectorAll('[data-page]'))section.hidden=section.dataset.page!==currentView;for(const nav of document.querySelectorAll('#navigation [data-view]')){if(nav.dataset.view===currentView)nav.setAttribute('aria-current','page');else nav.removeAttribute('aria-current');}$('page-heading').textContent=currentView==='today'?'今日の学習':views[currentView];$('page-eyebrow').textContent={today:'TODAY',plans:'STUDY PLAN',items:'STUDY ITEMS',records:'STUDY RECORDS',analysis:'LEARNING INSIGHTS',ai:'AI WORKSPACE',data:'YOUR DATA'}[currentView];$('today-label').textContent=currentView==='today'?`${today} ・ ${dateText(today)}`:'';$('item-add').hidden=!['today','items'].includes(currentView);$('task-add').hidden=!['today','plans','items'].includes(currentView);$('add-record').hidden=!['today','records'].includes(currentView);if(focus){$('page-heading').focus();window.scrollTo(0,0);}}
function navigate(view){if(!Object.hasOwn(views,view)||view===currentView||!permitLeave())return;currentView=view;historyIndex++;history.pushState({stardiaIndex:historyIndex},'',routeURL(view));showView(true);}
window.addEventListener('popstate',async()=>{
 const nextIndex=history.state?.stardiaIndex,newDemo=location.hash==='#demo';if(reverting){reverting=false;return;}
 if(!permitLeave()||(newDemo!==demo&&aiController?.dirty()&&!confirm('AI更新JSONの入力を破棄してモードを切り替えますか？'))){reverting=true;history.go(historyIndex-(nextIndex??historyIndex-1));return;}
 historyIndex=nextIndex??0;const view=new URLSearchParams(location.search).get('view');currentView=Object.hasOwn(views,view)?view:'today';
 if(newDemo!==demo){aiController?.clear();backupController?.clear();demo=newDemo;repository=demo?demoRepository:realRepository;data=null;available=false;await refresh();}showView(true);
});
window.addEventListener('beforeunload',event=>{if(busy||dirty()||aiController?.dirty()){event.preventDefault();event.returnValue='';}});
document.addEventListener('click',event=>{lastTrigger=event.target.closest('button,a');},true);
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();$('main').focus();});
$('navigation').innerHTML=Object.entries(views).map(([id,label],i)=>`<button class="nav-link ${i===5?'nav-secondary':''}" data-view="${id}" ${id==='ai'?'id="ai-open"':id==='data'?'id="backup-open"':''}><span class="nav-icon" aria-hidden="true">${['◷','▦','▤','✓','▥','✧','▣'][i]}</span>${label}</button>`).join('');
document.addEventListener('click',event=>{const route=event.target.closest('button[data-view],a[data-view]');if(route){event.preventDefault();navigate(route.dataset.view);}});
function syncFilters(){selectedDate=viewState.plans.from;for(const control of document.querySelectorAll('[data-filter]')){const[group,key]=control.dataset.filter.split('.');if(control.id!=='record-item')control.value=viewState[group][key];}filterAvailability();}
function filterAvailability(){if(busy)return;$('view-date').disabled=viewState.plans.mode==='all';$('plan-to').disabled=viewState.plans.mode!=='range';$('analysis-from').disabled=$('analysis-to').disabled=viewState.analysis.mode!=='range';$('analysis-from').closest('label').hidden=$('analysis-to').closest('label').hidden=viewState.analysis.mode!=='range';$('plan-to').closest('label').hidden=viewState.plans.mode!=='range';$('view-date').closest('label').hidden=viewState.plans.mode==='all';}
for(const form of document.querySelectorAll('.filters'))form.addEventListener('submit',e=>e.preventDefault());
$('main').addEventListener('input',event=>{if(event.target.type==='search')updateFilter(event.target);});
$('main').addEventListener('change',event=>{if(event.target.dataset.filter)updateFilter(event.target);});
function updateFilter(control){if(busy)return;const[group,key]=control.dataset.filter.split('.');viewState[group][key]=control.value;viewState[group].page=0;selectedDate=viewState.plans.from;render();remember();}
$('main').addEventListener('click',event=>{const reset=event.target.closest('[data-reset]'),step=event.target.closest('[data-page-step]');if(busy)return;if(reset){viewState[reset.dataset.reset]=defaultViewState(today)[reset.dataset.reset];syncFilters();render();remember();}if(step){const group=step.dataset.pageStep;viewState[group].page+=Number(step.dataset.step);render();remember();const replacement=document.querySelector(`[data-page-step="${group}"][data-step="${step.dataset.step}"]`);(replacement?.disabled?$('page-heading'):replacement)?.focus();}});

function applyTheme() {
 document.documentElement.dataset.theme=preferences.theme;
 document.documentElement.style.setProperty('--accent',accents[preferences.accent][1]);
}
async function persistPreferences(next) {
 if(busy)return;lock(true);
 try{if(!settingsReady)throw new Error('表示設定の保存領域を読み込めません。最新データを確認してください。');const meta=await realRepository.savePreferences(next,preferencesRevision);preferences=meta.preferences;preferencesRevision=meta.preferencesRevision;$('settings-status').textContent='表示設定を保存しました。';}
 catch(error){$('settings-status').textContent=storageMessage(error);}
 finally{applyTheme();render();renderSettings();lock(false);}
}
function render(){
 $('mode-label').textContent=demo?'架空デモ':'自分の学習';$('mode-description').textContent=demo?'架空の体験環境。操作は実データに影響せず、再読み込みでリセット。':'ブラウザ内保存・端末間同期なし';$('switch-mode').textContent=demo?'自分の学習に戻る':'デモを試す';
 $('project-edit').textContent=data?.project?data.project.name+' ▾':'プロジェクト作成';$('project-edit').setAttribute('aria-label',data?.project?data.project.name+'のプロジェクト設定':'プロジェクト作成');
 renderViews(data,preferences,viewState,today,available);showView();controls();
}
function controls(){
 $('project-edit').disabled=busy||!available;$('item-add').disabled=busy||!available||!data?.project;$('task-add').disabled=busy||!available||!data?.project?.items.some(i=>!i.archived);$('add-record').disabled=busy||!available||!data?.project;
 $('backup-open').disabled=busy||demo||!settingsReady;$('ai-open').disabled=busy||demo||!available||!data?.project;
 for(const el of document.querySelectorAll('#ai-dialog button,#ai-dialog input,#ai-dialog select,#ai-dialog textarea'))el.disabled=busy||demo||!available||!data?.project;
 for(const el of document.querySelectorAll('#backup-dialog button,#backup-dialog input'))el.disabled=busy||demo||!settingsReady;
 $('ai-close').disabled=$('backup-close').disabled=busy;
 aiController?.sync();backupController?.sync();filterAvailability();
}
function renderSettings() {
 $('settings-content').innerHTML=`<fieldset><legend>表示するカード</legend>${Object.entries(cards).map(([id,label])=>`<label class="toggle-label"><span>${label}</span><input type="checkbox" role="switch" data-card="${id}" ${preferences.visibility[id]?'checked':''}></label>`).join('')}</fieldset><fieldset><legend>テーマ</legend><div class="theme-options">${Object.entries(themes).map(([id,label])=>`<label><input type="radio" name="theme" value="${id}" ${preferences.theme===id?'checked':''}><span class="theme-swatch theme-${id}"></span>${label}</label>`).join('')}</div></fieldset><fieldset><legend>アクセントカラー</legend><div class="accent-options">${Object.entries(accents).map(([id,[label,color]])=>`<label title="${label}"><input type="radio" name="accent" value="${id}" aria-label="${label}" ${preferences.accent===id?'checked':''}><span style="--swatch:${color}"></span></label>`).join('')}</div></fieldset><div class="settings-tip"><span>✦</span><p>自分らしいペースで。<br>表示する情報を選んで、<br>今日の学びに集中しよう。</p></div>`;
}
const disabledBefore=new WeakMap();
function lock(value){busy=value;for(const el of document.querySelectorAll('button,input,select,textarea')){if(value){disabledBefore.set(el,el.disabled);el.disabled=true;}else if(disabledBefore.has(el)){el.disabled=disabledBefore.get(el);disabledBefore.delete(el);}}if(!value)controls();}
function showError(error,form){
 const message=storageMessage(error);$('save-status').textContent=message;$('save-status').dataset.error='true';
 if(form)form.querySelector('.form-error').textContent=message;
}
async function refresh(){
 if(busy)return;lock(true);
 try{const meta=await realRepository.initializePreferences(prefResult.value);preferences=meta.preferences;preferencesRevision=meta.preferencesRevision;settingsReady=true;applyTheme();renderSettings();const latest=await repository.load();data=latest;available=true;if(editingKind)editRevision=data.revision;$('save-status').textContent='最新データを読み込みました。開いている入力内容はそのままです。';$('save-status').dataset.error='false';}
 catch(error){if(demo){data=await demoRepository.load();available=true;}else available=false;showError(error);}
 finally{render();lock(false);}
}
async function save(command,form=null){
 if(busy||!available)return false;
 lock(true);if(form)form.querySelector('.form-error').textContent='';$('save-status').textContent=demo?'デモを更新中…':'保存中…';$('save-status').dataset.error='false';
 try{
  data=await repository.mutate(command,form?editRevision:data.revision);

  if(['addSchedule','updateSchedule','addTask','updateTask'].includes(command.type)){selectedDate=command.input.date;viewState.plans.from=selectedDate;viewState.plans.mode='day';viewState.plans.query='';viewState.plans.page=0;syncFilters();remember();}
  $('save-status').textContent=demo?'デモだけを更新しました。実データは変更していません。':'ブラウザに保存しました。';
  render();return true;
 }catch(error){showError(error,form);render();return false;}
 finally{lock(false);}
}
function optionsForItems(selected,optional=false){return (optional?'<option value="">関連付けなし</option>':'<option value="">学習項目を選択</option>')+data.project.items.filter(i=>!i.archived||i.id===selected).map(i=>`<option value="${esc(i.id)}" ${i.id===selected?'selected':''}>${esc(i.title)}${i.archived?'（削除済み）':''}</option>`).join('');}
function recordSchedules(selected=null){
 const form=$('record-form'),itemId=form.elements.itemId.value;
 form.elements.scheduleId.innerHTML='<option value="">予定に関連付けない</option>'+data.project.schedules.filter(s=>s.itemId===itemId&&(!s.archived||s.id===selected)).map(s=>`<option value="${esc(s.id)}" ${s.id===selected?'selected':''}>${esc(s.date)} ・ ${s.minutes}分${s.archived?'（削除済み）':''}</option>`).join('');
 form.elements.completeSchedule.checked=false;form.elements.completeSchedule.disabled=!form.elements.scheduleId.value||data.project.schedules.find(s=>s.id===form.elements.scheduleId.value)?.archived===true;
}
function openEditor(kind,id=null,context={}){
 if(busy||!available)return;
 returnFocus=lastTrigger?.id?'#'+CSS.escape(lastTrigger.id):lastTrigger?Array.from(lastTrigger.attributes).filter(a=>a.name.startsWith('data-')&&a.name!=='data-close').map(a=>`[${a.name}=${JSON.stringify(a.value)}]`).join(''):null;
 editingKind=kind;editingId=kind==='project'?(data.project?.id||null):id;editRevision=data.revision;
 const form=$(`${kind}-form`);form.reset();form.querySelector('.form-error').textContent='';form.querySelector('.latest-data')?.remove();
 form.querySelector('.mode-help').textContent=demo?'デモの操作です。実データは変更しません。':'変更はこのブラウザに保存します。';
 const item=kind==='project'?data.project:kind==='task'?data.project.schedules.find(t=>t.id===id):kind==='item'?data.project.items.find(i=>i.id===id):data.records.find(r=>r.id===id);
 if(kind==='project'){for(const key of ['name','description','goal','startDate','targetDate'])form.elements[key].value=item?.[key]||'';}
 else if(kind==='item'){form.elements.title.value=item?.title||'';form.elements.description.value=item?.description||'';}
 else if(kind==='task'){form.elements.itemId.innerHTML=optionsForItems(item?.itemId||context.itemId);form.elements.date.value=item?.date||(currentView==='plans'?selectedDate:today);form.elements.minutes.value=item?.minutes||25;form.elements.required.checked=item?.required!==false;}
 else {
  const plan=context.scheduleId?data.project.schedules.find(s=>s.id===context.scheduleId):null;
  form.elements.date.value=item?.date||plan?.date||(currentView==='plans'?selectedDate:today);form.elements.subject.value=item?.subject||data.project.items.find(i=>i.id===plan?.itemId)?.title||'';form.elements.minutes.value=item?.minutes||plan?.minutes||25;form.elements.note.value=item?.note||'';
  form.elements.itemId.innerHTML=optionsForItems(item?.itemId||plan?.itemId,true);recordSchedules(item?.scheduleId||plan?.id);
 }
 $(`${kind}-delete`).hidden=kind==='project'?!data.project:!id;
 initialForm=formValue(form);$(`${kind}-dialog`).showModal();form.querySelector('input:not([type=checkbox]),textarea,select')?.focus();
}
$('record-form').elements.itemId.addEventListener('change',()=>{const form=$('record-form');recordSchedules();if(!form.elements.subject.value)form.elements.subject.value=data.project.items.find(i=>i.id===form.elements.itemId.value)?.title||'';});
$('record-form').elements.scheduleId.addEventListener('change',()=>{const form=$('record-form'),s=data.project.schedules.find(x=>x.id===form.elements.scheduleId.value);form.elements.completeSchedule.checked=false;form.elements.completeSchedule.disabled=!s||s.archived;});
$('main').addEventListener('change',async event=>{
 const id=event.target.dataset.task;if(!id)return;
 if(busy){render();return;}
 await save({type:'setTaskStatus',id,status:event.target.checked?'completed':'unstarted'});
 document.querySelector(`[data-task="${id}"]`)?.focus();
});
$('main').addEventListener('click',event=>{
 if(busy)return;const day=event.target.closest('[data-date]');if(day){selectedDate=day.dataset.date;viewState.plans.from=selectedDate;viewState.plans.mode='day';viewState.plans.page=0;syncFilters();render();remember();navigate('plans');}
 const create=event.target.closest('[data-create]');if(create)openEditor(create.dataset.create);
 const task=event.target.closest('[data-edit-task]');if(task)openEditor('task',task.dataset.editTask);
 const linked=event.target.closest('[data-record-schedule]');if(linked)openEditor('record',null,{scheduleId:linked.dataset.recordSchedule});
 const record=event.target.closest('[data-edit-record]');if(record)openEditor('record',record.dataset.editRecord);
 const item=event.target.closest('[data-edit-item]');if(item)openEditor('item',item.dataset.editItem);
 const plan=event.target.closest('[data-plan-item]');if(plan)openEditor('task',null,{itemId:plan.dataset.planItem});
});
$('project-edit').addEventListener('click',()=>openEditor('project'));
$('task-add').addEventListener('click',()=>openEditor('task'));
$('item-add').addEventListener('click',()=>openEditor('item'));
$('add-record').addEventListener('click',()=>openEditor('record'));
for(const kind of ['record','task','item','project']){
 const dialog=$(`${kind}-dialog`),form=$(`${kind}-form`);
 dialog.addEventListener('cancel',event=>{if(busy||(dirty()&&!confirm('未保存の入力を破棄して閉じますか？')))event.preventDefault();});
 dialog.addEventListener('close',()=>{if(!dialog.open){editingKind=null;editingId=null;editRevision=null;initialForm='';const target=returnFocus?document.querySelector(returnFocus):null;requestAnimationFrame(()=>{(target&&!target.closest('[hidden]')?target:$('page-heading')).focus();});}});
 form.querySelector('[data-refresh]').addEventListener('click',async()=>{
  if(busy||!confirm('入力を残して最新データを読み込みます。現在の保存内容を確認してから保存してください。'))return;
  await refresh();if(!available)return;
  form.querySelector('.latest-data')?.remove();
  const latest=kind==='project'?data.project:kind==='task'?data.project?.schedules.find(t=>t.id===editingId):kind==='item'?data.project?.items.find(i=>i.id===editingId):data.records.find(r=>r.id===editingId);
  const panel=document.createElement('pre');panel.className='latest-data';
  panel.textContent='現在保存されている内容：\n'+(!latest?'該当するデータはありません。':kind==='project'?`名前：${latest.name}\n説明：${latest.description}\n目標：${latest.goal}\n期間：${latest.startDate||'未設定'} ～ ${latest.targetDate||'未設定'}`:kind==='item'?`名称：${latest.title}\n説明：${latest.description}${latest.archived?'\n削除済み':''}`:kind==='task'?`項目：${data.project.items.find(i=>i.id===latest.itemId)?.title}\n予定日：${latest.date}\n時間：${latest.minutes}分${latest.archived?'\n削除済み':''}`:`内容：${latest.subject}\n日付：${latest.date}\n時間：${latest.minutes}分\nメモ：${latest.note}`);
  form.querySelector('.form-error').before(panel);form.querySelector('.form-error').textContent='最新の保存内容と入力を比較し、必要なら修正してから保存してください。';
 });
 form.querySelector('[data-close]').addEventListener('click',()=>{if(!busy&&(!dirty()||confirm('未保存の入力を破棄して閉じますか？')))dialog.close();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const fields=new FormData(form);
  const input=Object.fromEntries(fields);
  if(kind==='task'||kind==='record')input.minutes=Number(input.minutes);
  if(kind==='record')input.completeSchedule=form.elements.completeSchedule.checked;
  if(kind==='task')input.required=form.elements.required.checked;
  const type=kind==='project'?(editingId?'updateProject':'createProject'):(editingId?'update':'add')+(kind==='record'?'Record':kind==='item'?'Item':'Schedule');
  if(await save({type,id:editingId,input},form)){dialog.close();}
 });
 $(`${kind}-delete`).addEventListener('click',async()=>{
  if(busy)return;
  const warning=kind==='project'?'このプロジェクトの計画・記録・進捗をすべて削除します。元に戻せません。削除しますか？':kind==='item'?'この学習項目と関連する予定を一覧から外します。過去の実績と参照情報は残ります。削除しますか？':kind==='task'?'この予定を一覧から外します。学習項目と過去の実績は残ります。削除しますか？':'この学習記録を削除しますか？';
  if(!confirm(warning))return;
  if(await save({type:'delete'+(kind==='task'?'Schedule':kind[0].toUpperCase()+kind.slice(1)),id:editingId},form))dialog.close();
 });
}
$('reload-data').addEventListener('click',async()=>{
 if(editingKind&&!confirm('入力は残したまま最新データを読み込みます。保存すると入力内容を最新データへ反映します。変更を確認してから保存してください。'))return;
 await refresh();
});
$('switch-mode').addEventListener('click',async()=>{
 if(!permitLeave())return;if(aiController?.dirty()&&!confirm('AI更新JSONの入力を破棄してモードを切り替えますか？'))return;aiController?.clear();backupController?.clear();
 demo=!demo;repository=demo?demoRepository:realRepository;data=null;available=false;
 history.replaceState({stardiaIndex:historyIndex},'',location.pathname+location.search+(demo?'#demo':''));
 await refresh();
});
$('settings').addEventListener('change',async event=>{
 if(busy)return;const input=event.target,next=structuredClone(preferences);const focusSelector=input.dataset.card?`[data-card="${input.dataset.card}"]`:`[name="${input.name}"][value="${input.value}"]`;
 if(input.dataset.card)next.visibility[input.dataset.card]=input.checked;
 else if(input.name==='theme')next.theme=input.value;
 else if(input.name==='accent')next.accent=input.value;
 else return;
 await persistPreferences(next);$('settings').querySelector(focusSelector)?.focus();
});
$('hidden-cards').addEventListener('click',async event=>{
 if(busy)return;const id=event.target.closest('[data-restore]')?.dataset.restore;if(!id)return;
 const next=structuredClone(preferences);next.visibility[id]=true;await persistPreferences(next);document.querySelector(`[data-card="${id}"]`)?.focus();
});
aiController=mountAI({navigate,repository:realRepository,isBusy:()=>busy,isDemo:()=>demo,lock,onError:showError,getDate:()=>selectedDate,onSaved:result=>{data=result;available=true;render();$('save-status').dataset.error='false';$('save-status').textContent='AI更新JSONの全件を保存しました。';}});
backupController=mountBackup({navigate,repository:realRepository,isBusy:()=>busy,isDemo:()=>demo,lock,onError:showError,onRestore:result=>{
 data=result.data;preferences=result.meta.preferences;preferencesRevision=result.meta.preferencesRevision;settingsReady=true;available=true;applyTheme();renderSettings();render();$('save-status').dataset.error='false';$('save-status').textContent='学習環境を復元しました。';
}});
function settingsOpen(open){viewState.settingsOpen=open;remember();$('settings-toggle').setAttribute('aria-expanded',String(open));if(open&&!$('settings').open)$('settings').showModal();else if(!open&&$('settings').open)$('settings').close();}
$('settings-toggle').addEventListener('click',()=>{if(!busy)settingsOpen(!$('settings').open);});
$('settings-close').addEventListener('click',()=>{if(!busy)settingsOpen(false);});
$('settings').addEventListener('cancel',event=>{if(busy)event.preventDefault();else{viewState.settingsOpen=false;remember();}});
$('settings').addEventListener('close',()=>{viewState.settingsOpen=false;remember();$('settings-toggle').setAttribute('aria-expanded','false');$('settings-toggle').focus();});
if(prefResult.error)$('settings-status').textContent='表示設定を読み込めないため、標準設定を使います。';
syncFilters();applyTheme();renderSettings();await refresh();if(viewState.settingsOpen)settingsOpen(true);
document.documentElement.dataset.ready='true';
