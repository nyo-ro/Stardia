// Adapted from Study's date helpers. No state or DOM dependency.
export function localDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
}
export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) || localDate(date) !== value ? null : date;
}
export function plusDays(value, days) {
  const date = parseDate(value);
  if (!date) throw new Error('日付が不正です。');
  date.setDate(date.getDate() + days);
  return localDate(date);
}
export function mondayOf(value) {
  const date = parseDate(value);
  if (!date) throw new Error('日付が不正です。');
  return plusDays(value, -(date.getDay()+6)%7);
}
export function dateText(value) {
  return new Intl.DateTimeFormat('ja-JP', {month:'long',day:'numeric',weekday:'short'}).format(parseDate(value));
}
export function minText(minutes) {
  return minutes >= 60 ? `${Math.floor(minutes/60)}時間${minutes%60 ? ` ${minutes%60}分` : ''}` : `${minutes}分`;
}
