import originalArtwork from '../data/originalArtwork.json';
import generatedArtwork from '../data/generatedArtwork.json';

const originals: Record<string, { title: string; url: string }> = originalArtwork;

/** Reviewed originals are scoped to both catalog ID and title to avoid cross-matching. */
export function originalArtworkForTrack(id: string | number, title: string): string | undefined {
  const original = originals[String(id)];
  return original?.title === title ? original.url : undefined;
}

/** Generated replacements apply only when no original or catalog cover is available. */
export function generatedArtworkForTrack(id: string | number, title: string): string | undefined {
  const covers: Record<string, { title: string; url: string }> = generatedArtwork;
  const cover = covers[String(id)];
  return cover?.title === title ? cover.url : undefined;
}

export const DEFAULT_ARTWORK_DATA_URL =
  "data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320'>\
  <defs>\
    <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>\
      <stop offset='0%' stop-color='%235b21b6'/>\
      <stop offset='100%' stop-color='%23db2777'/>\
    </linearGradient>\
  </defs>\
  <rect width='100%' height='100%' rx='28' fill='url(%23g)'/>\
  <circle cx='160' cy='160' r='70' fill='rgba(255,255,255,0.14)'/>\
  <text x='50%' y='52%' font-size='112' text-anchor='middle' dominant-baseline='middle' fill='white'>♪</text>\
  <text x='50%' y='83%' font-size='26' font-weight='700' text-anchor='middle' fill='white' font-family='Arial, Helvetica, sans-serif' letter-spacing='1.5'>PAPZIN &amp; CREW</text>\
</svg>";

export const resolveArtworkUrl = (url?: string | null): string => {
  const trimmed = url?.trim();
  return trimmed ? trimmed : DEFAULT_ARTWORK_DATA_URL;
};

export const DEFAULT_ARTWORK_URL = DEFAULT_ARTWORK_DATA_URL;
export const safeArtworkUrl = resolveArtworkUrl;
