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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

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

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', updateTime);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', updateTime);
    };
  }, []);

  const playSong = (song: Song, queue: Song[] = [song]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = queue.findIndex(s => s.id === song.id);
    
    setPlayerState(prev => ({
      ...prev,
      currentSong: song,
      queue,
      currentIndex,
      isPlaying: true
    }));

    audio.src = song.audioUrl;
    audio.volume = playerState.volume;
    // Ensure new source is loaded
    try { audio.load(); } catch {}

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

    // Try to play now and also once it's ready
    audio.addEventListener('canplay', attemptPlay, { once: true });
    attemptPlay();
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