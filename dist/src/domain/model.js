import {parseDate} from './date.js';
import {validateBackup as validateLegacyBackup} from './legacy-backup.js';
import {normalizePreferences} from '../storage/preferences.js';
export function fields(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(value,k)))throw new Error('保存形式の項目が不足しているか、未対応の項目があります。');}
export function text(value,label,max,empty=false){if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))throw new Error(`${label}は${empty?'0':'1'}〜${max}文字で入力してください。`);return value;}
export function identifier(id){if(typeof id!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id))throw new Error('IDの形式が不正です。');}
function unique(list){const result=new Map();for(const entry of list){identifier(entry.id);if(result.has(entry.id))throw new Error('IDが重複しています。');result.set(entry.id,entry);}return result;}
export function optionalDate(value){if(value!==null&&!parseDate(value))throw new Error('日付を確認してください。');}
export function validateProjectData(value){
 fields(value,['projectId','project','records']);identifier(value.projectId);
 if(!Array.isArray(value.records)||value.records.length>100000)throw new Error('記録一覧が不正です。');
 const p=value.project;
 if(p===null){if(value.records.length)throw new Error('プロジェクトのない記録があります。');return value;}
 fields(p,['id','name','description','goal','startDate','targetDate','items','schedules']);if(p.id!==value.projectId)throw new Error('プロジェクト参照が不正です。');
 text(p.name,'名前',100);text(p.description,'説明',1000,true);text(p.goal,'目標',300,true);optionalDate(p.startDate);optionalDate(p.targetDate);if(p.startDate&&p.targetDate&&p.startDate>p.targetDate)throw new Error('目標日は開始日以降にしてください。');
 if(!Array.isArray(p.items)||!Array.isArray(p.schedules)||p.items.length>100000||p.schedules.length>100000)throw new Error('学習項目・予定の一覧が不正です。');
 const items=unique(p.items),schedules=unique(p.schedules);unique(value.records);
 for(const item of p.items){fields(item,['id','title','description','archived']);text(item.title,'項目名',100);text(item.description,'説明',1000,true);if(typeof item.archived!=='boolean')throw new Error('項目の状態が不正です。');}
 for(const plan of p.schedules){fields(plan,['id','itemId','date','minutes','required','status','archived']);if(!items.has(plan.itemId))throw new Error('予定の学習項目が見つかりません。');if(!parseDate(plan.date)||!Number.isInteger(plan.minutes)||plan.minutes<1||plan.minutes>1440)throw new Error('予定日・予定時間が不正です。');if(typeof plan.required!=='boolean'||typeof plan.archived!=='boolean'||!['unstarted','completed'].includes(plan.status))throw new Error('予定の状態が不正です。');if(items.get(plan.itemId).archived&&!plan.archived)throw new Error('削除済みの項目に有効な予定があります。');}
 for(const record of value.records){
  fields(record,['id','projectId','date','subject','minutes','note','itemId','scheduleId']);
  if(record.projectId!==value.projectId||!parseDate(record.date)||!Number.isInteger(record.minutes)||record.minutes<1||record.minutes>1440)throw new Error('記録の日付・時間・参照が不正です。');text(record.subject,'学習内容',100);text(record.note,'メモ',1000,true);
  if(record.itemId!==null&&!items.has(record.itemId))throw new Error('記録の学習項目が見つかりません。');
  if(record.scheduleId!==null&&(!schedules.has(record.scheduleId)||schedules.get(record.scheduleId).itemId!==record.itemId))throw new Error('記録の予定参照が一致しません。');
 }
 return value;
}
export function migrateProjectV1(value){
 validateLegacyBackup({type:'stardia_backup',schemaVersion:1,createdAt:'1970-01-01T00:00:00.000Z',projects:[value],uiPreferences:normalizePreferences(null)});
 const result=structuredClone(value),p=result.project;
 if(p){result.project={id:p.id,name:p.name,description:'',goal:p.goal,startDate:null,targetDate:null,items:p.tasks.map(t=>({id:t.id,title:t.title,description:'',archived:false})),schedules:p.tasks.map(({title,...t})=>({...t,itemId:t.id,archived:false}))};}
 result.records=result.records.map(record=>({...record,itemId:null,scheduleId:null}));
 validateProjectData(result);
 // Verify the conversion before any caller is allowed to persist it.
 if(value.project){
  const old=value.project,next=result.project;
  if(old.name!==next.name||old.goal!==next.goal||old.tasks.length!==next.items.length||old.tasks.length!==next.schedules.length)throw new Error('移行後の件数・プロジェクト情報が一致しません。');
  const itemMap=new Map(next.items.map(i=>[i.id,i])),planMap=new Map(next.schedules.map(s=>[s.id,s]));
  for(const task of old.tasks){const item=itemMap.get(task.id),plan=planMap.get(task.id);if(!item||!plan||item.title!==task.title||plan.itemId!==item.id||['date','minutes','required','status'].some(key=>plan[key]!==task[key]))throw new Error('移行後の予定・進捗が一致しません。');}
 }
 if(result.records.length!==value.records.length||result.records.some((record,index)=>Object.keys(value.records[index]).some(key=>record[key]!==value.records[index][key])))throw new Error('移行後の記録が一致しません。');
 return result;
}
export function emptySnapshot(projectId){return {schemaVersion:2,projectId,revision:0,project:null,records:[]};}
export function normalizeSnapshot(data,projectId){
 fields(data,['schemaVersion','projectId','revision','project','records']);
 if(data.projectId!==projectId||!Number.isSafeInteger(data.revision)||data.revision<0)throw new Error('保存データの識別子・更新番号が不正です。');
 const content={projectId:data.projectId,project:data.project,records:data.records};
 if(data.schemaVersion===1)return {...data,...migrateProjectV1(content),schemaVersion:2};
 if(data.schemaVersion!==2)throw new Error('未対応の保存形式です。データは初期化しません。');
 validateProjectData(content);return data;
}
