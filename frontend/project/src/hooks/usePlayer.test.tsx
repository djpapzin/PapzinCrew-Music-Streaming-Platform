import { act, render, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { usePlayer, VOLUME_KEY } from './usePlayer';
import { Song } from '../types/music';
let player:ReturnType<typeof usePlayer>;let audio:HTMLAudioElement;let paused=true;
let catalog:Song[]=[];
function Harness(){player=usePlayer(catalog);if(player.audioRef.current)audio=player.audioRef.current;return <><audio ref={player.nativeAudioRef}/><audio ref={player.firstAudioRef}/><audio ref={player.secondAudioRef}/></>;}
const song=(id:string):Song=>({id,title:`Mix ${id}`,artist:'DJ Papzin',album:'',duration:100,imageUrl:'',audioUrl:`https://example.com/tracks/${id}/stream`,genre:'House',year:2020});
const queue=[song('1'),song('2'),song('3')];
beforeEach(()=>{localStorage.clear();catalog=[];paused=true;vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(function(this:HTMLMediaElement){paused=false;this.dispatchEvent(new Event('play'));return Promise.resolve();});vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(function(this:HTMLMediaElement){paused=true;this.dispatchEvent(new Event('pause'));});vi.spyOn(HTMLMediaElement.prototype,'paused','get').mockImplementation(()=>paused);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function setup(){render(<Harness/>);audio=player.audioRef.current!;for(const deck of [player.nativeAudioRef.current!,player.firstAudioRef.current!,player.secondAudioRef.current!])Object.defineProperty(deck,'duration',{configurable:true,value:100});}
describe('playback regressions',()=>{
  it('reacquires the iPhone audio session on lock-screen resume without reloading or seeking',async()=>{
    const categories:string[]=[];
    const handlers=new Map<string,()=>void>();
    const session={playbackState:'none',setActionHandler:vi.fn((name:string,handler:()=>void)=>handlers.set(name,handler))};
    const userAgent=vi.spyOn(navigator,'userAgent','get').mockReturnValue('iPhone');
    const audioSession=Object.getOwnPropertyDescriptor(navigator,'audioSession');
    const mediaSession=Object.getOwnPropertyDescriptor(navigator,'mediaSession');
    Object.defineProperty(navigator,'audioSession',{configurable:true,value:{set type(value:string){categories.push(value);}}});
    Object.defineProperty(navigator,'mediaSession',{configurable:true,value:session});
    vi.stubGlobal('MediaMetadata',class {constructor(_value:unknown){}});
    try {
      setup();await act(async()=>player.playSong(queue[0],queue));
      expect(categories).toEqual(['playback']);expect(session.playbackState).toBe('playing');
      audio.currentTime=25;const source=audio.src;const loads=vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length;
      act(()=>handlers.get('pause')!());expect(session.playbackState).toBe('paused');
      await act(async()=>handlers.get('play')!());
      expect(categories).toEqual(['playback','auto','playback']);
      expect(session.playbackState).toBe('playing');expect(audio.src).toBe(source);expect(audio.currentTime).toBe(25);
      expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(loads);
      // A duplicate system Play must not reset a stream already playing.
      await act(async()=>handlers.get('play')!());expect(categories.slice(-1)).toEqual(['playback']);expect(categories.filter(c=>c==='auto')).toHaveLength(1);
      act(()=>handlers.get('pause')!());act(()=>player.setVolume(0));await act(async()=>player.togglePlay());
      expect(audio.muted).toBe(true);expect(audio.currentTime).toBe(25);
    } finally {
      if(audioSession)Object.defineProperty(navigator,'audioSession',audioSession);else delete (navigator as Navigator & {audioSession?:unknown}).audioSession;
      if(mediaSession)Object.defineProperty(navigator,'mediaSession',mediaSession);else Reflect.deleteProperty(navigator,'mediaSession');
      userAgent.mockRestore();vi.unstubAllGlobals();
    }
  });
  it('uses the supplied stream without rewriting it to the proxy',async()=>{setup();await act(async()=>player.playSong(queue[0]));expect(audio.src).toBe(queue[0].audioUrl);});
  it('preserves mute across automatic track changes using current queue state',async()=>{setup();await act(async()=>{player.setVolume(0);player.playSong(queue[0],queue);});expect(audio.volume).toBe(0);expect(audio.muted).toBe(true);await act(async()=>audio.dispatchEvent(new Event('ended')));expect(player.playerState.currentSong?.id).toBe('2');expect(audio.muted).toBe(true);await act(async()=>audio.dispatchEvent(new Event('ended')));expect(player.playerState.currentSong?.id).toBe('3');expect(localStorage.getItem(VOLUME_KEY)).toBe('0');});
  it('repeats one on ended, but Next still changes tracks',async()=>{setup();await act(async()=>{player.playSong(queue[0],queue);player.toggleRepeat();player.toggleRepeat();});audio.currentTime=99;await act(async()=>audio.dispatchEvent(new Event('ended')));expect(player.playerState.currentSong?.id).toBe('1');expect(audio.currentTime).toBe(0);await act(async()=>player.handleNext());expect(player.playerState.currentSong?.id).toBe('2');});
  it('continues automatically at the end with repeat on or off',async()=>{setup();await act(async()=>{player.playSong(queue[2],queue);player.toggleRepeat();audio.dispatchEvent(new Event('ended'));});expect(player.playerState.currentSong?.id).toBe('1');await act(async()=>{player.toggleRepeat();player.toggleRepeat();player.playSong(queue[2],queue);audio.dispatchEvent(new Event('ended'));});expect(player.playerState.currentSong?.id).toBe('1');expect(audio.paused).toBe(false);});
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
 it('retries a network failure on the current cache route even when metadata is offline',async()=>{
  const fetcher=vi.fn().mockRejectedValue(new TypeError('network unavailable'));vi.stubGlobal('fetch',fetcher);setup();
  await act(async()=>{player.setVolume(0);player.playSong({...old,audioUrl:cached},[{...old,audioUrl:cached},queue[1]]);});
  audio.currentTime=25;Object.defineProperty(audio,'error',{configurable:true,value:{code:2}});
  await act(async()=>audio.dispatchEvent(new Event('error')));
  expect(fetcher).not.toHaveBeenCalled();expect(audio.src).toBe(cached);expect(audio.currentTime).toBe(25);expect(audio.muted).toBe(true);
  expect(player.playerState.currentSong?.id).toBe('1');expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  await act(async()=>audio.dispatchEvent(new Event('error')));
  expect(player.playerState.currentSong?.id).toBe('2');expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(3);
 });
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
 it.each(['seek','previous'])('preserves %s during recovery instead of the failed position',async action=>{
  let resolve!:(v:ReturnType<typeof fresh>)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise(r=>{resolve=r;})));setup();
  await act(async()=>player.playSong(old,[old,queue[1]]));audio.currentTime=60;
  act(()=>audio.dispatchEvent(new Event('error')));
  act(()=>action==='seek'?player.seekTo(25):player.handlePrevious());
  await act(async()=>resolve(fresh()));expect(audio.currentTime).toBe(action==='seek'?25:0);
 });
 it('does not count the silent metadata wait as listening time',async()=>{
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  const events:Array<{kind:string;value:number}>=[];let resolve!:(v:ReturnType<typeof fresh>)=>void;
  vi.stubGlobal('location',{hostname:'crew.djpapzin.com',origin:'https://crew.djpapzin.com',pathname:'/'});
  vi.spyOn(performance,'now').mockReturnValue(1000);
  vi.stubGlobal('fetch',vi.fn((input,options)=>{
   if(String(input).endsWith('/usage')){events.push(JSON.parse(options.body));return Promise.resolve({ok:true});}
   return new Promise(r=>{resolve=r;});
  }));setup();await act(async()=>player.playSong(old,[old,queue[1]]));
  Object.defineProperty(audio,'readyState',{configurable:true,value:4});act(()=>audio.dispatchEvent(new Event('playing')));
  vi.mocked(performance.now).mockReturnValue(2000);act(()=>audio.dispatchEvent(new Event('error')));
  vi.mocked(performance.now).mockReturnValue(6000);await act(async()=>resolve(fresh()));
  expect(events.filter(e=>e.kind==='listen')).toEqual([expect.objectContaining({value:1000})]);
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

describe('manual Next continuation',()=>{
 it('advances newest to older and wraps even with repeat off',async()=>{
  setup();const recent=[song('245'),song('241'),song('47')];
  await act(async()=>{player.setVolume(0);player.playSong(recent[0],recent);});
  for(const id of ['241','47','245']){await act(async()=>player.handleNext());expect(player.playerState.currentSong?.id).toBe(id);expect(audio.paused).toBe(false);expect(audio.muted).toBe(true);}
 });
 it.each([0,1,2])('continues a one-track selection using the latest catalog (repeat toggles: %s)',async toggles=>{
  catalog=[song('47'),song('245'),song('241')];setup();
  await act(async()=>{player.playSong(song('245'));for(let i=0;i<toggles;i++)player.toggleRepeat();});
  await act(async()=>player.handleNext());expect(player.playerState.currentSong?.id).toBe('241');
 });
 it('skips failed tracks when wrapping and stops when all alternatives failed',async()=>{
  setup();await act(async()=>player.playSong(queue[0],queue));
  await act(async()=>audio.dispatchEvent(new Event('error')));
  await act(async()=>player.playSong(queue[2],queue));
  await act(async()=>player.handleNext());expect(player.playerState.currentSong?.id).toBe('2');
  await act(async()=>{audio.dispatchEvent(new Event('error'));audio.dispatchEvent(new Event('error'));});expect(audio.paused).toBe(true);
 });
});
