import { API_BASE } from './api';

export function uploadEndpoint(configured = (import.meta as any).env?.VITE_UPLOAD_URL as string | undefined): string {
  if (!configured?.trim()) return `${API_BASE}/upload`;
  // This optional dedicated route bypasses short-lived website/API proxies.
  // It stays off until the owner approves exposing the intake route.
  const url = new URL(configured.trim());
  if (url.href !== 'https://audio.djpapzin.com/intake/upload') throw new Error('The upload connection is not configured correctly.');
  return url.href;
}

export function uploadFailureMessage(status: number, payload: any, statusText = ''): string {
  const detail = payload?.detail ?? payload;
  const message = typeof detail === 'string' ? detail : detail?.error || detail?.message || payload?.error;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if ([408, 504, 524].includes(status)) return 'The upload connection timed out before the mix was saved. Keep your file and try again on a stable connection.';
  if (status === 413) return 'The upload connection rejected the file size. Your mix has not been saved; please contact DJ Papzin.';
  if (status === 400) return 'The server could not read the upload. Your mix has not been confirmed as saved. Keep your file and contact DJ Papzin if this repeats.';
  return statusText.trim() || `Upload failed (HTTP ${status}). Your mix has not been confirmed as saved. Please keep your file.`;
}
