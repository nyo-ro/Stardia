import {parseDate,localDate,mondayOf,plusDays,dateText,minText} from './domain/date.js';
import {tasksOn,progress,summarize} from './domain/study.js';
import {createDemo} from './domain/demo.js';
import {createMemoryRepository} from './storage/memory.js';
import {createIndexedDBRepository,storageMessage} from './storage/indexeddb.js';
import {themes,accents,cards,readPreferences,writePreferences} from './storage/preferences.js';
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
let preferences=prefResult.value;
let data=null;
let selectedDate=today;
function applyTheme() {
 document.documentElement.dataset.theme=preferences.theme;
 document.documentElement.style.setProperty('--accent',accents[preferences.accent][1]);
}
function persistPreferences() {
 $('settings-status').textContent=writePreferences(storage,preferences)?'表示設定を保存しました。':'設定を保存できません。今回の表示にのみ反映します。';
 applyTheme();
}
function card(id,html) {return `<section id="card-${id}" class="card card-${id}" ${preferences.visibility[id]?'':'hidden'} aria-label="${cards[id]}">${html}</section>`;}
function render() {
 $('view-date').value=selectedDate;
 $('mode-label').textContent=demo?'架空デモ':'自分の学習';
 $('mode-description').textContent=demo?'架空の体験環境です。操作は実データに影響せず、再読み込みでリセットされます。':'学習データはこのブラウザに保存します。別端末には同期されません。ブラウザのデータ消去にご注意ください。';
 $('switch-mode').textContent=demo?'自分の学習に戻る':'デモを試す';
 $('project-edit').textContent=data?.project?'プロジェクトを編集':'プロジェクト作成';
 $('project-edit').disabled=!available||busy;
 $('task-add').disabled=!available||!data?.project||busy;
 $('today-label').textContent=dateText(today);
 if(!data?.project){
  $('dashboard').innerHTML=`<section class="card card-today"><h2>${available?'空の学習環境から始めよう':'保存領域を読み込めませんでした'}</h2><p class="muted">${available?'上の「プロジェクト作成」から名前を付け、計画と記録を追加できます。デモは別の体験環境です。':'データは初期化していません。「最新データを確認」で再試行するか、デモをご利用ください。'}</p></section>`;
  $('hidden-cards').innerHTML='';return;
 }

 const tasks=tasksOn(data.project,selectedDate),done=progress(tasks),summary=summarize(data.records);
 const selectedRecords=data.records.filter(record=>record.date===selectedDate);
 const start=mondayOf(selectedDate);
 $('today-label').textContent=dateText(today);
 $('dashboard').innerHTML=card('today',`<div class="hero-top"><span class="eyebrow">${selectedDate===today?'TODAY':'DAILY PLAN'} / ${esc(dateText(selectedDate))}</span><span class="pill">${esc(data.project.name)}</span></div><div class="hero-body"><div><h2>今日の一歩が、<br>明日の自分につながる。</h2><p class="muted">${esc(data.project.goal)}</p><div class="hero-metrics"><div class="ring" style="--progress:${done.percent}%"><span><strong>${done.completed}<small> / ${done.total}</small></strong><small>必須タスク完了</small></span></div><div><strong class="big-number">${minText(summarize(selectedRecords).minutes)}</strong><p class="muted small">この日の学習時間</p></div></div></div><div class="task-panel"><h3>この日の学習 <span>${tasks.length}件</span></h3>${tasks.map(task=>`<label class="task ${task.status==='completed'?'done':''}"><input type="checkbox" data-task="${esc(task.id)}" ${task.status==='completed'?'checked':''}><span>${esc(task.title)}${task.required===false?'<small>任意の学習</small>':''}</span><time>${minText(task.minutes)}</time></label><button class="button quiet task-edit" data-edit-task="${esc(task.id)}">項目を編集</button>`).join('')||'<p class="muted">この日の予定はありません。</p>'}<button id="add-record" class="button primary">＋ 学習を記録する</button></div></div>`)
 +card('week',`<div class="section-heading"><div><p class="eyebrow">WEEKLY PLAN</p><h2>今週の計画</h2></div><button id="go-today" class="button quiet">今日へ</button></div><p class="muted small">${esc(dateText(start))} — ${esc(dateText(plusDays(start,6)))}</p><div class="week-strip">${Array.from({length:7},(_,i)=>{const date=plusDays(start,i),dayTasks=tasksOn(data.project,date),p=progress(dayTasks);return `<button class="week-day ${date===selectedDate?'selected':''}" data-date="${date}" aria-pressed="${date===selectedDate}" ${date===today?'aria-current="date"':''}><span>${Number(date.slice(8))}</span><small>${'月火水木金土日'[i]}</small><span class="day-dot">${p.total&&p.completed===p.total?'✓':'○'}</span><strong>${dayTasks.reduce((sum,t)=>sum+t.minutes,0)}分</strong><small>${p.completed}/${p.total}完了</small></button>`;}).join('')}</div><div class="week-goal"><span>✧</span><p><strong>今週の目標</strong><br>短い時間でも、学びに触れる日をつくろう。</p></div>`)
 +card('stats',`<p class="eyebrow">LEARNING BALANCE</p><h2>学習のバランス</h2><div class="stats-total"><strong>${minText(summary.minutes)}</strong><span class="muted">${summary.days}日間の学び</span></div>${summary.subjects.map(subject=>`<div class="stat"><div><span>${esc(subject.name)}</span><strong>${subject.minutes}分</strong></div><progress aria-label="${esc(subject.name)}の学習時間" value="${subject.minutes}" max="${Math.max(summary.minutes,1)}"></progress></div>`).join('')}`)
 +card('recent',`<div class="section-heading"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>最近の学習</h2></div><span class="pill">${data.records.length}件</span></div><div class="recent-list">${[...data.records].sort((a,b)=>b.date.localeCompare(a.date)).map(record=>`<article class="recent-row"><time>${esc(dateText(record.date))}</time><div><strong>${esc(record.subject)}</strong>${record.note?`<p class="muted small">${esc(record.note)}</p>`:''}</div><span class="pill">${minText(record.minutes)}</span><button class="button quiet" data-edit-record="${esc(record.id)}">編集</button></article>`).join('')||'<p class="muted">まだ記録がありません。</p>'}</div>`);
 $('hidden-cards').innerHTML=Object.entries(cards).filter(([id])=>!preferences.visibility[id]).map(([id,label])=>`<button class="button quiet" data-restore="${id}">${label}を再表示 ＋</button>`).join('');
}
function renderSettings() {
 $('settings-content').innerHTML=`<fieldset><legend>表示するカード</legend>${Object.entries(cards).map(([id,label])=>`<label class="toggle-label"><span>${label}</span><input type="checkbox" role="switch" data-card="${id}" ${preferences.visibility[id]?'checked':''}></label>`).join('')}</fieldset><fieldset><legend>テーマ</legend><div class="theme-options">${Object.entries(themes).map(([id,label])=>`<label><input type="radio" name="theme" value="${id}" ${preferences.theme===id?'checked':''}><span class="theme-swatch theme-${id}"></span>${label}</label>`).join('')}</div></fieldset><fieldset><legend>アクセントカラー</legend><div class="accent-options">${Object.entries(accents).map(([id,[label,color]])=>`<label title="${label}"><input type="radio" name="accent" value="${id}" aria-label="${label}" ${preferences.accent===id?'checked':''}><span style="--swatch:${color}"></span></label>`).join('')}</div></fieldset><div class="settings-tip"><span>✦</span><p>自分らしいペースで。<br>表示する情報を選んで、<br>今日の学びに集中しよう。</p></div>`;
}
function lock(value){
 busy=value;
 for(const selector of ['#dashboard button','#dashboard input','.workspace-tools button','#switch-mode','dialog button'])for(const el of document.querySelectorAll(selector))el.disabled=value;
 if(!value){$('project-edit').disabled=!available;$('task-add').disabled=!available||!data?.project;}
}
function showError(error,form){
 const message=storageMessage(error);$('save-status').textContent=message;$('save-status').dataset.error='true';
 if(form)form.querySelector('.form-error').textContent=message;
}
async function refresh(){
 if(busy)return;lock(true);
 try{const latest=await repository.load();data=latest;available=true;if(editingKind)editRevision=data.revision;$('save-status').textContent='最新データを読み込みました。開いている入力内容はそのままです。';$('save-status').dataset.error='false';}
 catch(error){available=false;showError(error);}
 finally{render();lock(false);}
}
async function save(command,form=null){
 if(busy||!available)return false;
 lock(true);if(form)form.querySelector('.form-error').textContent='';$('save-status').textContent=demo?'デモを更新中…':'保存中…';$('save-status').dataset.error='false';
 try{
  data=await repository.mutate(command,form?editRevision:data.revision);
  if(['addTask','updateTask'].includes(command.type))selectedDate=command.input.date;
  $('save-status').textContent=demo?'デモだけを更新しました。実データは変更していません。':'ブラウザに保存しました。';
  render();return true;
 }catch(error){showError(error,form);render();return false;}
 finally{lock(false);}
}
function openEditor(kind,id=null){
 if(busy||!available)return;
 editingKind=kind;editingId=kind==='project'?(data.project?.id||null):id;editRevision=data.revision;
 const form=$(`${kind}-form`);form.reset();form.querySelector('.form-error').textContent='';form.querySelector('.latest-data')?.remove();
 form.querySelector('.mode-help').textContent=demo?'デモの操作です。実データは変更しません。':'保存先：このブラウザのIndexedDB';
 const item=kind==='project'?data.project:kind==='task'?data.project.tasks.find(t=>t.id===id):data.records.find(r=>r.id===id);
 if(kind==='project'){form.elements.name.value=item?.name||'';form.elements.goal.value=item?.goal||'';}
 else if(kind==='task'){form.elements.title.value=item?.title||'';form.elements.date.value=item?.date||selectedDate;form.elements.minutes.value=item?.minutes||25;form.elements.required.checked=item?.required!==false;}
 else {form.elements.date.value=item?.date||selectedDate;form.elements.subject.value=item?.subject||'';form.elements.minutes.value=item?.minutes||25;form.elements.note.value=item?.note||'';}
 $(`${kind}-delete`).hidden=kind==='project'?!data.project:!id;
 $(`${kind}-dialog`).showModal();
}
$('dashboard').addEventListener('change',async event=>{
 const id=event.target.dataset.task;if(!id)return;
 if(busy){render();return;}
 await save({type:'setTaskStatus',id,status:event.target.checked?'completed':'unstarted'});
 document.querySelector(`[data-task="${id}"]`)?.focus();
});
$('dashboard').addEventListener('click',event=>{
 if(busy)return;
 const day=event.target.closest('[data-date]');
 if(day){selectedDate=day.dataset.date;render();document.querySelector(`[data-date="${selectedDate}"]`)?.focus();}
 if(event.target.closest('#go-today')){selectedDate=today;render();$('go-today').focus();}
 if(event.target.closest('#add-record'))openEditor('record');
 const task=event.target.closest('[data-edit-task]');if(task)openEditor('task',task.dataset.editTask);
 const record=event.target.closest('[data-edit-record]');if(record)openEditor('record',record.dataset.editRecord);
});
$('view-date').addEventListener('change',event=>{if(!busy&&parseDate(event.target.value)){selectedDate=event.target.value;render();}});
$('project-edit').addEventListener('click',()=>openEditor('project'));
$('task-add').addEventListener('click',()=>openEditor('task'));
for(const kind of ['record','task','project']){
 const dialog=$(`${kind}-dialog`),form=$(`${kind}-form`);
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{if(!dialog.open){editingKind=null;editingId=null;editRevision=null;}});
 form.querySelector('[data-refresh]').addEventListener('click',async()=>{if(!busy&&confirm('入力を残して最新データを読み込みます。最新の内容を確認してから保存してください。')){await refresh();if(available){form.querySelector('.latest-data')?.remove();const latest=kind==='project'?data.project:kind==='task'?data.project?.tasks.find(t=>t.id===editingId):data.records.find(r=>r.id===editingId);const panel=document.createElement('pre');panel.className='latest-data';panel.textContent='現在保存されている内容：\n'+(latest?(kind==='project'?`名前：${latest.name}\n目標：${latest.goal}`:kind==='task'?`項目：${latest.title}\n予定日：${latest.date}\n時間：${latest.minutes}分\n必須：${latest.required?'はい':'いいえ'}\n進捗：${latest.status==='completed'?'完了':'未着手'}`:`内容：${latest.subject}\n日付：${latest.date}\n時間：${latest.minutes}分\nメモ：${latest.note}`):'該当するデータはありません。');form.querySelector('.form-error').before(panel);form.querySelector('.form-error').textContent='最新の保存内容と入力を比較し、必要なら入力を修正してから保存してください。';}}});
 form.querySelector('[data-close]').addEventListener('click',()=>{if(!busy)dialog.close();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();const fields=new FormData(form);
  const input=Object.fromEntries(fields);
  if(kind!=='project')input.minutes=Number(input.minutes);
  if(kind==='task')input.required=form.elements.required.checked;
  const type=kind==='project'?(editingId?'updateProject':'createProject'):(editingId?'update':'add')+(kind==='record'?'Record':'Task');
  if(await save({type,id:editingId,input},form)){dialog.close();}
 });
 $(`${kind}-delete`).addEventListener('click',async()=>{
  if(busy)return;
  const warning=kind==='project'?'このプロジェクトの計画・記録・進捗をすべて削除します。元に戻せません。削除しますか？':kind==='task'?'この計画項目と進捗を削除します。学習記録は残ります。削除しますか？':'この学習記録を削除しますか？';
  if(!confirm(warning))return;
  if(await save({type:'delete'+kind[0].toUpperCase()+kind.slice(1),id:editingId},form))dialog.close();
 });
}
$('reload-data').addEventListener('click',async()=>{
 if(editingKind&&!confirm('入力は残したまま最新データを読み込みます。保存すると入力内容を最新データへ反映します。変更を確認してから保存してください。'))return;
 await refresh();
});
$('switch-mode').addEventListener('click',async()=>{
 if(busy)return;
 demo=!demo;repository=demo?demoRepository:realRepository;data=null;available=false;
 history.replaceState(null,'',location.pathname+location.search+(demo?'#demo':''));
 await refresh();
});
$('settings').addEventListener('change',event=>{
 const input=event.target;
 if(input.dataset.card)preferences.visibility[input.dataset.card]=input.checked;
 else if(input.name==='theme')preferences.theme=input.value;
 else if(input.name==='accent')preferences.accent=input.value;
 else return;
 persistPreferences();render();
});
$('hidden-cards').addEventListener('click',event=>{
 const id=event.target.closest('[data-restore]')?.dataset.restore;if(!id)return;
 preferences.visibility[id]=true;persistPreferences();render();renderSettings();document.querySelector(`[data-card="${id}"]`)?.focus();
});
$('settings-toggle').addEventListener('click',()=>{
 const hidden=!$('settings').hidden;$('settings').hidden=hidden;$('settings-toggle').setAttribute('aria-expanded',String(!hidden));if(!hidden)$('settings').scrollIntoView({behavior:'smooth',block:'nearest'});
});
if(prefResult.error)$('settings-status').textContent='表示設定を読み込めないため、標準設定を使います。';
applyTheme();renderSettings();await refresh();
document.documentElement.dataset.ready='true';
