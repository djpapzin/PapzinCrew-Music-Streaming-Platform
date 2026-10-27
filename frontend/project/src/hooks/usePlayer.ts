import { useState, useRef, useEffect } from 'react';
import { Song, PlayerState } from '../types/music';
import { usePlaybackTiming } from './usePlaybackTiming';

export const VOLUME_KEY = 'papzincrew:volume';
const initialVolume = () => {
  try { const saved = localStorage.getItem(VOLUME_KEY); const n = Number(saved); return saved !== null && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.7; } catch { return 0.7; }
};
const available = (song: Song) => !!song.audioUrl && song.playable !== false;

export const usePlayer = () => {
  const timing = usePlaybackTiming();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({ currentSong: null, isPlaying: false, volume: initialVolume(), currentTime: 0, duration: 0, queue: [], currentIndex: -1, shuffle: false, repeat: 'none' });
  const stateRef = useRef(playerState);
  const failed = useRef(new Set<string>());
  const actions = useRef({ next: (_ended = false) => {}, previous: () => {}, seek: (_time: number) => {} });
  const update = (change: Partial<PlayerState>) => {
    stateRef.current = { ...stateRef.current, ...change };
    setPlayerState(stateRef.current);
  };
  const notify = (message: string) => window.dispatchEvent(new CustomEvent('app:toast', { detail: { message } }));
  const requestPlay = (attemptId?: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const id = attemptId ?? timing.begin(stateRef.current.currentSong?.title || 'Mix', 'Resume');
    audio.volume = stateRef.current.volume;
    audio.muted = stateRef.current.volume === 0;
    void audio.play().catch((err: Error) => {
      if (timing.pending.current?.id !== id) return;
      timing.finish(err.name === 'AbortError' ? 'cancelled' : 'failed', id);
      if (err.name === 'AbortError') return;
      update({ isPlaying: false });
      if (err.name === 'NotAllowedError') notify('Tap Play to start listening.');
    });
  };

  const playSong = (song: Song, queue: Song[] = [song]) => {
    const audio = audioRef.current;
    if (!audio || !available(song)) { notify('This track is unavailable.'); return; }
    const playableQueue = queue.filter(available);
    if (!playableQueue.some(item => item.id === song.id)) playableQueue.unshift(song);
    const kind = stateRef.current.currentSong ? 'Track start' : 'First play';
    audio.pause();
    const attemptId = timing.begin(song.title, kind);
    update({ currentSong: song, currentIndex: playableQueue.findIndex(item => item.id === song.id), queue: playableQueue, currentTime: 0, duration: song.duration || 0, isPlaying: false });
    audio.src = song.audioUrl;
    audio.load();
    requestPlay(attemptId);
    window.dispatchEvent(new CustomEvent('library:played', { detail: song.id }));
  };
  const handleNext = (ended = false) => {
    const audio = audioRef.current;
    const { queue, currentIndex, shuffle, repeat } = stateRef.current;
    if (!audio || !queue.length) return;
    if (ended && repeat === 'one' && !failed.current.has(queue[currentIndex]?.id)) {
      audio.currentTime = 0; update({ currentTime: 0 }); requestPlay(); return;
    }
    const candidates = queue.map((song, i) => ({ song, i })).filter(({song, i}) => available(song) && !failed.current.has(song.id) && i !== currentIndex);
    let nextIndex = currentIndex + 1;
    if (shuffle && candidates.length) nextIndex = candidates[Math.floor(Math.random() * candidates.length)].i;
    else {
      while (nextIndex < queue.length && failed.current.has(queue[nextIndex].id)) nextIndex++;
      if (nextIndex >= queue.length && repeat === 'all') nextIndex = queue.findIndex(song => !failed.current.has(song.id));
    }
    if (nextIndex < 0 || nextIndex >= queue.length || failed.current.has(queue[nextIndex].id)) { audio.pause(); update({isPlaying:false}); return; }
    playSong(queue[nextIndex], queue);
  };
  const handlePrevious = () => {
    const audio = audioRef.current;
    const { queue, currentIndex } = stateRef.current;
    if (!audio || !queue.length) return;
    if (audio.currentTime > 3 || currentIndex === 0) { audio.currentTime = 0; update({currentTime:0}); return; }
    playSong(queue[currentIndex - 1], queue);
  };
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !stateRef.current.currentSong) return;
    if (!audio.paused) { audio.pause(); update({isPlaying:false}); } else requestPlay();
  };
  const setVolume = (value: number) => {
    const volume = Math.max(0, Math.min(1, value));
    if (audioRef.current) { audioRef.current.volume = volume; audioRef.current.muted = volume === 0; }
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
    update({volume});
  };
  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(time)) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : stateRef.current.duration;
    const currentTime = Math.max(0, Math.min(time, duration));
    audio.currentTime = currentTime;
    update({currentTime});
  };
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
  const toggleShuffle = () => update({shuffle: !stateRef.current.shuffle});
  const toggleRepeat = () => update({repeat: stateRef.current.repeat === 'none' ? 'all' : stateRef.current.repeat === 'all' ? 'one' : 'none'});
  actions.current = { next: handleNext, previous: handlePrevious, seek: seekTo };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = stateRef.current.volume;
    audio.muted = stateRef.current.volume === 0;
    const sync = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : stateRef.current.duration;
      update({currentTime: audio.currentTime || 0, duration});
      try {
        if (duration > 0 && navigator.mediaSession?.setPositionState) navigator.mediaSession.setPositionState({ duration, position: Math.min(audio.currentTime || 0, duration), playbackRate: audio.playbackRate || 1 });
      } catch { /* MediaSession is optional. */ }
    };
    const playing = () => update({isPlaying:true});
    const started = () => { if (!audio.paused && audio.readyState >= 2) { timing.endBuffer(); timing.finish('started'); } };
    const waiting = () => { if (!audio.paused && !audio.seeking) timing.startBuffer(); };
    const stopBuffer = () => timing.endBuffer();
    const paused = () => { if (audio.paused) { timing.endBuffer(); timing.finish('cancelled'); update({isPlaying:false}); } };
    const ended = () => { timing.endBuffer(); actions.current.next(true); };
    const error = () => {
      timing.endBuffer();
      timing.finish('failed');
      const song = stateRef.current.currentSong;
      if (song) failed.current.add(song.id);
      notify('This track could not be played. Trying the next track.');
      actions.current.next();
    };
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
      audio.removeEventListener('timeupdate', sync); audio.removeEventListener('loadedmetadata', sync);
      audio.removeEventListener('playing', started);
      audio.removeEventListener('waiting', waiting);
      audio.removeEventListener('seeking', stopBuffer);
      window.removeEventListener('pagehide', stopBuffer);
      audio.removeEventListener('play', playing); audio.removeEventListener('pause', paused);
      audio.removeEventListener('ended', ended); audio.removeEventListener('error', error);
    };
  }, []);
  useEffect(() => {
    const song = playerState.currentSong;
    if (!song || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: song.album || 'Papzin & Crew', artwork: song.imageUrl ? [{src:song.imageUrl}] : [] });
      navigator.mediaSession.setActionHandler('play', () => requestPlay());
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => actions.current.next());
      navigator.mediaSession.setActionHandler('previoustrack', () => actions.current.previous());
      navigator.mediaSession.setActionHandler('seekto', details => { if (details.seekTime !== undefined) actions.current.seek(details.seekTime); });
    } catch { /* Unsupported MediaSession handlers must not interrupt playback. */ }
  }, [playerState.currentSong?.id]);
  return { audioRef, playbackAttempts: timing.attempts, timingStorageError: timing.storageError, playerState, playSong, togglePlay, handleNext: () => handleNext(), handlePrevious, setVolume, seekTo, toggleShuffle, toggleRepeat };
};
