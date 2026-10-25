import {parseDate} from './date.js';
// Study's task progress / aggregation ideas, made project-scoped and explicit.
export function tasksOn(project, date) { return project.schedules.filter(s=>!s.archived&&s.date===date).map(s=>({...s,title:project.items.find(i=>i.id===s.itemId)?.title||'項目不明'})); }
export function progress(tasks) {
  const required = tasks.filter(task => task.required !== false);
  const completed = required.filter(task => task.status === 'completed').length;
  return {completed,total:required.length,percent:required.length ? Math.round(completed/required.length*100) : 0};
}
export function summarize(records) {
  const subjects = new Map();
  let minutes = 0;
  const days = new Set();
  for (const record of records) {
    minutes += record.minutes; days.add(record.date);
    subjects.set(record.subject, (subjects.get(record.subject) || 0) + record.minutes);
  }
  return {minutes,days:days.size,subjects:[...subjects].map(([name,minutes]) => ({name,minutes}))};
}
export function validateRecord(input, projectId) {
  if (!parseDate(input.date)) throw new Error('正しい日付を入力してください。');
  if (typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 100) throw new Error('学習内容は1〜100文字で入力してください。');
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 1440) throw new Error('学習時間は1〜1440分の整数で入力してください。');
  if (typeof input.note !== 'string' || input.note.length > 1000) throw new Error('メモは1000文字以内で入力してください。');
  return {projectId,date:input.date,subject:input.subject.trim(),minutes:input.minutes,note:input.note};
}
