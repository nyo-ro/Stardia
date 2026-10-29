import {validateRecord} from './study.js';
import {emptySnapshot,normalizeSnapshot,text} from './model.js';
export {emptySnapshot};
export const checkSnapshot=normalizeSnapshot;
export class ConflictError extends Error {
 constructor(){super('別のタブでデータが更新されました。入力は残っています。「最新データを確認」で変更を確認し、必要ならもう一度保存してください。');this.name='ConflictError';}
}
function projectInput(input,current={}){return {name:text(input.name,'名前',100).trim(),description:input.description??current.description??'',goal:input.goal,startDate:input.startDate===undefined?(current.startDate??null):(input.startDate||null),targetDate:input.targetDate===undefined?(current.targetDate??null):(input.targetDate||null)};}
export function applyCommand(current,command,expectedRevision){
 current=normalizeSnapshot(current,current.projectId);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==current.revision)throw new ConflictError();
 const next=structuredClone(current),input=command.input||{};
 if(command.type==='createProject'){
  if(next.project)throw new Error('既存プロジェクトは上書きできません。');
  next.project={id:next.projectId,...projectInput(input),items:[],schedules:[]};
 }else{
  if(!next.project)throw new Error('先にプロジェクトを作成してください。');
  const p=next.project;
  const item=id=>{const found=p.items.find(x=>x.id===id);if(!found)throw new Error('学習項目が見つかりません。');return found;};
  const plan=id=>{const found=p.schedules.find(x=>x.id===id);if(!found)throw new Error('予定が見つかりません。');return found;};
  const active=x=>{if(x.archived)throw new Error('削除済みの項目・予定は変更できません。');return x;};
  const scheduleInput=(value,existing)=>{
   active(item(value.itemId));
   if(existing&&existing.itemId!==value.itemId&&next.records.some(r=>r.scheduleId===existing.id))throw new Error('実績がある予定の学習項目は変更できません。別の予定を作成してください。');
   return {itemId:value.itemId,date:value.date,minutes:value.minutes,required:value.required};
  };
  switch(command.type){
   case 'updateProject':Object.assign(p,projectInput(input,p));break;
   case 'deleteProject':next.project=null;next.records=[];break;
   case 'addItem':p.items.push({id:crypto.randomUUID(),title:text(input.title,'項目名',100).trim(),description:input.description??'',archived:false});break;
   case 'updateItem':Object.assign(active(item(command.id)),{title:text(input.title,'項目名',100).trim(),description:input.description??''});break;
   case 'deleteItem':active(item(command.id)).archived=true;for(const s of p.schedules)if(s.itemId===command.id)s.archived=true;break;
   case 'restoreItem':{const i=item(command.id);if(!i.archived)throw new Error('この学習項目は既に有効です。');i.archived=false;break;}
   case 'restoreSchedule':{const s=plan(command.id);if(!s.archived)throw new Error('この予定は既に有効です。');if(item(s.itemId).archived)throw new Error('先に関連する学習項目を復帰してください。');s.archived=false;break;}
   case 'addSchedule':p.schedules.push({id:crypto.randomUUID(),...scheduleInput(input),status:'unstarted',archived:false});break;
   case 'updateSchedule':{const s=active(plan(command.id));Object.assign(s,scheduleInput(input,s));break;}
   case 'deleteSchedule':case 'deleteTask':active(plan(command.id)).archived=true;break;
   case 'setTaskStatus':case 'setScheduleStatus':{const s=active(plan(command.id));s.status=command.status;break;}
   // Compatibility commands used by the pre-v0.0.4 regression fixtures only.
   case 'addTask':{const id=crypto.randomUUID();p.items.push({id,title:input.title,description:'',archived:false});p.schedules.push({id,itemId:id,date:input.date,minutes:input.minutes,required:input.required,status:'unstarted',archived:false});break;}
   case 'updateTask':{const s=active(plan(command.id));active(item(s.itemId)).title=input.title;Object.assign(s,{date:input.date,minutes:input.minutes,required:input.required});break;}
   case 'addRecord':case 'updateRecord':{
    const old=command.type==='updateRecord'?next.records.find(r=>r.id===command.id):null;
    if(command.type==='updateRecord'&&!old)throw new Error('記録が見つかりません。');
    const itemId=input.itemId===undefined?(old?.itemId??null):(input.itemId||null),scheduleId=input.scheduleId===undefined?(old?.scheduleId??null):(input.scheduleId||null);
    if(itemId){const i=item(itemId);if(i.archived&&old?.itemId!==itemId)throw new Error('削除済みの項目には新しい記録を追加できません。');}
    if(scheduleId){const s=plan(scheduleId);if(s.itemId!==itemId)throw new Error('予定と学習項目が一致しません。');if(s.archived&&old?.scheduleId!==scheduleId)throw new Error('削除済みの予定には新しい記録を追加できません。');}
    const record={...validateRecord(input,next.projectId),itemId,scheduleId};
    if(old)Object.assign(old,record);else next.records.push({...record,id:crypto.randomUUID()});
    if(input.completeSchedule){if(!scheduleId)throw new Error('完了にする予定を選んでください。');active(plan(scheduleId)).status='completed';}
    break;
   }
   case 'deleteRecord':{const i=next.records.findIndex(r=>r.id===command.id);if(i<0)throw new Error('記録が見つかりません。');next.records.splice(i,1);break;}
   default:throw new Error('未対応の操作です。');
  }
 }
 next.revision++;return normalizeSnapshot(next,next.projectId);
}
