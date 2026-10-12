import { describe, expect, it } from 'vitest';
import { Song } from '../types/music';
import { getMixSeries, sortCollectionTracks, TPW_SERIES } from './catalog';

const song = (title: string, album = ''): Song => ({
  id: title, title, album, artist: 'DJ Papzin', duration: 1800,
  imageUrl: '', audioUrl: '', genre: 'House', year: 2013,
});

describe('mix collections', () => {
  it('plays all 37 numbered episodes in sequence before bonus mixes without mutating the catalog', () => {
    const catalog = [song('TPW (Bonus Mix)'), ...Array.from({ length: 37 }, (_, i) => song(`TPW ${37-i} (Mix)`))];
    const sorted = sortCollectionTracks(catalog);
    expect(sorted.slice(0,37).map(s => s.title)).toEqual(Array.from({ length: 37 }, (_, i) => `TPW ${i+1} (Mix)`));
    expect(sorted[37].title).toBe('TPW (Bonus Mix)');
    expect(catalog[0].title).toBe('TPW (Bonus Mix)');
  });

  it('includes original TPW album tags but keeps guest artists’ other series separate', () => {
    expect(getMixSeries(song('Because We Can Cool Your Box', 'The Pristine World'))).toBe(TPW_SERIES);
    expect(getMixSeries(song('TPW 18 (The Party After)'))).toBe(TPW_SERIES);
    expect(getMixSeries(song('A PS Collaboration (Vol. 3)', 'A PS Collaboration'))).toBe('A PS Collaboration');
    expect(getMixSeries(song("Lamel's Birthday Mix (feat. DJ Papzin)"))).toBe('Birthday Mixes');
  });

  it('sorts collaboration volumes numerically', () => {
    expect(sortCollectionTracks([song('Volume 10'), song('Volume 2'), song('Volume 1')]).map(s => s.title))
      .toEqual(['Volume 1', 'Volume 2', 'Volume 10']);
  });

  it('keeps TPW episodes and bonuses together in a mixed artist collection', () => {
    const archive = [song('DJ Collaboration'), song('Because We Can', 'The Pristine World'), song('TPW 2'), song('TPW 1')];
    const expected = ['TPW 1', 'TPW 2', 'Because We Can', 'DJ Collaboration'];
    expect(sortCollectionTracks(archive).map(s => s.title)).toEqual(expected);
    expect(sortCollectionTracks([...archive].reverse()).map(s => s.title)).toEqual(expected);
  });
});
