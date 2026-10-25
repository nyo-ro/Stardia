import {mondayOf,plusDays,localDate} from './date.js';
// Entirely fictional. Items are reused across dates; no private data is loaded.
export function createDemo(today=localDate()){
 const start=mondayOf(today),titles=['英語のフレーズ','デザインの基礎','読書と振り返り'];
 const items=[...titles,'学んだことを3行でまとめる','気になるテーマを探す'].map((title,i)=>({id:`demo-item-${i}`,title,description:'自分に合う方法で取り組みましょう。',archived:false}));
 const schedules=[];
 for(let i=0;i<7;i++){
  const date=plusDays(start,i);
  schedules.push({id:`demo-${i}-a`,itemId:items[i%3].id,date,minutes:25,required:true,status:date<today?'completed':'unstarted',archived:false});
  schedules.push({id:`demo-${i}-b`,itemId:items[3].id,date,minutes:10,required:true,status:'unstarted',archived:false});
 }
 schedules.push({id:'demo-optional',itemId:items[4].id,date:today,minutes:15,required:false,status:'unstarted',archived:false});
 const project={id:'demo-project',name:'小さな学びの習慣',description:'架空の学習環境です。自由に操作して試せます。',goal:'毎日少しずつ、自分の世界を広げる。',startDate:null,targetDate:null,items,schedules};
 const records=[1,2,3].map((offset,index)=>({id:`demo-record-${index}`,projectId:project.id,date:plusDays(today,-offset),subject:titles[index],minutes:[25,40,20][index],note:'架空のサンプル記録です。',itemId:items[index].id,scheduleId:null}));
 return {schemaVersion:2,project,records};
}
