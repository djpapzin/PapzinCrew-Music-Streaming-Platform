import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayer, VOLUME_KEY } from './usePlayer';
import type { Song } from '../types/music';

class Parameter {
  value = 1;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn();
}
class Context {
  static latest: Context;
  state = 'running'; currentTime = 0; destination = {};
  nodes: Array<{gain: Parameter; connect: ReturnType<typeof vi.fn>}> = [];
  sources = new Map<HTMLMediaElement, {gain: Parameter}>();
  constructor() { Context.latest = this; }
  createGain() { const node = {gain: new Parameter(), connect: vi.fn()}; this.nodes.push(node); return node; }
  createMediaElementSource(audio: HTMLMediaElement) { return {connect: (gain: {gain: Parameter}) => { this.sources.set(audio, gain); }}; }
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
}
const mix = (id: string): Song => ({id,title:`Mix ${id}`,artist:'DJ',album:'',duration:100,imageUrl:'',audioUrl:`/audio/${id}.wav`,genre:'House',year:2026});
const catalog = [mix('1'),mix('3'),mix('2')];
const recent = [catalog[1],catalog[2],catalog[0]];
let player: ReturnType<typeof usePlayer>;
let paused: WeakMap<HTMLMediaElement, boolean>;
function Harness() { player = usePlayer(catalog); return <><audio ref={player.nativeAudioRef}/><audio ref={player.firstAudioRef}/><audio ref={player.secondAudioRef}/></>; }
const outgoing = () => player.firstAudioRef.current!;
const incoming = () => player.secondAudioRef.current!;
const emit = async (audio: HTMLMediaElement, name: string) => { await act(async () => { audio.dispatchEvent(new Event(name)); }); };
async function setup() {
  render(<Harness/>);
  for (const audio of [outgoing(), incoming()]) {
    Object.defineProperty(audio,'duration',{configurable:true,value:100});
    Object.defineProperty(audio,'readyState',{configurable:true,value:4});
  }
  await act(async () => { player.setVolume(0); player.playSong(recent[0],recent); });
  await emit(outgoing(),'playing');
}
async function startFade() { outgoing().currentTime = 90; await emit(outgoing(),'timeupdate'); await emit(incoming(),'playing'); }
beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear(); localStorage.setItem(VOLUME_KEY,'0'); paused = new WeakMap();
  vi.stubGlobal('AudioContext',Context);
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype,'paused','get').mockImplementation(function(this:HTMLMediaElement){return paused.get(this) ?? true;});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(function(this:HTMLMediaElement){paused.set(this,false);this.dispatchEvent(new Event('play'));return Promise.resolve();});
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(function(this:HTMLMediaElement){paused.set(this,true);this.dispatchEvent(new Event('pause'));});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('automatic ten-second transitions',() => {
  it('waits for decoded incoming playback, then fades on the audio clock without reloading either mix',async () => {
    await setup(); outgoing().currentTime = 89; await emit(outgoing(),'timeupdate'); expect(incoming().getAttribute('src')).toBeNull();
    outgoing().currentTime = 90; await emit(outgoing(),'timeupdate');
    expect(player.playerState.currentSong?.id).toBe('3'); expect(outgoing().paused).toBe(false);
    const from = Context.latest.sources.get(outgoing())!.gain;
    const to = Context.latest.sources.get(incoming())!.gain;
    expect(from.linearRampToValueAtTime).not.toHaveBeenCalled();
    await emit(incoming(),'playing');
    expect(player.playerState.currentSong?.id).toBe('2'); expect(player.audioRef.current).toBe(incoming()); expect(player.playerState.transitioning).toBe(true);
    expect(from.linearRampToValueAtTime).toHaveBeenCalledWith(0,10); expect(to.linearRampToValueAtTime).toHaveBeenCalledWith(1,10);
    expect(outgoing().paused).toBe(false); expect(incoming().paused).toBe(false);
    expect(outgoing().muted).toBe(true); expect(incoming().muted).toBe(true);
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(outgoing().paused).toBe(true); expect(outgoing().getAttribute('src')).toBeNull(); expect(incoming().paused).toBe(false);
    expect(player.playerState.transitioning).toBe(false);
  });
  it('shortens the overlap if the next stream takes time to become ready',async () => {
    await setup(); outgoing().currentTime=90; await emit(outgoing(),'timeupdate'); outgoing().currentTime=94;
    await emit(incoming(),'playing'); expect(Context.latest.sources.get(incoming())!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1,6);
  });
  it('ignores outgoing time, pause and ended events after the new mix takes over',async () => {
    await setup(); await startFade(); incoming().currentTime=4; await emit(incoming(),'timeupdate');
    await emit(outgoing(),'timeupdate'); expect(player.playerState.currentTime).toBe(4);
    await emit(outgoing(),'ended'); expect(player.playerState.currentSong?.id).toBe('2'); expect(player.playerState.isPlaying).toBe(true);
    await emit(incoming(),'ended'); expect(player.playerState.currentSong?.id).toBe('1');
  });
  it('keeps both decks muted during volume changes and applies volume only once through master gain',async () => {
    await setup(); await startFade(); await act(async () => { player.setVolume(0.4); });
    expect(Context.latest.nodes[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0.4,0);
    expect(outgoing().volume).toBe(1); expect(incoming().volume).toBe(1);
    await act(async () => { player.setVolume(0); }); expect(outgoing().muted).toBe(true); expect(incoming().muted).toBe(true);
  });
  it.each(['pause','seek','next'])('cancels the outgoing tail on %s without a delayed restart',async action => {
    await setup(); await startFade();
    await act(async () => { if(action==='pause')player.togglePlay();else if(action==='seek')player.seekTo(25);else player.handleNext(); });
    expect(outgoing().paused).toBe(true); expect(player.playerState.transitioning).toBe(false);
    await act(async () => { vi.advanceTimersByTime(12000); });
    expect(player.playerState.currentSong?.id).toBe(action==='next'?'1':'2');
    if(action==='pause')expect(incoming().paused).toBe(true);
    if(action==='seek')expect(incoming().currentTime).toBe(25);
  });
  it('cancels a pending transition when paused and ignores late playing events',async () => {
    await setup(); outgoing().currentTime=90; await emit(outgoing(),'timeupdate');
    await act(async () => { player.togglePlay(); }); await emit(incoming(),'playing');
    expect(player.playerState.currentSong?.id).toBe('3'); expect(player.playerState.isPlaying).toBe(false); expect(incoming().getAttribute('src')).toBeNull();
  });
  it('falls back to normal auto-next if overlap playback is rejected',async () => {
    await setup(); vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException('gesture required','NotAllowedError'));
    outgoing().currentTime=90; await emit(outgoing(),'timeupdate'); expect(player.playerState.currentSong?.id).toBe('3'); expect(outgoing().paused).toBe(false);
    await emit(outgoing(),'ended'); expect(player.playerState.currentSong?.id).toBe('2'); expect(player.audioRef.current).toBe(outgoing()); expect(outgoing().paused).toBe(false);
  });
  it('stops the tail when the OS pauses the active media element',async () => {
    await setup(); await startFade(); await act(async () => { incoming().pause(); });
    expect(outgoing().paused).toBe(true); expect(player.playerState.isPlaying).toBe(false); expect(player.playerState.transitioning).toBe(false);
  });
  it('restores full incoming level when the outgoing tail fails',async () => {
    await setup(); await startFade(); await emit(outgoing(),'error');
    expect(player.playerState.currentSong?.id).toBe('2'); expect(incoming().paused).toBe(false); expect(player.playerState.transitioning).toBe(false);
    expect(Context.latest.sources.get(incoming())!.gain.setValueAtTime).toHaveBeenLastCalledWith(1,0);
  });
  it('measures crossfade startup from the incoming request instead of reporting a zero-time start',async () => {
    await setup(); vi.spyOn(performance,'now').mockReturnValue(1000);
    outgoing().currentTime=90; await emit(outgoing(),'timeupdate');
    vi.mocked(performance.now).mockReturnValue(2500); await emit(incoming(),'playing');
    expect(player.playbackAttempts[0].milliseconds).toBe(1500);
  });
  it('retains repeat-one without starting a second mix',async () => {
    await setup(); await act(async () => { player.toggleRepeat(); player.toggleRepeat(); });
    outgoing().currentTime=90; await emit(outgoing(),'timeupdate'); expect(incoming().getAttribute('src')).toBeNull();
    await emit(outgoing(),'ended'); expect(player.playerState.currentSong?.id).toBe('3'); expect(outgoing().currentTime).toBe(0);
  });
  it('uses the catalog after a single selection finishes, and wraps automatically with repeat off',async () => {
    await setup(); await act(async () => { player.playSong(recent[0]); });
    await emit(outgoing(),'ended'); expect(player.playerState.currentSong?.id).toBe('2');
    await act(async () => { player.playSong(recent[2],recent); });
    await emit(outgoing(),'ended'); expect(player.playerState.currentSong?.id).toBe('3');
  });
  it('keeps legacy and access-checked streams on the native deck without CORS or a Web Audio source',async () => {
    await setup(); await startFade();
    const legacy={...mix('99'),audioUrl:'https://bucket.backblazeb2.com/legacy.mp3'};
    await act(async()=>player.playSong(legacy,[legacy,...recent]));
    const native=player.nativeAudioRef.current!;
    expect(player.audioRef.current).toBe(native);expect(native.src).toBe(legacy.audioUrl);
    expect(Context.latest.sources.has(native)).toBe(false);expect(outgoing().paused).toBe(true);expect(incoming().paused).toBe(true);
    await emit(native,'ended');expect(player.playerState.currentSong?.id).toBe('3');expect(player.audioRef.current).toBe(outgoing());
  });
  it('stops cleanly when there is no other playable mix',async () => {
    // An exhausted catalog remains bounded rather than retrying failed streams forever.
    await setup(); await emit(outgoing(),'error'); await emit(outgoing(),'error'); await emit(outgoing(),'error');
    expect(player.playerState.isPlaying).toBe(false);
  });
});
