import { API_BASE } from './api';

export function downloadUrl(mix: { id: string | number; file_path?: string; availability?: string; cached_audio_url?: string; allow_downloads?: string }): string | undefined {
  if ((mix.availability || 'public').toLowerCase() !== 'public' || mix.allow_downloads !== 'yes' || !mix.cached_audio_url) return undefined;
  const url = playbackUrl(mix);
  // Downloads never fall back to Backblaze or the legacy download redirect.
  return url === mix.cached_audio_url ? `${url}?download=1` : undefined;
}

// Public B2 objects can stream directly, avoiding two application proxies and a
// redundant origin HEAD. Restricted records always retain the access-checked API.
export function playbackUrl(mix: { id: string | number; file_path?: string; availability?: string; cached_audio_url?: string }): string {
  if (!mix.file_path) return '';
  if ((mix.availability || 'public').toLowerCase() === 'public') {
    try {
      if (mix.cached_audio_url) {
        const cached = new URL(mix.cached_audio_url);
        if (cached.protocol === 'https:' && cached.hostname === 'audio.djpapzin.com' &&
            !cached.port && !cached.username && !cached.password && !cached.search && !cached.hash &&
            new RegExp(`^/tracks/${mix.id}/cached/[a-f0-9]{24}$`).test(cached.pathname)) return cached.href;
      }
      const url = new URL(mix.file_path);
      if (url.protocol === 'https:' && url.hostname.endsWith('.backblazeb2.com')) return url.href;
    } catch { /* Relative/local audio continues through the API. */ }
  }
  return `${API_BASE}/tracks/${mix.id}/stream`;
}
