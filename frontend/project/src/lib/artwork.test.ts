import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import originals from '../data/originalArtwork.json';
import { artworkForMix, originalArtworkForTrack, safeArtworkUrl } from './artwork';

describe('reviewed original artwork', () => {
  it('ships every mapped cover and matches the exact track identity', () => {
    for (const [id, cover] of Object.entries(originals)) {
      expect(existsSync(resolve('public', cover.url.slice(1)))).toBe(true);
      expect(originalArtworkForTrack(id, cover.title)).toBe(cover.url);
      expect(originalArtworkForTrack(id, 'An unrelated mix')).toBeUndefined();
    }
  });

  it('leaves TPW and unreviewed tracks on their existing artwork', () => {
    for (let id = 182; id <= 231; id++) {
      expect(Object.keys(originals)).not.toContain(String(id));
    }
    const existing = 'https://example.com/existing-cover.jpg';
    expect(safeArtworkUrl(originalArtworkForTrack(9999, 'Unreviewed') ?? existing)).toBe(existing);
  });
});

describe('replacement covers', () => {
  it('uses the supplied cover for track 237 when the catalog has no cover', () => {
    const title = 'Many More @ It Aagain';
    const cover = '/artwork/replacements/many-more-it-aagain.png';
    expect(existsSync(resolve('public', cover.slice(1)))).toBe(true);
    expect(artworkForMix(237, title, '   ')).toBe(cover);
    expect(artworkForMix(237, title, 'https://example.com/original.jpg')).toBe('https://example.com/original.jpg');
    expect(artworkForMix(237, 'Another mix')).toBe(safeArtworkUrl());
    expect(artworkForMix(238, title)).toBe(safeArtworkUrl());
  });

  it('preserves the Evolution Mix 60 cover fallback', () => {
    expect(artworkForMix(224, 'Evolution Mix 60')).toBe('/artwork/generated/evolution-mix-60.png');
  });
});
