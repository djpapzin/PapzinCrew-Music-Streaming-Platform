export const UPLOAD_RECEIPTS_KEY = 'papzincrew:uploads:v1';
export interface UploadReceipt { id: string; title: string; savedAt: string }
export function readUploadReceipts(): UploadReceipt[] {
  try {
    const items: unknown = JSON.parse(localStorage.getItem(UPLOAD_RECEIPTS_KEY) || '[]');
    return Array.isArray(items) ? items.filter((item): item is UploadReceipt => !!item && typeof item.id === 'string' && /^\d+$/.test(item.id) && typeof item.title === 'string' && typeof item.savedAt === 'string').slice(0, 30) : [];
  } catch { return []; }
}
export function saveUploadReceipt(id: number | string, title: string): boolean {
  if (!/^\d+$/.test(String(id))) return false;
  try {
    localStorage.setItem(UPLOAD_RECEIPTS_KEY, JSON.stringify([{ id: String(id), title: title.slice(0, 300), savedAt: new Date().toISOString() }, ...readUploadReceipts().filter(item => item.id !== String(id))].slice(0, 30)));
    return true;
  } catch { return false; }
}
