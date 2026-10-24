import {parseDate} from './date.js';
import {validateRecord} from './study.js';
export class ConflictError extends Error {
  constructor(){super('別のタブでデータが更新されました。入力は残っています。「最新データを確認」で変更を確認し、必要ならもう一度保存してください。');this.name='ConflictError';}
}
export function emptySnapshot(projectId){return {schemaVersion:1,projectId,revision:0,project:null,records:[]};}
export function checkSnapshot(data,projectId){
  if(!data || data.schemaVersion!==1 || data.projectId!==projectId || !Number.isSafeInteger(data.revision) || data.revision<0 || !Array.isArray(data.records) || (data.project!==null && (data.project.id!==projectId || !Array.isArray(data.project.tasks)))) throw new Error('保存形式が未対応または不正です。自動初期化は行いません。');
  return data;
}
function text(value,label,max){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`${label}は1〜${max}文字で入力してください。`);return value.trim();}
function taskInput(input){
  if(!parseDate(input.date))throw new Error('予定日が不正です。');
  if(!Number.isInteger(input.minutes)||input.minutes<1||input.minutes>1440)throw new Error('予定時間は1〜1440分の整数にしてください。');
  if(typeof input.required!=='boolean')throw new Error('必須設定が不正です。');
  return {title:text(input.title,'項目名',100),date:input.date,minutes:input.minutes,required:input.required};
}
export function applyCommand(current,command,expectedRevision){
  checkSnapshot(current,current.projectId);
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==current.revision)throw new ConflictError();
  const next=structuredClone(current),input=command.input;
  if(command.type==='createProject'){
    if(next.project)throw new Error('既存プロジェクトは上書きできません。');
    if(typeof input.goal!=='string'||input.goal.length>300)throw new Error('目標は300文字以内にしてください。');
    next.project={id:next.projectId,name:text(input.name,'名前',100),goal:input.goal,tasks:[]};
  }else{
    if(!next.project)throw new Error('先にプロジェクトを作成してください。');
    const tasks=next.project.tasks;
    switch(command.type){
      case 'updateProject': next.project.name=text(input.name,'名前',100);if(typeof input.goal!=='string'||input.goal.length>300)throw new Error('目標は300文字以内にしてください。');next.project.goal=input.goal;break;
      case 'deleteProject': next.project=null;next.records=[];break;
      case 'addTask': tasks.push({...taskInput(input),id:crypto.randomUUID(),status:'unstarted'});break;
      case 'updateTask': {const task=tasks.find(t=>t.id===command.id);if(!task)throw new Error('項目が見つかりません。');Object.assign(task,taskInput(input));break;}
      case 'deleteTask': {const i=tasks.findIndex(t=>t.id===command.id);if(i<0)throw new Error('項目が見つかりません。');tasks.splice(i,1);break;}
      case 'setTaskStatus': {const task=tasks.find(t=>t.id===command.id);if(!task)throw new Error('項目が見つかりません。');if(!['unstarted','completed'].includes(command.status))throw new Error('進捗が不正です。');task.status=command.status;break;}
      case 'addRecord': next.records.push({...validateRecord(input,next.projectId),id:crypto.randomUUID()});break;
      case 'updateRecord': {const record=next.records.find(x=>x.id===command.id);if(!record)throw new Error('記録が見つかりません。');Object.assign(record,validateRecord(input,next.projectId));break;}
      case 'deleteRecord': {const i=next.records.findIndex(x=>x.id===command.id);if(i<0)throw new Error('記録が見つかりません。');next.records.splice(i,1);break;}
      default: throw new Error('未対応の操作です。');
    }
  }
  next.revision++;
  return next;
}
