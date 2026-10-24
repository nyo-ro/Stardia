import {mondayOf,plusDays,localDate} from './date.js';
// Entirely fictional. No Study JSON or personal information is used.
export function createDemo(today = localDate()) {
  const start = mondayOf(today);
  const subjects = ['英語のフレーズ','デザインの基礎','読書と振り返り'];
  const project = {id:'demo-project',name:'小さな学びの習慣',goal:'毎日少しずつ、自分の世界を広げる。',tasks:[]};
  for (let i=0;i<7;i++) {
    const date=plusDays(start,i);
    project.tasks.push({id:`demo-${i}-a`,date,title:subjects[i%3],minutes:25,required:true,status:date<today?'completed':'unstarted'});
    project.tasks.push({id:`demo-${i}-b`,date,title:'学んだことを3行でまとめる',minutes:10,required:true,status:'unstarted'});
  }
  project.tasks.push({id:'demo-optional',date:today,title:'気になるテーマを探す',minutes:15,required:false,status:'unstarted'});
  const records=[1,2,3].map((offset,index)=>({id:`demo-record-${index}`,projectId:project.id,date:plusDays(today,-offset),subject:subjects[index],minutes:[25,40,20][index],note:'架空のサンプル記録です。'}));
  return {schemaVersion:1,project,records};
}
