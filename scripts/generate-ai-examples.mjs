// Fictional documentation fixtures only. No browser data or external sources.
import {writeFile,mkdir} from 'node:fs/promises';
import {buildContext,prepareUpdate} from '../dist/src/domain/ai.js';
const projectId='fictional-project';
const item={id:'item-language',title:'架空の語学学習',description:'仕様説明用',archived:false};
const plan=(id,date)=>({id,itemId:item.id,date,minutes:30,required:true,status:'unstarted',archived:false});
const record=(id,date,subject)=>({id,projectId,date,subject,minutes:20,note:'架空の実績',itemId:item.id,scheduleId:null});
const snapshot={schemaVersion:2,projectId,revision:5,project:{id:projectId,name:'架空の学習プロジェクト',description:'個人データを含まない例',goal:'少しずつ続ける',startDate:null,targetDate:'2032-12-31',items:[item],schedules:[plan('plan-edit','2032-10-27'),plan('plan-delete','2032-10-28')]},records:[record('record-edit','2032-10-25','語彙の確認')]};
const context=await buildContext(snapshot);context.createdAt='2032-10-26T00:00:00.000Z';context.updateTemplate.requestId='example-request-001';
const input=r=>{const {id,projectId,...rest}=r;return rest;};
const update={...context.updateTemplate,operations:[{type:'addRecord',id:'record-new-1',input:input(record('x','2032-10-26','例文の練習'))},{type:'addRecord',id:'record-new-2',input:input(record('x','2032-10-27','発音の練習'))},{type:'updateRecord',id:'record-edit',input:{...input(snapshot.records[0]),minutes:25}},{type:'addSchedule',id:'plan-new',input:{itemId:item.id,date:'2032-10-29',minutes:45,required:false}},{type:'updateSchedule',id:'plan-edit',input:{itemId:item.id,date:'2032-10-30',minutes:40,required:true}},{type:'deleteSchedule',id:'plan-delete'}]};
await prepareUpdate(snapshot,update);
const dir=new URL('../docs/examples/',import.meta.url);await mkdir(dir,{recursive:true});
for(const [name,value] of [['ai-context.json',context],['ai-update.json',update]])await writeFile(new URL(name,dir),JSON.stringify(value,null,2)+'\n','utf8');
console.log('Generated and validated fictional AI examples.');
