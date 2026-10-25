import {parseDate} from './date.js';
import {themes,accents,cards} from '../storage/preferences.js';
export const MAX_BACKUP_BYTES=10*1024*1024;
function fail(message){throw new Error('バックアップが不正です：'+message);}
function object(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(value,k)))fail('項目が不足しているか、未対応の項目があります。');}
function str(v,max,empty=false){if(typeof v!=='string'||v.length>max||(!empty&&!v.trim()))fail('文字列の長さまたは内容を確認してください。');}
function id(v){if(typeof v!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v))fail('IDの形式が不正です。');}
function unique(v,seen){id(v);if(seen.has(v))fail('IDが重複しています。');seen.add(v);}
function minutes(v){if(!Number.isInteger(v)||v<1||v>1440)fail('時間は1〜1440分の整数が必要です。');}
export function validatePreferences(p){object(p,['version','theme','accent','visibility']);if(p.version!==1||!Object.hasOwn(themes,p.theme)||!Object.hasOwn(accents,p.accent))fail('表示設定の形式が未対応です。');object(p.visibility,Object.keys(cards));if(Object.values(p.visibility).some(x=>typeof x!=='boolean'))fail('カードの表示設定が不正です。');return p;}
export function validateBackup(value){
 object(value,['type','schemaVersion','createdAt','projects','uiPreferences']);
 if(value.type!=='stardia_backup'||value.schemaVersion!==1)fail('未対応の形式・バージョンです。');
 if(typeof value.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)||!Number.isFinite(Date.parse(value.createdAt))||new Date(value.createdAt).toISOString()!==value.createdAt)fail('作成日時が不正です。');
 validatePreferences(value.uiPreferences);
 if(!Array.isArray(value.projects)||value.projects.length>1000)fail('プロジェクト一覧が不正です。');
 const projectIds=new Set(),taskIds=new Set(),recordIds=new Set();
 for(const item of value.projects){
  object(item,['projectId','project','records']);unique(item.projectId,projectIds);
  if(!Array.isArray(item.records))fail('記録一覧が不正です。');
  if(item.project===null){if(item.records.length)fail('プロジェクトのない記録があります。');continue;}
  const p=item.project;object(p,['id','name','goal','tasks']);id(p.id);if(p.id!==item.projectId)fail('プロジェクトの参照が一致しません。');str(p.name,100);str(p.goal,300,true);
  if(!Array.isArray(p.tasks)||p.tasks.length>100000||item.records.length>100000)fail('項目数が上限を超えています。');
  for(const task of p.tasks){object(task,['id','title','date','minutes','required','status']);unique(task.id,taskIds);str(task.title,100);if(!parseDate(task.date))fail('予定日が不正です。');minutes(task.minutes);if(typeof task.required!=='boolean'||!['unstarted','completed'].includes(task.status))fail('進捗または必須設定が不正です。');}
  for(const record of item.records){object(record,['id','projectId','date','subject','minutes','note']);unique(record.id,recordIds);if(record.projectId!==item.projectId)fail('記録の参照先が一致しません。');if(!parseDate(record.date))fail('記録日が不正です。');str(record.subject,100);str(record.note,1000,true);minutes(record.minutes);}
 }
 return value;
}
export function parseBackup(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)fail('ファイルは10MB以内にしてください。');
 let value;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{fail('JSONとして読み込めません。');}
 return validateBackup(value);
}
export function buildBackup(projects,uiPreferences,createdAt=new Date().toISOString()){
 return validateBackup({type:'stardia_backup',schemaVersion:1,createdAt,projects:projects.filter(x=>x.project!==null||x.records.length).map(({projectId,project,records})=>({projectId,project,records})),uiPreferences:structuredClone(uiPreferences)});
}
export function backupSummary(backup){return {projects:backup.projects.filter(x=>x.project).length,tasks:backup.projects.reduce((n,x)=>n+(x.project?.tasks.length||0),0),records:backup.projects.reduce((n,x)=>n+x.records.length,0)};}
