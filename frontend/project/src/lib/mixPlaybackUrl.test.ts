import { afterEach, expect, it, vi } from 'vitest';
import { mixPlaybackUrl } from './mixPlaybackUrl';
import type { Song } from '../types/music';
const cached = 'https://audio.djpapzin.com/tracks/241/cached/3d6afabe36b60424277be29c';
const song = {id:'241',audioUrl:cached} as Song;
afterEach(()=>vi.unstubAllGlobals());
it('keeps production cache delivery direct and uses the existing same-origin proxy on previews',()=>{
 vi.stubGlobal('location',{origin:'https://crew.djpapzin.com',hostname:'crew.djpapzin.com'});
 expect(mixPlaybackUrl(song)).toBe(cached);
 vi.stubGlobal('location',{origin:'https://deploy-preview-74--papzincrew.netlify.app',hostname:'deploy-preview-74--papzincrew.netlify.app'});
 expect(mixPlaybackUrl(song)).toBe('/api/tracks/241/cached/3d6afabe36b60424277be29c');
});
it.each([cached.replace('/241/','/237/'),cached+'?download=1',cached.replace('https:','http:'),cached.replace('audio.djpapzin.com','audio.djpapzin.com.evil.test'),'/api/tracks/241/stream','https://bucket.backblazeb2.com/mix.mp3'])('keeps non-cache/access-checked sources native: %s',audioUrl=>{
 expect(mixPlaybackUrl({...song,audioUrl})).toBeNull();
});
it.each([
 {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',platform:'iPhone',maxTouchPoints:5},
 {userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5},
])('keeps iOS music outside the Web Audio graph',device=>{
 vi.stubGlobal('navigator',device);
 expect(mixPlaybackUrl(song)).toBeNull();
});
