import { API_BASE } from './api';
import { playbackUrl } from './playbackUrl';
import type { Song } from '../types/music';

// Refresh metadata only. Never fetch audio from an alternate origin or retry B2.
export function canRecoverPlayback(song: Song): boolean {
  try {
    const url = new URL(song.audioUrl, location.origin);
    return /^\d+$/.test(song.id) && (url.hostname.endsWith('.backblazeb2.com') ||
      url.hostname === 'audio.djpapzin.com' || url.href === new URL(`${API_BASE}/tracks/${song.id}/stream`, location.origin).href);
  } catch { return false; }
}
export async function recoverPlaybackUrl(song: Song, signal: AbortSignal, errorCode?: number): Promise<string | null> {
  // A transient network error does not invalidate a versioned cache URL.
  // Retry that same public route once without depending on a metadata request;
  // the cache endpoint still checks visibility, version and the serving budget.
  const current = new URL(song.audioUrl, location.origin);
  if (errorCode === 2 && current.protocol === 'https:' && current.host === 'audio.djpapzin.com' &&
      !current.username && !current.password && !current.search && !current.hash &&
      /^\d+$/.test(song.id) && current.pathname.match(new RegExp(`^/tracks/${song.id}/cached/[a-f0-9]{24}$`))) {
    return current.href;
  }
  const response = await fetch(`${API_BASE}/tracks/${song.id}`, { signal, cache: 'no-store', credentials: 'omit' });
  if (!response.ok) return null;
  const mix = await response.json();
  if (String(mix.id) !== song.id || (mix.availability || 'public').toLowerCase() !== 'public' || !mix.cached_audio_url) return null;
  const url = playbackUrl(mix);
  return url === mix.cached_audio_url ? url : null;
}
