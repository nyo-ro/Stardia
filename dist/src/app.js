import {localDate,mondayOf,plusDays,dateText,minText} from './domain/date.js';
import {tasksOn,progress,summarize} from './domain/study.js';
import {createDemo} from './domain/demo.js';
import {createMemoryRepository} from './storage/memory.js';
import {themes,accents,cards,readPreferences,writePreferences} from './storage/preferences.js';
import {esc} from './ui/html.js';
const $=id=>document.getElementById(id);
const today=localDate();
const repository=createMemoryRepository(createDemo(today));
let storage;
try {storage=window.localStorage;} catch {storage=null;}
const prefResult=readPreferences(storage);
let preferences=prefResult.value;
let data=await repository.load();
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
 const tasks=tasksOn(data.project,selectedDate),done=progress(tasks),summary=summarize(data.records);
 const selectedRecords=data.records.filter(record=>record.date===selectedDate);
 const start=mondayOf(selectedDate);
 $('today-label').textContent=dateText(today);
 $('dashboard').innerHTML=card('today',`<div class="hero-top"><span class="eyebrow">${selectedDate===today?'TODAY':'DAILY PLAN'} / ${esc(dateText(selectedDate))}</span><span class="pill">${esc(data.project.name)}</span></div><div class="hero-body"><div><h2>今日の一歩が、<br>明日の自分につながる。</h2><p class="muted">${esc(data.project.goal)}</p><div class="hero-metrics"><div class="ring" style="--progress:${done.percent}%"><span><strong>${done.completed}<small> / ${done.total}</small></strong><small>必須タスク完了</small></span></div><div><strong class="big-number">${minText(summarize(selectedRecords).minutes)}</strong><p class="muted small">この日の学習時間</p></div></div></div><div class="task-panel"><h3>この日の学習 <span>${tasks.length}件</span></h3>${tasks.map(task=>`<label class="task ${task.status==='completed'?'done':''}"><input type="checkbox" data-task="${esc(task.id)}" ${task.status==='completed'?'checked':''}><span>${esc(task.title)}${task.required===false?'<small>任意の学習</small>':''}</span><time>${minText(task.minutes)}</time></label>`).join('')||'<p class="muted">この日の予定はありません。</p>'}<button id="add-record" class="button primary">＋ 学習を記録する</button></div></div>`)
 +card('week',`<div class="section-heading"><div><p class="eyebrow">WEEKLY PLAN</p><h2>今週の計画</h2></div><button id="go-today" class="button quiet">今日へ</button></div><p class="muted small">${esc(dateText(start))} — ${esc(dateText(plusDays(start,6)))}</p><div class="week-strip">${Array.from({length:7},(_,i)=>{const date=plusDays(start,i),dayTasks=tasksOn(data.project,date),p=progress(dayTasks);return `<button class="week-day ${date===selectedDate?'selected':''}" data-date="${date}" aria-pressed="${date===selectedDate}" ${date===today?'aria-current="date"':''}><span>${Number(date.slice(8))}</span><small>${'月火水木金土日'[i]}</small><span class="day-dot">${p.total&&p.completed===p.total?'✓':'○'}</span><strong>${dayTasks.reduce((sum,t)=>sum+t.minutes,0)}分</strong><small>${p.completed}/${p.total}完了</small></button>`;}).join('')}</div><div class="week-goal"><span>✧</span><p><strong>今週の目標</strong><br>短い時間でも、学びに触れる日をつくろう。</p></div>`)
 +card('stats',`<p class="eyebrow">LEARNING BALANCE</p><h2>学習のバランス</h2><div class="stats-total"><strong>${minText(summary.minutes)}</strong><span class="muted">${summary.days}日間の学び</span></div>${summary.subjects.map(subject=>`<div class="stat"><div><span>${esc(subject.name)}</span><strong>${subject.minutes}分</strong></div><progress aria-label="${esc(subject.name)}の学習時間" value="${subject.minutes}" max="${Math.max(summary.minutes,1)}"></progress></div>`).join('')}`)
 +card('recent',`<div class="section-heading"><div><p class="eyebrow">RECENT ACTIVITY</p><h2>最近の学習</h2></div><span class="pill">直近5件</span></div><div class="recent-list">${[...data.records].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(record=>`<article class="recent-row"><time>${esc(dateText(record.date))}</time><div><strong>${esc(record.subject)}</strong>${record.note?`<p class="muted small">${esc(record.note)}</p>`:''}</div><span class="pill">${minText(record.minutes)}</span></article>`).join('')||'<p class="muted">まだ記録がありません。</p>'}</div>`);
 $('hidden-cards').innerHTML=Object.entries(cards).filter(([id])=>!preferences.visibility[id]).map(([id,label])=>`<button class="button quiet" data-restore="${id}">${label}を再表示 ＋</button>`).join('');
}
function renderSettings() {
 $('settings-content').innerHTML=`<fieldset><legend>表示するカード</legend>${Object.entries(cards).map(([id,label])=>`<label class="toggle-label"><span>${label}</span><input type="checkbox" role="switch" data-card="${id}" ${preferences.visibility[id]?'checked':''}></label>`).join('')}</fieldset><fieldset><legend>テーマ</legend><div class="theme-options">${Object.entries(themes).map(([id,label])=>`<label><input type="radio" name="theme" value="${id}" ${preferences.theme===id?'checked':''}><span class="theme-swatch theme-${id}"></span>${label}</label>`).join('')}</div></fieldset><fieldset><legend>アクセントカラー</legend><div class="accent-options">${Object.entries(accents).map(([id,[label,color]])=>`<label title="${label}"><input type="radio" name="accent" value="${id}" aria-label="${label}" ${preferences.accent===id?'checked':''}><span style="--swatch:${color}"></span></label>`).join('')}</div></fieldset><div class="settings-tip"><span>✦</span><p>自分らしいペースで。<br>表示する情報を選んで、<br>今日の学びに集中しよう。</p></div>`;
}
$('dashboard').addEventListener('change',async event=>{
 const id=event.target.dataset.task;if(!id)return;
 try {await repository.setTaskStatus(id,event.target.checked?'completed':'unstarted');data=await repository.load();render();document.querySelector(`[data-task="${id}"]`)?.focus();$('notice').textContent='進捗を更新しました（再読み込みでリセット）。';} catch(error){$('notice').textContent=error.message;}
});
$('dashboard').addEventListener('click',event=>{
 const day=event.target.closest('[data-date]');
 if(day){selectedDate=day.dataset.date;render();document.querySelector(`[data-date="${selectedDate}"]`)?.focus();}
 if(event.target.closest('#go-today')){selectedDate=today;render();$('go-today').focus();}
 if(event.target.closest('#add-record')){$('record-form').reset();$('record-date').value=selectedDate;$('form-error').textContent='';$('record-dialog').showModal();}
});
$('close-dialog').addEventListener('click',()=>$('record-dialog').close());
$('record-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=new FormData(event.target);
 const button=event.target.querySelector('[type=submit]');button.disabled=true;
 try {await repository.addRecord({date:form.get('date'),subject:form.get('subject'),minutes:Number(form.get('minutes')),note:form.get('note')});data=await repository.load();$('record-dialog').close();render();$('add-record').focus();$('notice').textContent='体験用の記録を追加しました。再読み込みするとリセットされます。';}
 catch(error){$('form-error').textContent=error.message;}finally{button.disabled=false;}
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
applyTheme();renderSettings();render();
document.documentElement.dataset.ready='true';
