import {parseDate,localDate,mondayOf,plusDays} from '../domain/date.js';
export const views={today:'今日',plans:'学習計画',items:'学習項目',records:'学習記録',analysis:'分析',ai:'AI連携',data:'データ管理'};
export const VIEW_KEY='stardia.ui.session.v1';
export function defaultViewState(today=localDate()){return {plans:{mode:'week',from:today,to:today,query:'',page:0},items:{query:'',state:'active',page:0},records:{from:'',to:'',itemId:'',query:'',page:0},analysis:{mode:'week',from:today,to:today,page:0},settingsOpen:false};}
export function readViewState(storage,today){const state=defaultViewState(today);try{const input=JSON.parse(storage?.getItem(VIEW_KEY)||'null');if(!input)return state;for(const group of ['plans','items','records','analysis'])for(const key of Object.keys(state[group])){const value=input[group]?.[key];if(key==='page'){if(Number.isSafeInteger(value)&&value>=0&&value<10000)state[group][key]=value;}else if(typeof value==='string'&&value.length<=200){if(['from','to'].includes(key)){if(!value&&group==='records'||parseDate(value))state[group][key]=value;}else if(key==='mode'){const allowed=group==='plans'?['day','week','range','all']:['week','month','all','range'];if(allowed.includes(value))state[group][key]=value;}else if(key==='state'){if(['active','archived'].includes(value))state[group][key]=value;}else state[group][key]=value;}}state.settingsOpen=input.settingsOpen===true;}catch{}return state;}
export function period(mode,from,to,today=localDate()){
 if(mode==='all')return {from:'',to:''};
 if(mode==='month'){const first=today.slice(0,7)+'-01',date=new Date(first+'T12:00:00');date.setMonth(date.getMonth()+1);return {from:first,to:plusDays(localDate(date),-1)};}
 if(!parseDate(from))throw Error('対象日・開始日を指定してください。');
 if(mode==='week'){const start=mondayOf(from);return {from:start,to:plusDays(start,6)};}
 if(mode==='day')return {from,to:from};
 if(!parseDate(to)||from>to)throw Error('終了日は開始日以降を指定してください。');return {from,to};
}
export function within(date,range){return (!range.from||date>=range.from)&&(!range.to||date<=range.to);}
export function pageOf(list,state,size=25){const pages=Math.max(1,Math.ceil(list.length/size));state.page=Math.max(0,Math.min(state.page||0,pages-1));return {rows:list.slice(state.page*size,(state.page+1)*size),page:state.page,pages,total:list.length};}
