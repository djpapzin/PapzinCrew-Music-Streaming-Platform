import { createPlaybackUsage, LISTEN_FLUSH_INTERVAL_MS } from '../lib/anonymousUsage';
import { useState, useRef, useEffect } from 'react';
import { Song, PlayerState } from '../types/music';
import { usePlaybackTiming } from './usePlaybackTiming';
import { canRecoverPlayback, recoverPlaybackUrl } from '../lib/recoverPlayback';
import { MixAudio } from '../lib/mixAudio';
import { mixPlaybackUrl } from '../lib/mixPlaybackUrl';
export const CROSSFADE_SECONDS = 10;
const CROSSFADE_PRELOAD_SECONDS = 45;
// Allow for timeupdate cadence and the buffered deck's play startup.
const CROSSFADE_START_LEAD_SECONDS = 0.5;
interface MixTransition { incoming: HTMLAudioElement; outgoing: HTMLAudioElement; song: Song; queue: Song[]; queueAtRequest: Song[]; started: boolean; requestedAt: number; timer?: number }

export const VOLUME_KEY = 'papzincrew:volume';
const initialVolume = () => {
  try { const saved = localStorage.getItem(VOLUME_KEY); const n = Number(saved); return saved !== null && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.7; } catch { return 0.7; }
};
const available = (song: Song) => !!song.audioUrl && song.playable !== false;

export const usePlayer = (catalog: Song[] = []) => {
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const timing = usePlaybackTiming();
  const usage = useRef(createPlaybackUsage());
  const nativeAudioRef = useRef<HTMLAudioElement>(null);
  const firstAudioRef = useRef<HTMLAudioElement>(null);
  const secondAudioRef = useRef<HTMLAudioElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mixer = useRef(new MixAudio());
  const overlap = useRef<MixTransition | null>(null);
  const fadeSkipped = useRef(false);
  const [playerState, setPlayerState] = useState<PlayerState>({ currentSong: null, isPlaying: false, volume: initialVolume(), currentTime: 0, duration: 0, queue: [], currentIndex: -1, shuffle: false, repeat: 'none' });
  const stateRef = useRef(playerState);
  const failed = useRef(new Set<string>());
  const generation = useRef(0);
  const recovery = useRef<{ controller: AbortController; timer: number; position: number } | null>(null);
  const retried = useRef(false);
  const internalReload = useRef(false);
  const failureAction = useRef((_code?: number) => {});
  const cancelRecovery = () => {
    generation.current++; internalReload.current = false;
    if (recovery.current) { recovery.current.controller.abort(); window.clearTimeout(recovery.current.timer); recovery.current = null; }
  };
  const actions = useRef({ next: (_ended = false) => {}, previous: () => {}, seek: (_time: number) => {}, crossfade: () => {} });
  const update = (change: Partial<PlayerState>) => {
    stateRef.current = { ...stateRef.current, ...change };
    setPlayerState(stateRef.current);
  };
  const notify = (message: string) => window.dispatchEvent(new CustomEvent('app:toast', { detail: { message } }));
  const mixDecks = () => [firstAudioRef.current, secondAudioRef.current].filter((audio): audio is HTMLAudioElement => !!audio);
  const decks = () => [nativeAudioRef.current, ...mixDecks()].filter((audio): audio is HTMLAudioElement => !!audio);
  const applyVolume = () => {
    const volume = stateRef.current.volume;
    mixer.current.volume(volume);
    for (const audio of decks()) { audio.volume = mixer.current.enabled && audio !== nativeAudioRef.current ? 1 : volume; audio.muted = volume === 0; }
  };
  const cancelOverlap = () => {
    const transition = overlap.current;
    overlap.current = null;
    if (transition?.timer) window.clearTimeout(transition.timer);
    for (const audio of decks()) {
      if (audio !== audioRef.current) { mixer.current.level(audio, 0); if (audio.getAttribute('src')) { audio.pause(); audio.removeAttribute('src'); audio.load(); } }
      else mixer.current.level(audio, 1);
    }
  };
  const requestPlay = (attemptId?: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if(attemptId===undefined)usage.current.begin(stateRef.current.currentSong?.id||'0',true);
    const id = attemptId ?? timing.begin(stateRef.current.currentSong?.title || 'Mix', 'Resume');
    const token = generation.current;
    // Declare long-form music playback before starting the media element.
    // iOS uses this session category when the browser is backgrounded or locked.
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
    } catch { /* AudioSession is optional on older browsers. */ }
    if (audio !== nativeAudioRef.current) { mixer.current.enable(mixDecks(), audio, stateRef.current.volume); mixer.current.level(audio, 1); }
    applyVolume();
    // Start both in the same user gesture; awaiting resume first loses the
    // media-element activation on some mobile browsers.
    const resumed = audio !== nativeAudioRef.current ? mixer.current.resume() : undefined;
    void Promise.all([resumed, audio.play()]).catch((err: Error) => {
      if (generation.current !== token || timing.pending.current?.id !== id || recovery.current) return;
      if (err.name === 'AbortError') { internalReload.current = false; timing.finish('cancelled', id); usage.current.cancel(); return; }
      if (err.name === 'NotAllowedError') {
        internalReload.current = false; timing.finish('cancelled', id); usage.current.cancel(); update({ isPlaying: false }); notify('Tap Play to start listening.'); return;
      }
      failureAction.current(audio.error?.code);
    });
  };

  const playSong = (song: Song, queue: Song[] = [song]) => {
    const previous = audioRef.current;
    const mixedUrl = mixPlaybackUrl(song);
    const audio = mixedUrl ? (mixDecks().includes(previous!) ? previous : firstAudioRef.current) : nativeAudioRef.current;
    if (!audio || !available(song)) { notify('This track is unavailable.'); return; }
    const playableQueue = queue.filter(available);
    if (!playableQueue.some(item => item.id === song.id)) playableQueue.unshift(song);
    const kind = stateRef.current.currentSong ? 'Track start' : 'First play';
    cancelRecovery(); cancelOverlap(); fadeSkipped.current = false; retried.current = false;
    previous?.pause();
    audioRef.current = audio;
    usage.current.begin(song.id,false);
    const attemptId = timing.begin(song.title, kind);
    update({ currentSong: song, currentIndex: playableQueue.findIndex(item => item.id === song.id), queue: playableQueue, currentTime: 0, duration: song.duration || 0, isPlaying: false, transitioning:false });
    audio.src = mixedUrl || song.audioUrl;
    audio.load();
    requestPlay(attemptId);
    window.dispatchEvent(new CustomEvent('library:played', { detail: song.id }));
  };
  const nextSelection = (ended = false): { song: Song; queue: Song[] } | null => {
    const { queue, currentIndex, shuffle, repeat, currentSong } = stateRef.current;
    if (ended && repeat === 'one' && currentSong && !failed.current.has(currentSong.id)) return { song: currentSong, queue };
    const candidates = queue.filter(song => available(song) && !failed.current.has(song.id) && song.id !== currentSong?.id);
    if (shuffle && candidates.length) return { song: candidates[Math.floor(Math.random() * candidates.length)], queue };
    const next = queue.slice(currentIndex + 1).find(song => candidates.includes(song)) ?? candidates[0];
    if (next) return { song: next, queue };
    const fallback = catalogRef.current.filter(song => available(song) && !failed.current.has(song.id))
      .sort((a, b) => Number(b.id) - Number(a.id));
    const index = fallback.findIndex(song => song.id === currentSong?.id);
    const extra = fallback.slice(index + 1).find(song => song.id !== currentSong?.id)
      ?? fallback.find(song => song.id !== currentSong?.id);
    if (extra) return { song: extra, queue: fallback };
    return ended && repeat === 'all' && currentSong && !failed.current.has(currentSong.id) ? { song: currentSong, queue } : null;
  };
  const handleNext = (ended = false) => {
    const audio = audioRef.current;
    if (!audio) return;
    cancelRecovery(); cancelOverlap(); update({transitioning:false});
    const next = nextSelection(ended);
    if (!next) { audio.pause(); update({isPlaying:false}); return; }
    if (ended && next.song.id === stateRef.current.currentSong?.id) {
      audio.currentTime = 0; update({currentTime:0}); requestPlay(); return;
    }
    playSong(next.song, next.queue);
  };
  const crossfade = () => {
    const outgoing = audioRef.current;
    if (!outgoing || !mixDecks().includes(outgoing) || outgoing.paused || outgoing.seeking || recovery.current || overlap.current || fadeSkipped.current
      || stateRef.current.repeat === 'one' || !mixer.current.running) return;
    const remaining = outgoing.duration - outgoing.currentTime;
    const shouldFade = remaining <= CROSSFADE_SECONDS;
    if (!Number.isFinite(remaining) || remaining <= 0 || remaining > CROSSFADE_PRELOAD_SECONDS) return;
    // Shuffle chooses a fresh candidate at transition time.
    if (!shouldFade && stateRef.current.shuffle) return;
    const next = nextSelection();
    const incoming = mixDecks().find(audio => audio !== outgoing);
    if (!next || next.song.id === stateRef.current.currentSong?.id || !incoming) return;
    const nextUrl = mixPlaybackUrl(next.song);
    if (!nextUrl) return;
    const isPreloaded = incoming.getAttribute('src') === nextUrl && !incoming.error;
    const canStartEarly = isPreloaded && incoming.readyState >= 3
      && remaining <= CROSSFADE_SECONDS + CROSSFADE_START_LEAD_SECONDS;
    if (!isPreloaded && (incoming.getAttribute('src') !== nextUrl || shouldFade)) {
      incoming.preload = 'auto';
      mixer.current.level(incoming, 0);
      incoming.src = nextUrl;
      incoming.load();
    }
    if (!shouldFade && !canStartEarly) return;
    const transition: MixTransition = { incoming, outgoing, song: next.song, queue: next.queue, queueAtRequest: stateRef.current.queue, started: false, requestedAt: performance.now() };
    overlap.current = transition;
    applyVolume();
    // Don't fade the outgoing mix until the new deck emits `playing`.
    void incoming.play().catch(() => {
      if (overlap.current !== transition) return;
      fadeSkipped.current = true; cancelOverlap();
    });
  };
  const acceptIncoming = (incoming: HTMLAudioElement) => {
    const transition = overlap.current;
    if (!transition || transition.incoming !== incoming || transition.started || incoming.paused || incoming.readyState < 2) return;
    transition.started = true;
    cancelRecovery(); retried.current = false; fadeSkipped.current = false;
    usage.current.begin(transition.song.id, false, transition.requestedAt);
    timing.begin(transition.song.title, 'Track start', transition.requestedAt); timing.finish('started'); usage.current.started();
    audioRef.current = incoming;
    // Queue additions are immutable appends; retain anything added while this
    // deck was loading, including when the next selection used the catalog.
    const additions = stateRef.current.queue.filter(song => !transition.queueAtRequest.some(item => item.id === song.id)
      && !transition.queue.some(item => item.id === song.id));
    const queue = [...transition.queue, ...additions];
    update({ currentSong: transition.song, queue, currentIndex: queue.findIndex(song => song.id === transition.song.id),
      currentTime: incoming.currentTime, duration: Number.isFinite(incoming.duration) ? incoming.duration : transition.song.duration, isPlaying: true });
    window.dispatchEvent(new CustomEvent('library:played', { detail: transition.song.id }));
    const seconds = Math.max(0, Math.min(CROSSFADE_SECONDS, transition.outgoing.duration - transition.outgoing.currentTime));
    mixer.current.level(transition.outgoing, 0, seconds);
    mixer.current.level(incoming, 1, seconds);
    update({ transitioning: seconds > 0 });
    transition.timer = window.setTimeout(() => { if (overlap.current === transition) { cancelOverlap(); update({transitioning:false}); } }, seconds * 1000);
  };
  const handlePrevious = () => {
    const audio = audioRef.current;
    const { queue, currentIndex } = stateRef.current;
    if (!audio || !queue.length) return;
    cancelOverlap(); update({transitioning:false}); fadeSkipped.current = false;
    if (audio.currentTime > 3 || currentIndex === 0) { if (recovery.current) recovery.current.position = 0; audio.currentTime = 0; update({currentTime:0}); return; }
    playSong(queue[currentIndex - 1], queue);
  };
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !stateRef.current.currentSong) return;
    if (recovery.current || internalReload.current || !audio.paused) { cancelRecovery(); cancelOverlap(); update({transitioning:false}); usage.current.cancel(); timing.endBuffer(); timing.finish('cancelled'); audio.pause(); update({isPlaying:false}); } else { retried.current = false; requestPlay(); }
  };
  const setVolume = (value: number) => {
    const volume = Math.max(0, Math.min(1, value));
    update({volume}); applyVolume();
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
  };
  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(time)) return;
    cancelOverlap(); update({transitioning:false}); fadeSkipped.current = false;
    const duration = Number.isFinite(audio.duration) ? audio.duration : stateRef.current.duration;
    const currentTime = Math.max(0, Math.min(time, duration));
    if (recovery.current) recovery.current.position = currentTime;
    audio.currentTime = currentTime;
    update({currentTime});
  };
  failureAction.current = (code?: number) => {
    const audio = audioRef.current;
    const song = stateRef.current.currentSong;
    if (!audio || !song || recovery.current) return;
    cancelOverlap(); update({transitioning:false});
    usage.current.stop(); timing.endBuffer();
    const fail = () => {
      internalReload.current = false;
      usage.current.failed(); timing.endBuffer(); timing.finish('failed');
      failed.current.add(song.id);
      notify('This track could not be played. Trying the next track.');
      actions.current.next();
    };
    if (retried.current || code === 3 || !canRecoverPlayback(song)) { fail(); return; }
    retried.current = true;
    const token = generation.current;
    const attemptId = timing.pending.current?.id;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    recovery.current = { controller, timer, position: audio.currentTime || stateRef.current.currentTime || 0 };
    void recoverPlaybackUrl(song, controller.signal, code).catch(() => null).then(url => {
      if (generation.current !== token) return;
      const position = recovery.current?.position || 0;
      window.clearTimeout(timer); recovery.current = null;
      if (!url) { fail(); return; }
      const refreshed = { ...song, audioUrl: url };
      update({ currentSong: refreshed, queue: stateRef.current.queue.map(item => item.id === song.id ? refreshed : item) });
      generation.current++; internalReload.current = true;
      audio.src = audio === nativeAudioRef.current ? url : (mixPlaybackUrl(refreshed) || url); audio.load();
      if (position > 0) audio.currentTime = position;
      requestPlay(attemptId);
    });
  };
  useEffect(() => () => { cancelRecovery(); cancelOverlap(); mixer.current.close(); }, []);
  useEffect(() => {
    const queueTrack = (e: Event) => {
      const song = (e as CustomEvent<Song>).detail;
      if (!song || !available(song)) return;
      const state = stateRef.current;
      if (!state.currentSong) { playSong(song); return; }
      if (state.queue.some(item => item.id === song.id)) { notify('This track is already in the queue.'); return; }
      update({queue: [...state.queue, song]});
      notify('Track added to queue.');
    };
    window.addEventListener('player:queue', queueTrack);
    return () => window.removeEventListener('player:queue', queueTrack);
  }, []);
  const toggleShuffle = () => { cancelOverlap(); update({shuffle: !stateRef.current.shuffle, transitioning:false}); };
  const toggleRepeat = () => { cancelOverlap(); update({repeat: stateRef.current.repeat === 'none' ? 'all' : stateRef.current.repeat === 'all' ? 'one' : 'none', transitioning:false}); };
  actions.current = { next: handleNext, previous: handlePrevious, seek: seekTo, crossfade };

  useEffect(() => {
    audioRef.current = nativeAudioRef.current;
    const cleanups = decks().map(audio => {
      audio.volume = stateRef.current.volume;
      audio.muted = stateRef.current.volume === 0;
      const active = () => audio === audioRef.current;
      const sync = () => {
        if (!active()) return;
        const duration = Number.isFinite(audio.duration) ? audio.duration : stateRef.current.duration;
        update({currentTime: audio.currentTime || 0, duration});
        actions.current.crossfade();
        try {
          if (duration > 0 && navigator.mediaSession?.setPositionState) navigator.mediaSession.setPositionState({ duration, position: Math.min(audio.currentTime || 0, duration), playbackRate: audio.playbackRate || 1 });
        } catch { /* MediaSession is optional. */ }
      };
      const playing = () => { if (active()) update({isPlaying:true}); };
      const started = () => { acceptIncoming(audio); if (active() && !audio.paused && audio.readyState >= 2) { internalReload.current = false; timing.endBuffer(); timing.finish('started'); usage.current.started(); if (stateRef.current.currentSong) failed.current.delete(stateRef.current.currentSong.id); } };
      const waiting = () => { if (!active()) return; usage.current.stop(); if (!audio.paused && !audio.seeking) timing.startBuffer(); };
      const stopBuffer = () => {if (active()) {timing.endBuffer();usage.current.stop();}};
      const paused = () => { if (active() && audio.paused && !audio.error && !internalReload.current) { cancelOverlap(); usage.current.cancel(); timing.endBuffer(); timing.finish('cancelled'); update({isPlaying:false, transitioning:false}); } };
      const ended = () => { if (!active()) { if (overlap.current?.outgoing === audio) { cancelOverlap(); update({transitioning:false}); } return; } usage.current.stop(); timing.endBuffer(); actions.current.next(true); };
      const error = () => { if (active()) failureAction.current(audio.error?.code); else if (overlap.current?.incoming === audio) { fadeSkipped.current = true; cancelOverlap(); } else if (overlap.current?.outgoing === audio) { cancelOverlap(); update({transitioning:false}); } };
      const usageTimer=window.setInterval(()=>{if(active()){if(!audio.paused&&!audio.seeking&&audio.readyState>=3)usage.current.flush();else usage.current.stop();}},LISTEN_FLUSH_INTERVAL_MS);
      const seeked=()=>{if(active()&&!audio.paused&&audio.readyState>=3)usage.current.started();};
      const preference=()=>usage.current.cancel();
      window.addEventListener('usage:preference',preference);
      audio.addEventListener('seeked',seeked);
      audio.addEventListener('timeupdate', sync);
      audio.addEventListener('loadedmetadata', sync);
      audio.addEventListener('play', playing);
      audio.addEventListener('playing', started);
      audio.addEventListener('waiting', waiting);
      audio.addEventListener('seeking', stopBuffer);
      window.addEventListener('pagehide', stopBuffer);
      audio.addEventListener('pause', paused);
      audio.addEventListener('ended', ended);
      audio.addEventListener('error', error);
      return () => {
        window.removeEventListener('usage:preference',preference);window.clearInterval(usageTimer);usage.current.stop();audio.removeEventListener('seeked',seeked);
        audio.removeEventListener('timeupdate', sync); audio.removeEventListener('loadedmetadata', sync);
        audio.removeEventListener('playing', started);
        audio.removeEventListener('waiting', waiting);
        audio.removeEventListener('seeking', stopBuffer);
        window.removeEventListener('pagehide', stopBuffer);
        audio.removeEventListener('play', playing); audio.removeEventListener('pause', paused);
        audio.removeEventListener('ended', ended); audio.removeEventListener('error', error);
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, []);
  useEffect(() => {
    const song = playerState.currentSong;
    if (!song || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: song.album || 'Papzin & Crew', artwork: song.imageUrl ? [{src:song.imageUrl}] : [] });
      navigator.mediaSession.setActionHandler('play', () => { retried.current = false; requestPlay(); });
      navigator.mediaSession.setActionHandler('pause', () => { cancelRecovery(); cancelOverlap(); usage.current.cancel(); timing.endBuffer(); timing.finish('cancelled'); audioRef.current?.pause(); update({isPlaying:false, transitioning:false}); });
      navigator.mediaSession.setActionHandler('nexttrack', () => actions.current.next());
      navigator.mediaSession.setActionHandler('previoustrack', () => actions.current.previous());
      navigator.mediaSession.setActionHandler('seekto', details => { if (details.seekTime !== undefined) actions.current.seek(details.seekTime); });
    } catch { /* Unsupported MediaSession handlers must not interrupt playback. */ }
  }, [playerState.currentSong?.id]);
  return { audioRef, nativeAudioRef, firstAudioRef, secondAudioRef, playbackAttempts: timing.attempts, timingStorageError: timing.storageError, playerState, playSong, togglePlay, handleNext: () => handleNext(), handlePrevious, setVolume, seekTo, toggleShuffle, toggleRepeat };
};
