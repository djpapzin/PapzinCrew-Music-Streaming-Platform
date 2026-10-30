import { act, render, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { usePlayer, VOLUME_KEY } from './usePlayer';
import { Song } from '../types/music';
let player:ReturnType<typeof usePlayer>;let audio:HTMLAudioElement;let paused=true;
function Harness(){player=usePlayer();return <audio ref={player.audioRef}/>;}
const song=(id:string):Song=>({id,title:`Mix ${id}`,artist:'DJ Papzin',album:'',duration:100,imageUrl:'',audioUrl:`https://example.com/tracks/${id}/stream`,genre:'House',year:2020});
const queue=[song('1'),song('2'),song('3')];
beforeEach(()=>{localStorage.clear();paused=true;vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(function(this:HTMLMediaElement){paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();});vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(function(this:HTMLMediaElement){paused=true;this.dispatchEvent(new Event('pause'));});vi.spyOn(HTMLMediaElement.prototype,'paused','get').mockImplementation(()=>paused);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(){render(<Harness/>);audio=player.audioRef.current!;Object.defineProperty(audio,'duration',{configurable:true,value:100});}
describe('playback regressions',()=>{
  it('uses the supplied stream without rewriting it to the proxy',async()=>{setup();await act(async()=>player.playSong(queue[0]));expect(audio.src).toBe(queue[0].audioUrl);});
  it('preserves mute across automatic track changes using current queue state',async()=>{setup();await act(async()=>{player.setVolume(0);player.playSong(queue[0],queue);});expect(audio.volume).toBe(0);expect(audio.muted).toBe(true);await act(async()=>audio.dispatchEvent(new Event('ended')));expect(player.playerState.currentSong?.id).toBe('2');expect(audio.muted).toBe(true);await act(async()=>audio.dispatchEvent(new Event('ended')));expect(player.playerState.currentSong?.id).toBe('3');expect(localStorage.getItem(VOLUME_KEY)).toBe('0');});
  it('repeats one on ended, but Next still changes tracks',async()=>{setup();await act(async()=>{player.playSong(queue[0],queue);player.toggleRepeat();player.toggleRepeat();});audio.currentTime=99;await act(async()=>audio.dispatchEvent(new Event('ended')));expect(player.playerState.currentSong?.id).toBe('1');expect(audio.currentTime).toBe(0);await act(async()=>player.handleNext());expect(player.playerState.currentSong?.id).toBe('2');});
  it('wraps repeat all and stops when repeat is off',async()=>{setup();await act(async()=>{player.playSong(queue[2],queue);player.toggleRepeat();audio.dispatchEvent(new Event('ended'));});expect(player.playerState.currentSong?.id).toBe('1');await act(async()=>{player.toggleRepeat();player.toggleRepeat();player.playSong(queue[2],queue);audio.dispatchEvent(new Event('ended'));});expect(player.playerState.isPlaying).toBe(false);expect(audio.paused).toBe(true);});
  it('updates seeking immediately while paused and clamps to duration',async()=>{setup();await act(async()=>player.playSong(queue[0],queue));act(()=>player.togglePlay());expect(player.playerState.isPlaying).toBe(false);act(()=>player.seekTo(25));expect(player.playerState.currentTime).toBe(25);expect(audio.currentTime).toBe(25);act(()=>player.seekTo(200));expect(audio.currentTime).toBe(100);});
  it('uses current shuffle state and avoids the same track',async()=>{setup();vi.spyOn(Math,'random').mockReturnValue(0.9);await act(async()=>{player.playSong(queue[0],queue);player.toggleShuffle();audio.dispatchEvent(new Event('ended'));});expect(player.playerState.currentSong?.id).toBe('3');});
  it('stops instead of endlessly retrying failed tracks',async()=>{setup();await act(async()=>{player.playSong(queue[0],queue);player.toggleRepeat();audio.dispatchEvent(new Event('error'));audio.dispatchEvent(new Event('error'));audio.dispatchEvent(new Event('error'));});expect(player.playerState.isPlaying).toBe(false);});
});

describe('playback startup timing',()=>{
 it('times playing rather than play or metadata, and ignores later buffering',async()=>{setup();const now=vi.spyOn(performance,'now').mockReturnValue(1000);await act(async()=>player.playSong(queue[0],queue));expect(player.playbackAttempts[0].status).toBe('waiting');act(()=>audio.dispatchEvent(new Event('loadedmetadata')));expect(player.playbackAttempts[0].status).toBe('waiting');Object.defineProperty(audio,'readyState',{configurable:true,value:4});now.mockReturnValue(2800);act(()=>audio.dispatchEvent(new Event('playing')));expect(player.playbackAttempts[0].milliseconds).toBe(1800);now.mockReturnValue(9000);act(()=>{audio.dispatchEvent(new Event('waiting'));audio.dispatchEvent(new Event('playing'));});expect(player.playbackAttempts).toHaveLength(1);expect(player.playbackAttempts[0].milliseconds).toBe(1800);});
 it('cancels a pending start and measures a resume separately',async()=>{setup();await act(async()=>player.playSong(queue[0],queue));act(()=>player.togglePlay());expect(player.playbackAttempts[0].status).toBe('cancelled');await act(async()=>player.togglePlay());expect(player.playbackAttempts[0].kind).toBe('Resume');Object.defineProperty(audio,'readyState',{configurable:true,value:4});act(()=>audio.dispatchEvent(new Event('playing')));expect(player.playbackAttempts[0].status).toBe('started');expect(player.playbackAttempts[1].milliseconds).toBeUndefined();});
 it('does not let an old rejected play promise fail the next attempt',async()=>{setup();let rejectOld:(error:Error)=>void=()=>{};vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(()=>new Promise((_,reject)=>{rejectOld=reject;}));act(()=>player.playSong(queue[0],queue));await act(async()=>player.playSong(queue[1],queue));await act(async()=>rejectOld(new Error('old stream failed')));expect(player.playbackAttempts[0].title).toBe('Mix 2');expect(player.playbackAttempts[0].status).toBe('waiting');expect(player.playbackAttempts[1].status).toBe('cancelled');});
 it('records errors as failures before advancing to the next mix',async()=>{setup();await act(async()=>player.playSong(queue[0],queue));act(()=>audio.dispatchEvent(new Event('error')));expect(player.playbackAttempts[1].status).toBe('failed');expect(player.playbackAttempts[0].kind).toBe('Track start');});
});

describe('recovering cached playback without refreshing',()=>{
 const old={...song('1'),audioUrl:'https://s3.us-east-005.backblazeb2.com/bucket/old.mp3'};
 const cached='https://audio.djpapzin.com/tracks/1/cached/abcdefabcdefabcdefabcdef';
 const fresh=()=>({ok:true,json:async()=>({id:1,file_path:old.audioUrl,availability:'public',cached_audio_url:cached})});
 afterEach(()=>vi.unstubAllGlobals());
 it('refreshes a stale link once, keeps mute and records success for the same attempt',async()=>{
  const fetcher=vi.fn().mockResolvedValue(fresh());vi.stubGlobal('fetch',fetcher);setup();
  await act(async()=>{player.setVolume(0);player.playSong(old,[old,queue[1]]);});
  vi.mocked(HTMLMediaElement.prototype.load).mockImplementation(function(this:HTMLMediaElement){this.dispatchEvent(new Event('pause'));});
  paused=true;
  Object.defineProperty(audio,'error',{configurable:true,value:{code:4}});
  act(()=>audio.dispatchEvent(new Event('pause')));
  await act(async()=>audio.dispatchEvent(new Event('error')));
  expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toMatch(/\/tracks\/1$/);
  expect(audio.src).toBe(cached);expect(audio.muted).toBe(true);expect(player.playerState.currentSong?.id).toBe('1');
  Object.defineProperty(audio,'readyState',{configurable:true,value:4});act(()=>audio.dispatchEvent(new Event('playing')));
  expect(player.playbackAttempts).toHaveLength(1);expect(player.playbackAttempts[0].status).toBe('started');
 });
 it('retries a failed cached link once, then advances without looping',async()=>{
  const fetcher=vi.fn().mockResolvedValue(fresh());vi.stubGlobal('fetch',fetcher);setup();
  await act(async()=>player.playSong({...old,audioUrl:cached},[old,queue[1]]));
  await act(async()=>audio.dispatchEvent(new Event('error')));await act(async()=>audio.dispatchEvent(new Event('error')));
  expect(fetcher).toHaveBeenCalledTimes(1);expect(player.playerState.currentSong?.id).toBe('2');
 });
 it.each(['pause','next'])('does not restart after %s during recovery',async action=>{
  let resolve!:(v:ReturnType<typeof fresh>)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));setup();
  await act(async()=>player.playSong(old,[old,queue[1]]));act(()=>audio.dispatchEvent(new Event('error')));
  act(()=>action==='pause'?player.togglePlay():player.handleNext());const before=audio.src;
  await act(async()=>resolve(fresh()));expect(audio.src).toBe(before);expect(player.playerState.currentSong?.id).toBe(action==='pause'?'1':'2');
  if(action==='pause')expect(audio.paused).toBe(true);
 });
 it('recovers a rejected play promise too',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(fresh()));vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('unavailable','NotSupportedError'));setup();
  await act(async()=>player.playSong(old,[old,queue[1]]));expect(audio.src).toBe(cached);expect(player.playerState.currentSong?.id).toBe('1');
 });
 it('does not retry autoplay denial or expose an unlisted result',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:1,file_path:old.audioUrl,availability:'unlisted',cached_audio_url:cached})});vi.stubGlobal('fetch',fetcher);setup();
  vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('gesture required','NotAllowedError'));
  await act(async()=>player.playSong(old,[old,queue[1]]));expect(fetcher).not.toHaveBeenCalled();
  await act(async()=>player.playSong(old,[old,queue[1]]));await act(async()=>audio.dispatchEvent(new Event('error')));
  expect(player.playerState.currentSong?.id).toBe('2');expect(audio.src).not.toBe(cached);
 });
});
