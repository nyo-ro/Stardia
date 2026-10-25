import {buildBackup,validateBackup,validatePreferences} from '../domain/backup.js';
import {normalizePreferences} from './preferences.js';
import {emptySnapshot,checkSnapshot,applyCommand,ConflictError} from '../domain/commands.js';
export const DB_NAME='stardia.learning.v1';
const STORE='projects',META='metadata';
const defaultMeta=()=>({key:'workspace',revision:0,preferencesRevision:0,preferences:normalizePreferences(null)});
// One aggregate per project: revision check and all changes share ONE transaction.
// No automatic data writes during open/load, and no fallback to memory on failure.
export function createIndexedDBRepository({projectId='default',dbName=DB_NAME,factory=globalThis.indexedDB}={}){
  let connection;
  function open(){
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      let request,settled=false;
      const fail=error=>{settled=true;reject(error);};
      try {request=factory.open(dbName,2);}catch(error){fail(error);return;}
      request.onupgradeneeded=()=>{try{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'projectId'});if(!request.result.objectStoreNames.contains(META))request.result.createObjectStore(META,{keyPath:'key'});}catch(error){fail(error);try{request.transaction?.abort();}catch{/* Already aborted. */}}};
      request.onblocked=()=>fail(new Error('別のタブがデータベースの更新を妨げています。他のStardiaタブを閉じて再読み込みしてください。'));
      request.onerror=()=>fail(request.error);
      request.onsuccess=()=>{
        const db=request.result;
        if(settled){db.close();return;}
        db.onversionchange=()=>db.close();
        resolve(db);
      };
    });
    connection.catch(()=>{connection=undefined;});
    return connection;
  }
  async function transaction(command,expectedRevision){
    const db=await open();
    return new Promise((resolve,reject)=>{
      let tx,result,failure;
      try {tx=db.transaction(command?[STORE,META]:STORE,command?'readwrite':'readonly');}catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(structuredClone(result));
      tx.onabort=()=>reject(failure||tx.error||new Error('保存が中断されました。変更は保存されていません。'));
      tx.onerror=()=>{}; // request failures bubble and abort the entire transaction
      const store=tx.objectStore(STORE),request=store.get(projectId);
      request.onsuccess=()=>{
        try{
          const current=request.result===undefined?emptySnapshot(projectId):checkSnapshot(request.result,projectId);
          result=command?applyCommand(current,command,expectedRevision):current;
          if(command){store.put(result);const metaStore=tx.objectStore(META),q=metaStore.get('workspace');q.onsuccess=()=>{try{const meta=q.result||defaultMeta();meta.revision++;metaStore.put(meta);}catch(error){failure=error;try{tx.abort();}catch{}}};}
        }catch(error){failure=error;try{tx.abort();}catch{}}
      };
    });
  }
  async function workspace(action,argument,expected){
    const db=await open();
    return new Promise((resolve,reject)=>{
      let tx,result,failure;
      try{tx=db.transaction([STORE,META],action==='export'?'readonly':'readwrite');}catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(structuredClone(result));
      tx.onabort=()=>reject(failure||tx.error||new Error('処理が中断されました。元のデータは保持しています。'));
      const store=tx.objectStore(STORE),metaStore=tx.objectStore(META);
      const pq=store.getAll(),mq=metaStore.get('workspace');let pending=2;
      const loaded=()=>{if(--pending)return;try{
        const projects=pq.result,meta=mq.result||defaultMeta();
        for(const p of projects)checkSnapshot(p,p.projectId);
        if(action==='initialize'){
          if(!mq.result){meta.preferences=normalizePreferences(argument);meta.revision++;metaStore.put(meta);}
          result=meta;return;
        }
        if(action==='settings'){
          if(expected!==meta.preferencesRevision)throw new ConflictError();
          validatePreferences(argument);meta.preferences=structuredClone(argument);meta.preferencesRevision++;meta.revision++;metaStore.put(meta);result=meta;return;
        }
        if(action==='export'){result={backup:buildBackup(projects,meta.preferences),revision:meta.revision,preferencesRevision:meta.preferencesRevision};return;}
        if(action==='restore'){
          if(expected!==meta.revision)throw new ConflictError();
          const backup=validateBackup(argument),incoming=new Map(backup.projects.map(p=>[p.projectId,p]));
          const existing=new Map(projects.map(p=>[p.projectId,p]));
          // Keep tombstones for removed projects so old tabs never regain revision 0.
          for(const key of new Set(['default',...existing.keys(),...incoming.keys()])){
            const source=incoming.get(key);
            const next={...emptySnapshot(key),...(source?structuredClone(source):{}),revision:(existing.get(key)?.revision||0)+1};
            store.put(next);
          }
          meta.preferences=structuredClone(backup.uiPreferences);meta.preferencesRevision++;meta.revision++;metaStore.put(meta);
          result={data:{...emptySnapshot(projectId),...(incoming.get(projectId)||{}),revision:(existing.get(projectId)?.revision||0)+1},meta};return;
        }
        throw new Error('未対応の保存操作です。');
      }catch(error){failure=error;try{tx.abort();}catch{}}};
      pq.onsuccess=loaded;mq.onsuccess=loaded;
    });
  }
  return {
    load:()=>transaction(),
    mutate:(command,expectedRevision)=>transaction(command,expectedRevision),
    initializePreferences:seed=>workspace('initialize',seed),
    savePreferences:(value,revision)=>workspace('settings',value,revision),
    exportBackup:()=>workspace('export'),
    restoreBackup:(backup,revision)=>workspace('restore',structuredClone(validateBackup(backup)),revision),
    async close(){if(connection){const db=await connection;db.close();connection=undefined;}}
  };
}
export function storageMessage(error){
  if(error?.name==='ConflictError')return error.message;
  if(error?.name==='QuotaExceededError')return '保存容量が不足しています。変更は保存されていません。入力を控えてからブラウザの保存容量を確認してください。';
  return `処理に失敗しました。変更は保存されていません。${error?.message||''}`;
}
