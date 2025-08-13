import { useState, useRef, useEffect } from 'react';
import { Song, PlayerState } from '../types/music';

export const usePlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    volume: 0.7,
    currentTime: 0,
    duration: 0,
    queue: [],
    currentIndex: -1,
    shuffle: false,
    repeat: 'none'
  });
  
  // Track one-time proxy fallback per track to avoid loops (dev reliability)
  const proxyTriedRef = useRef<Set<string>>(new Set());
  const isDevHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const toast = (message: string) => {
    try {
      window.dispatchEvent(new CustomEvent('app:toast', { detail: { message } }));
    } catch {}
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Ensure CORS-safe playback for redirected/static resources
    try {
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
    } catch {}

    const updateTime = () => {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audio.currentTime,
        duration: audio.duration || 0
      }));
    };

    const onEnded = () => {
      handleNext();
    };

    const onError = () => {
      const err = (audio as any).error as MediaError | undefined;
      console.error('Audio error', {
        code: err?.code,
        message: (err as any)?.message,
        src: audio.currentSrc,
        networkState: audio.networkState,
        readyState: audio.readyState,
      });

      // Fallback: if we failed loading a redirected B2 URL due to CORS or format, retry once via backend proxy
      try {
        const src = audio.currentSrc || audio.src;
        // Match /tracks/{id}/stream but not already /proxy
        const m = src && src.match(/\/tracks\/(\d+)\/stream(?!\/proxy)/);
        const trackIdStr = m ? String(parseInt(m[1], 10)) : undefined;
        if (trackIdStr && !proxyTriedRef.current.has(trackIdStr)) {
          proxyTriedRef.current.add(trackIdStr);
          const proxyUrl = src.replace('/stream', '/stream/proxy');
          console.info('Falling back to proxy', { trackId: trackIdStr, proxyUrl });
          audio.src = proxyUrl;
          try { audio.load(); } catch {}
          // Retry playback now and also once ready
          const targetVolume = audio.volume;
          audio.muted = false;
          audio.volume = targetVolume;
          audio.addEventListener('canplay', () => {
            audio.play().catch(console.error);
          }, { once: true });
          audio.play().catch(() => {/* will retry on canplay */});
          return;
        }
        // If we are already on proxy (or retry already happened), skip to next track
        const onProxy = src.includes('/stream/proxy');
        if (onProxy || (trackIdStr && proxyTriedRef.current.has(trackIdStr))) {
          console.warn('Proxy also failed; skipping to next track');
          toast('Skipped: playback failed for this track');
          handleNext();
          return;
        }
      } catch {}
    };

    const onStalled = () => {
      console.warn('Audio stalled', { src: audio.currentSrc, networkState: audio.networkState, readyState: audio.readyState });
    };

    const onAbort = () => {
      console.warn('Audio load aborted', { src: audio.currentSrc });
    };

    const onWaiting = () => {
      console.info('Audio waiting for data', { src: audio.currentSrc, readyState: audio.readyState });
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', updateTime);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('abort', onAbort);
    audio.addEventListener('waiting', onWaiting);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', updateTime);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('abort', onAbort);
      audio.removeEventListener('waiting', onWaiting);
    };
  }, []);

  const playSong = (song: Song, queue: Song[] = [song]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = queue.findIndex(s => s.id === song.id);
    
    // Reset proxy fallback for this track
    try { proxyTriedRef.current.delete(String(song.id)); } catch {}
    
    setPlayerState(prev => ({
      ...prev,
      currentSong: song,
      queue,
      currentIndex,
      isPlaying: true
    }));

    // Immediate guard: skip tracks with no source or flagged unplayable
    if (!song.audioUrl || song.playable === false) {
      console.warn('Skipping unplayable track (no source or flagged)', { id: song.id, title: song.title });
      toast('Skipped: track is unavailable');
      handleNext();
      return;
    }

    // Build preferred source: always use proxy in development to avoid B2 CORS
    const buildPreferredSrc = (url: string) => {
      if (!url) return url;
      // Always use proxy for streaming to avoid CORS issues with B2 storage
      if (url.includes('/stream/proxy')) return url; // already proxy
      if (url.includes('/tracks/') && url.includes('/stream')) return url.replace('/stream', '/stream/proxy');
      return url;
    };

    const preferredSrc = buildPreferredSrc(song.audioUrl);
    console.debug('Setting audio src', { url: preferredSrc, id: song.id, title: song.title });

    // Define attemptPlay before use to avoid TDZ issues
    const attemptPlay = () => {
      // Try muted autoplay first (widely allowed by browsers)
      const targetVolume = playerState.volume;
      audio.muted = true;
      audio.play().then(() => {
        // Unmute as soon as possible after playback starts
        setTimeout(() => {
          audio.muted = false;
          audio.volume = targetVolume;
        }, 0);
      }).catch((err: any) => {
        // Autoplay restriction
        if (err && (err.name === 'NotAllowedError' || err.message?.toLowerCase().includes('autoplay'))) {
          console.warn('Autoplay blocked; will resume on next user interaction');
          const resume = () => {
            // Ensure we unmute and restore intended volume on user interaction
            audio.muted = false;
            audio.volume = targetVolume;
            audio.play().catch(console.error);
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
          };
          document.addEventListener('click', resume, { once: true });
          document.addEventListener('keydown', resume, { once: true });
        } else {
          // If playback failed due to readiness/network, retry on canplay
          console.warn('Playback failed, retrying on canplay:', err);
          audio.addEventListener('canplay', () => {
            audio.muted = false;
            audio.volume = targetVolume;
            audio.play().catch(console.error);
          }, { once: true });
        }
      });
    };

    // In dev, proactively HEAD the proxy to skip null/404 tracks
    const trySetAndPlay = () => {
      audio.src = preferredSrc;
      audio.volume = playerState.volume;
      try { audio.load(); } catch {}
      // Try to play now and also once it's ready
      audio.addEventListener('canplay', attemptPlay, { once: true });
      attemptPlay();
    };

    if (isDevHost && preferredSrc.includes('/stream/proxy')) {
      // Use a short HEAD to validate availability
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      fetch(preferredSrc, { method: 'HEAD', signal: controller.signal }).then((resp) => {
        clearTimeout(timeout);
        if (!resp.ok) {
          console.warn('Proxy HEAD not OK; skipping track', { status: resp.status, id: song.id, url: preferredSrc });
          toast('Skipped: track not found');
          handleNext();
          return;
        }
        trySetAndPlay();
      }).catch((e) => {
        clearTimeout(timeout);
        console.warn('Proxy HEAD failed; skipping track', { error: String(e), id: song.id, url: preferredSrc });
        toast('Skipped: track not reachable');
        handleNext();
      });
      return;
    }

    trySetAndPlay();
    // attemptPlay moved above into trySetAndPlay
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !playerState.currentSong) return;

    if (playerState.isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }

    setPlayerState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying
    }));
  };

  const handleNext = () => {
    const { queue, currentIndex, shuffle, repeat } = playerState;
    if (queue.length === 0) return;

    let nextIndex = currentIndex;

    if (repeat === 'one') {
      // Replay current song
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      }
      return;
    }

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          setPlayerState(prev => ({ ...prev, isPlaying: false }));
          return;
        }
      }
    }

    playSong(queue[nextIndex], queue);
  };

  const handlePrevious = () => {
    const { queue, currentIndex } = playerState;
    if (queue.length === 0) return;

    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      // If more than 3 seconds played, restart current song
      audio.currentTime = 0;
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    playSong(queue[prevIndex], queue);
  };

  const setVolume = (volume: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
    setPlayerState(prev => ({ ...prev, volume }));
  };

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
    }
  };

  const toggleShuffle = () => {
    setPlayerState(prev => ({ ...prev, shuffle: !prev.shuffle }));
  };

  const toggleRepeat = () => {
    setPlayerState(prev => ({
      ...prev,
      repeat: prev.repeat === 'none' ? 'all' : prev.repeat === 'all' ? 'one' : 'none'
    }));
  };

  return {
    audioRef,
    playerState,
    playSong,
    togglePlay,
    handleNext,
    handlePrevious,
    setVolume,
    seekTo,
    toggleShuffle,
    toggleRepeat
  };
};