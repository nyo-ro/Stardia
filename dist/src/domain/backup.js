import {validateProjectData,migrateProjectV1} from './model.js';
import {validateBackup as validateLegacyBackup} from './legacy-backup.js';
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
 if(value?.schemaVersion===1){
  validateLegacyBackup(value);
  return validateBackup({...value,schemaVersion:2,projects:value.projects.map(migrateProjectV1)});
 }
 object(value,['type','schemaVersion','createdAt','projects','uiPreferences']);
 if(value.type!=='stardia_backup'||value.schemaVersion!==2)fail('未対応の形式・バージョンです。');
 if(typeof value.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)||!Number.isFinite(Date.parse(value.createdAt))||new Date(value.createdAt).toISOString()!==value.createdAt)fail('作成日時が不正です。');
 validatePreferences(value.uiPreferences);
 if(!Array.isArray(value.projects)||value.projects.length>1000)fail('プロジェクト一覧が不正です。');
 const ids=new Set();for(const project of value.projects){unique(project.projectId,ids);validateProjectData(project);}
 return value;
}
export function parseBackup(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BACKUP_BYTES)fail('ファイルは10MB以内にしてください。');
 let value;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{fail('JSONとして読み込めません。');}
 return validateBackup(value);
}
export function buildBackup(projects,uiPreferences,createdAt=new Date().toISOString()){
 return validateBackup({type:'stardia_backup',schemaVersion:2,createdAt,projects:projects.filter(x=>x.project!==null||x.records.length).map(({projectId,project,records})=>({projectId,project,records})),uiPreferences:structuredClone(uiPreferences)});
}
export function backupSummary(backup){return {projects:backup.projects.filter(x=>x.project).length,items:backup.projects.reduce((n,x)=>n+(x.project?.items.filter(i=>!i.archived).length||0),0),tasks:backup.projects.reduce((n,x)=>n+(x.project?.schedules.filter(s=>!s.archived).length||0),0),records:backup.projects.reduce((n,x)=>n+x.records.length,0)};}
