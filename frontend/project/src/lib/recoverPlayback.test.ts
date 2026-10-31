import { afterEach, describe, expect, it, vi } from 'vitest';
import { recoverPlaybackUrl } from './recoverPlayback';
import type { Song } from '../types/music';
const url='https://audio.djpapzin.com/tracks/58/cached/11a8146407532d779c0002c5';
const song={id:'58',audioUrl:url} as Song;
afterEach(()=>vi.unstubAllGlobals());
describe('network recovery route limits',()=>{
 it.each([
  url.replace('/58/','/59/'),url+'?download=1',url.replace('https:','http:'),
  url.replace('audio.djpapzin.com','other.example'),url.replace('/cached/','/stream/'),
 ])('does not retry an unverified route directly: %s',async audioUrl=>{
  const fetcher=vi.fn().mockResolvedValue({ok:false});vi.stubGlobal('fetch',fetcher);
  expect(await recoverPlaybackUrl({...song,audioUrl},new AbortController().signal,2)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('still refreshes metadata for missing or unsupported sources',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:false});vi.stubGlobal('fetch',fetcher);
  expect(await recoverPlaybackUrl(song,new AbortController().signal,4)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
