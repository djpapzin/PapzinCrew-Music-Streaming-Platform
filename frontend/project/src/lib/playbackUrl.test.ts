import { describe, expect, it } from 'vitest';
import { playbackUrl } from './playbackUrl';
const file_path = 'https://s3.us-east-005.backblazeb2.com/bucket/mix.mp3';
describe('playback routing', () => {
 it('streams public B2 mixes directly', () => expect(playbackUrl({ id: 1, file_path, availability: 'Public' })).toBe(file_path));
 it.each(['private', 'unlisted'])('keeps %s behind the checked stream route', availability => expect(playbackUrl({ id: 1, file_path, availability })).toMatch(/\/tracks\/1\/stream$/));
 it.each(['uploads/mix.mp3', 'http://s3.us-east-005.backblazeb2.com/bucket/a', 'https://backblazeb2.com.evil.test/a'])('retains the API for %s', file_path => expect(playbackUrl({ id: 1, file_path, availability: 'public' })).toMatch(/\/tracks\/1\/stream$/));
 it('does not create a URL for absent audio', () => expect(playbackUrl({ id: 1 })).toBe(''));
 it('uses a verified public cache URL but never for private or unlisted mixes',()=>{
  const cached_audio_url='https://audio.djpapzin.com/tracks/1/cached/abcdefabcdefabcdefabcdef';
  expect(playbackUrl({id:1,file_path,availability:'public',cached_audio_url})).toBe(cached_audio_url);
  for(const availability of ['private','unlisted']) expect(playbackUrl({id:1,file_path,availability,cached_audio_url})).toMatch(/\/tracks\/1\/stream$/);
 });
 it.each(['https://audio.djpapzin.com.evil.test/tracks/1/cached/x','http://audio.djpapzin.com/tracks/1/cached/x','https://audio.djpapzin.com/tracks/2/cached/x'])('rejects an unexpected cache destination %s',cached_audio_url=>expect(playbackUrl({id:1,file_path,cached_audio_url})).toBe(file_path));
});
