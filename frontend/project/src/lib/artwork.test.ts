import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import originals from '../data/originalArtwork.json';
import { originalArtworkForTrack, safeArtworkUrl } from './artwork';

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
