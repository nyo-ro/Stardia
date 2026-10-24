import {STORAGE_KEY} from '../dist/src/storage/preferences.js';
const result=document.getElementById('result');
const assert=(value,message)=>{if(!value)throw Error(message);};
const wait=()=>new Promise(resolve=>setTimeout(resolve,80));
async function ready(frame){for(let i=0;i<50;i++){if(frame.contentDocument?.documentElement.dataset.ready==='true')return;await wait();}throw Error('Application did not become ready');}
try {
 localStorage.removeItem(STORAGE_KEY);
 const frame=document.createElement('iframe');frame.style.width=new URLSearchParams(location.search).get('width')+'px';frame.src='../dist/';document.body.append(frame);await ready(frame);
 let doc=frame.contentDocument;
 assert(doc.querySelector('h1').textContent==='学びのダッシュボード','Japanese UI preserved');
 assert(frame.contentWindow.innerWidth===Number(new URLSearchParams(location.search).get('width')),'requested viewport width');
 assert(doc.querySelectorAll('.card').length===4,'four cards');
 assert(doc.documentElement.scrollWidth<=frame.contentWindow.innerWidth,'no horizontal overflow');
 const checkbox=doc.querySelector('[data-task]');const id=checkbox.dataset.task;checkbox.click();await wait();
 assert(doc.querySelector(`[data-task="${id}"]`).checked,'task toggle');
 doc.querySelector('#add-record').click();
 const form=doc.querySelector('#record-form');form.elements.subject.value='<img src=x onerror=alert(1)>';form.elements.minutes.value='17';form.elements.note.value='架空テスト';form.requestSubmit();await wait();
 assert(!doc.querySelector('#record-dialog').open,'dialog closes');assert(doc.querySelector('.recent-list').textContent.includes('<img src=x'),'record added as text');assert(!doc.querySelector('.recent-list img'),'HTML escaped');
 doc.querySelector('[name=theme][value=dark]').click();await wait();assert(doc.documentElement.dataset.theme==='dark','dark theme');
 doc.querySelector('[data-card=stats]').click();await wait();assert(doc.querySelector('#card-stats').hidden,'hide stats');
 doc.querySelector('[data-restore=stats]').click();await wait();assert(!doc.querySelector('#card-stats').hidden,'restore stats');
 frame.contentWindow.location.reload();await wait();await ready(frame);doc=frame.contentDocument;
 assert(doc.documentElement.dataset.theme==='dark','theme persists');assert(!doc.querySelector('.recent-list').textContent.includes('<img src=x'),'learning data resets as advertised');
 doc.querySelector('#settings-toggle').click();assert(doc.querySelector('#settings').hidden,'settings collapsed');
 result.textContent='PASS: browser interaction, persistence boundary, escaped record, responsive width';result.dataset.result='passed';
} catch(error){result.textContent='FAIL: '+error.stack;result.dataset.result='failed';}
