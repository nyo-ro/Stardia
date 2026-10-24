import {validateRecord} from '../domain/study.js';
// Async repository boundary; replace with IndexedDB in v0.0.2.
export function createMemoryRepository(initial) {
  let data = structuredClone(initial);
  return {
    async load() { return structuredClone(data); },
    async setTaskStatus(id,status) {
      if (!['unstarted','completed'].includes(status)) throw new Error('未対応の進捗です。');
      const task=data.project.tasks.find(task=>task.id===id);
      if (!task) throw new Error('学習項目が見つかりません。');
      task.status=status;
    },
    async addRecord(input) {
      const record=validateRecord(input,data.project.id);
      const id=globalThis.crypto.randomUUID();
      data.records.push({...record,id});
      return id;
    }
  };
}
