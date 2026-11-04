import type { Song } from '../types/music';

// Only route trusted, public cache audio through Web Audio. Legacy/direct and
// access-checked streams retain the native player and its existing CORS behavior.
export function mixPlaybackUrl(song: Song): string | null {
  // iOS can suspend Web Audio output when Safari is backgrounded even while
  // its media element keeps advancing. Keep music on the native media path.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return null;
  try {
    const url = new URL(song.audioUrl, location.origin);
    if (/^\d+$/.test(song.id) && url.protocol === 'https:' && url.host === 'audio.djpapzin.com'
      && !url.username && !url.password && !url.search && !url.hash
      && new RegExp(`^/tracks/${song.id}/cached/[a-f0-9]{24}$`).test(url.pathname)) {
      // Netlify previews are not added to the API's CORS allowlist. The existing
      // same-origin proxy preserves Range delivery and cache access/budget checks.
      return location.hostname.endsWith('.netlify.app') && location.hostname.includes('--')
        ? `/api${url.pathname}` : url.href;
    }
    if (url.origin === location.origin && /^\/audio\/[^/?#]+\.(wav|mp3|m4a)$/.test(url.pathname)
      && !url.search && !url.hash) return url.href;
  } catch { /* Invalid/legacy sources use native playback. */ }
  return null;
}
