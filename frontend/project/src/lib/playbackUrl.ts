import { API_BASE } from './api';

// Public B2 objects can stream directly, avoiding two application proxies and a
// redundant origin HEAD. Restricted records always retain the access-checked API.
export function playbackUrl(mix: { id: string | number; file_path?: string; availability?: string }): string {
  if (!mix.file_path) return '';
  if ((mix.availability || 'public').toLowerCase() === 'public') {
    try {
      const url = new URL(mix.file_path);
      if (url.protocol === 'https:' && url.hostname.endsWith('.backblazeb2.com')) return url.href;
    } catch { /* Relative/local audio continues through the API. */ }
  }
  return `${API_BASE}/tracks/${mix.id}/stream`;
}
