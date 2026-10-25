import {captureUI} from './ui-capture.mjs';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,rm,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
const [chrome,url,profile,width,height,output,mode='test']=process.argv.slice(2);
await mkdir(profile,{recursive:true});
await mkdir(path.dirname(output),{recursive:true});
await rm(path.join(profile,'DevToolsActivePort'),{force:true});
const child=spawn(chrome,['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket,nextId=1;const pending=new Map(),errors=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const command=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const exit=new Promise(resolve=>child.on('exit',resolve));
try {
 let port;
 for(let i=0;i<100;i++){try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(port)break;}catch{}await pause(100);}
 if(!port)throw Error('Chrome debugging port did not start');
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const callback=pending.get(message.id);pending.delete(message.id);if(message.error)callback.reject(Error(JSON.stringify(message.error)));else callback.resolve(message.result);}if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);});
 const downloadDir=output+'-downloads-'+Date.now();
 if(mode==='export'){await mkdir(downloadDir,{recursive:true});await command('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(downloadDir)});}
 await command('Page.enable');await command('Runtime.enable');
 await command('Emulation.setDeviceMetricsOverride',{width:Number(width),height:Number(height),deviceScaleFactor:1,mobile:false});
 await command('Page.navigate',{url});
 let done=false;
 for(let i=0;i<500;i++){
  const {result}=await command('Runtime.evaluate',{expression:!['preview','capture'].includes(mode)?"document.getElementById('result')?.dataset.result":"document.documentElement.dataset.ready",returnByValue:true});
  if(result.value==='failed')break;
  if(result.value===(!['preview','capture'].includes(mode)?'passed':'true')){done=true;break;}
  if(errors.length)break;
  await pause(100);
 }
 const dom=await command('Runtime.evaluate',{expression:'document.documentElement.outerHTML',returnByValue:true});
 await writeFile(output+'.html',dom.result.value||'');
 if(!done){const debug=await command('Runtime.evaluate',{expression:`[...document.querySelectorAll('iframe')].map(f=>({view:f.contentDocument?.documentElement.dataset.view,status:f.contentDocument?.querySelector('#save-status')?.textContent,dialogs:[...f.contentDocument.querySelectorAll('dialog[open]')].map(d=>({id:d.id,error:d.querySelector('.form-error')?.textContent})),tasks:[...f.contentDocument.querySelectorAll('[data-task]')].map(e=>({id:e.dataset.task,checked:e.checked,disabled:e.disabled}))}))`,returnByValue:true});throw Error(JSON.stringify(errors)+'\n'+(dom.result.value||'').slice(0,2500)+'\n'+JSON.stringify(debug.result.value));}
 if(mode==='preview'){const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(output+'.png',Buffer.from(shot.data,'base64'));}
 if(mode==='capture')await captureUI(command,output);
 if(mode==='export'){
  let file;for(let i=0;i<100;i++){file=(await readdir(downloadDir)).find(f=>f.endsWith('.json'));if(file)break;await pause(100);}if(!file)throw Error('JSON download missing');
  const actual=JSON.parse(await readFile(path.join(downloadDir,file),'utf8'));
  const expected=await command('Runtime.evaluate',{expression:'window.exportExpected',returnByValue:true});
  const semantic=x=>JSON.stringify({projects:x.projects,uiPreferences:x.uiPreferences});
  if(semantic(actual)!==semantic(expected.result.value))throw Error('Downloaded backup differs');
  await copyFile(path.join(downloadDir,file),path.join(path.dirname(output),'transfer.json'));
 }
 console.log('PASS '+url);
}finally{
 if(socket?.readyState===1){await command('Browser.close').catch(()=>{});socket.close();}
 await Promise.race([exit,pause(4000)]);if(child.exitCode===null){child.kill();await exit;}
}
