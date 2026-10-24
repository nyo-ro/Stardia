// Adapted from Study normalizeUIConfig, using a distinct Stardia storage key.
export const STORAGE_KEY='stardia.ui.v1';
export const themes={light:'ライト',dark:'ダーク',purple:'パープル'};
export const accents={blue:['ブルー','#3459db'],purple:['パープル','#7550cb'],pink:['ピンク','#bd377a'],green:['グリーン','#16816a'],orange:['オレンジ','#b85d11']};
export const cards={today:'今日の学習',week:'今週の計画',stats:'学習のバランス',recent:'最近の学習'};
export function normalizePreferences(value) {
  const result={version:1,theme:'light',accent:'purple',visibility:Object.fromEntries(Object.keys(cards).map(id=>[id,true]))};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  if (Object.hasOwn(themes,value.theme)) result.theme=value.theme;
  if (Object.hasOwn(accents,value.accent)) result.accent=value.accent;
  for (const id of Object.keys(cards)) if(typeof value.visibility?.[id] === 'boolean') result.visibility[id]=value.visibility[id];
  return result;
}
export function readPreferences(storage) {
  try { return {value:normalizePreferences(JSON.parse(storage.getItem(STORAGE_KEY))),error:false}; }
  catch { return {value:normalizePreferences(null),error:true}; }
}
export function writePreferences(storage,value) {
  try {storage.setItem(STORAGE_KEY,JSON.stringify(normalizePreferences(value)));return true;} catch {return false;}
}
