import {applyCommand} from '../domain/commands.js';
// Demo-only repository. Never reads from or writes to IndexedDB.
export function createMemoryRepository(initial){
  let data={...structuredClone(initial),projectId:initial.project.id,revision:initial.revision||0};
  const repo={
    async load(){return structuredClone(data);},
    async mutate(command,expectedRevision){data=applyCommand(data,command,expectedRevision);return structuredClone(data);},
    async close(){}
  };
  // v0.0.1 test/API compatibility; persistent writers must use explicit revisions.
  repo.setTaskStatus=(id,status)=>repo.mutate({type:'setTaskStatus',id,status},data.revision);
  repo.addRecord=async input=>{const result=await repo.mutate({type:'addRecord',input},data.revision);return result.records.at(-1).id;};
  return repo;
}
