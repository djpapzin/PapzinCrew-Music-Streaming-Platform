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

  it('uses the birthday flyer for the exact Cruize Friday 10 release', () => {
    const title = 'Cruize Friday 10 (Special Edition) (13 January 2017)';
    const cover = '/artwork/replacements/cruize-friday-10.jpg';
    expect(existsSync(resolve('public', cover.slice(1)))).toBe(true);
    expect(artworkForMix(31, title)).toBe(cover);
    expect(artworkForMix(31, 'Cruize Friday 10')).toBe(safeArtworkUrl());
  });

  it('reuses the birthday flyer for the 2022 Sghubu Sa Pitori mix when its cover is missing', () => {
    const title = "Papzin's Birthday Mix (Sghubu Sa Pitori) (31 July 2022)";
    const cover = '/artwork/replacements/cruize-friday-10.jpg';
    const original = 'https://example.com/original.jpg';
    expect(artworkForMix(125, title)).toBe(cover);
    expect(artworkForMix(125, title, original)).toBe(original);
    expect(artworkForMix(125, 'Another birthday mix')).toBe(safeArtworkUrl());
    expect(artworkForMix(12, title)).toBe(safeArtworkUrl());
  });

  it('uses the embedded RealProDJ portrait when Appreciation Mix 3 has no catalog cover', () => {
    const title = 'Appreciation Mix 3 (Papzin & Crew Promo Mix) (09-August-2018)';
    const cover = '/artwork/replacements/appreciation-mix-3.jpg';
    const original = 'https://example.com/original.jpg';
    expect(existsSync(resolve('public', cover.slice(1)))).toBe(true);
    expect(artworkForMix(139, title)).toBe(cover);
    expect(artworkForMix(139, title, original)).toBe(original);
    expect(artworkForMix(139, title.replace('August', 'July'))).toBe(safeArtworkUrl());
    expect(artworkForMix(143, title)).toBe(safeArtworkUrl());
  });

  it('preserves the Evolution Mix 60 cover fallback', () => {
    expect(artworkForMix(224, 'Evolution Mix 60')).toBe('/artwork/generated/evolution-mix-60.png');
  });
});
