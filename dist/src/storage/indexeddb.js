import {emptySnapshot,checkSnapshot,applyCommand} from '../domain/commands.js';
export const DB_NAME='stardia.learning.v1';
const STORE='projects';
// One aggregate per project: revision check and all changes share ONE transaction.
// No automatic data writes during open/load, and no fallback to memory on failure.
export function createIndexedDBRepository({projectId='default',dbName=DB_NAME,factory=globalThis.indexedDB}={}){
  let connection;
  function open(){
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      let request,settled=false;
      const fail=error=>{settled=true;reject(error);};
      try {request=factory.open(dbName,1);}catch(error){fail(error);return;}
      request.onupgradeneeded=()=>{try{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'projectId'});}catch(error){fail(error);try{request.transaction?.abort();}catch{/* Already aborted. */}}};
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
      try {tx=db.transaction(STORE,command?'readwrite':'readonly');}catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(structuredClone(result));
      tx.onabort=()=>reject(failure||tx.error||new Error('保存が中断されました。変更は保存されていません。'));
      tx.onerror=()=>{}; // request failures bubble and abort the entire transaction
      const store=tx.objectStore(STORE),request=store.get(projectId);
      request.onsuccess=()=>{
        try{
          const current=request.result===undefined?emptySnapshot(projectId):checkSnapshot(request.result,projectId);
          result=command?applyCommand(current,command,expectedRevision):current;
          if(command)store.put(result);
        }catch(error){failure=error;tx.abort();}
      };
    });
  }
  return {
    load:()=>transaction(),
    mutate:(command,expectedRevision)=>transaction(command,expectedRevision),
    async close(){if(connection){const db=await connection;db.close();connection=undefined;}}
  };
}
export function storageMessage(error){
  if(error?.name==='ConflictError')return error.message;
  if(error?.name==='QuotaExceededError')return '保存容量が不足しています。変更は保存されていません。入力を控えてからブラウザの保存容量を確認してください。';
  return `保存領域にアクセスできないか、処理に失敗しました。変更は保存されていません。入力は保持しています。${error?.message||''}`;
}
