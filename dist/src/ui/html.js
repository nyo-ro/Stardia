// Adapted from Study esc(). Escape all data interpolated into markup.
export function esc(value) {return String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
