import { Song } from '../types/music';

export const TPW_SERIES = 'TPW — The Pristine World';
const titles = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export const getMixSeries = (song: Song): string => {
  if (/^TPW(?:\s|$)/i.test(song.title) || /The Pristine World/i.test(song.album)) return TPW_SERIES;
  if (song.album.trim()) return song.album.trim();
  if (/Cruize Friday Guest/i.test(song.title)) return 'Cruize Friday Guests';
  if (/Cruize Friday/i.test(song.title)) return 'Cruize Friday';
  if (/Cruize Superstars/i.test(song.title)) return 'Cruize Superstars';
  if (/Cruize Gold/i.test(song.title)) return 'Cruize Gold';
  if (/Birthday/i.test(song.title)) return 'Birthday Mixes';
  if (/Dedication/i.test(song.title)) return 'Dedication Mixes';
  return 'Singles & Mixes';
};

/** Keep numbered TPW episodes together, then bonuses; naturally sort other series. */
export const sortCollectionTracks = (songs: Song[]): Song[] => [...songs].sort((a, b) => {
  const aNumber = a.title.match(/^TPW\s+(\d+)\b/i);
  const bNumber = b.title.match(/^TPW\s+(\d+)\b/i);
  const aIsTpw = getMixSeries(a) === TPW_SERIES;
  const bIsTpw = getMixSeries(b) === TPW_SERIES;
  // Artist collections can contain several series: keep TPW together so the
  // ordering stays consistent even when a bonus title begins with another word.
  if (aIsTpw !== bIsTpw) return aIsTpw ? -1 : 1;
  if (aIsTpw && bIsTpw) {
    if (aNumber && bNumber) return Number(aNumber[1]) - Number(bNumber[1]);
    if (aNumber) return -1;
    if (bNumber) return 1;
  }
  return titles.compare(a.title, b.title) || titles.compare(a.artist, b.artist);
});
