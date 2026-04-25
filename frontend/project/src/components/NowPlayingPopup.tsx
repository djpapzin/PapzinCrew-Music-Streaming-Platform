'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Heart,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PlayerState } from '../types/music';
import { safeArtworkUrl, DEFAULT_ARTWORK_URL } from '../lib/artwork';

interface Track {
  id: string;
  title: string;
  artist: string;
  coverArt?: string;
  audioUrl?: string;
}

interface NowPlayingPopupProps {
  track: Track | null;
  isVisible: boolean;
  onClose: () => void;
  playerState: PlayerState;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (time: number) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function NowPlayingPopup({
  track,
  isVisible,
  onClose,
  playerState,
  onTogglePlay,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek,
  onToggleShuffle,
  onToggleRepeat
}: NowPlayingPopupProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const { isPlaying, volume, currentTime, duration, shuffle, repeat } = playerState;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!isVisible || !track) return null;

  // Minimized compact player (dock)
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl p-3 z-50 flex items-center space-x-3 w-80">
        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
          {track.coverArt ? (
            <img
              src={safeArtworkUrl(track.coverArt)}
              alt={`${track.title} cover`}
              className="w-full h-full object-cover"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (el.src !== DEFAULT_ARTWORK_URL) el.src = DEFAULT_ARTWORK_URL;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{track.title}</p>
          <p className="text-gray-400 text-xs truncate">{track.artist}</p>
        </div>
        <button
          onClick={onTogglePlay}
          className="w-8 h-8 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-black" />
          ) : (
            <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
          )}
        </button>
        <button
          onClick={() => setIsMinimized(false)}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Restore player"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close player"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-start sm:items-center justify-center overflow-y-auto px-3 sm:px-4"
      style={{
        paddingTop: 'calc(1.75rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      <div className="relative bg-black/95 backdrop-blur-xl border border-white/20 rounded-[1.75rem] shadow-2xl max-w-md w-full mx-auto my-3 sm:my-4 overflow-y-auto max-h-[calc(100vh-2.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]">
        <div
          className="px-4 sm:px-8"
          style={{
            paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))'
          }}
        >
          <div className="mb-7 sm:mb-8 flex items-start justify-between gap-3 px-1">
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/20 transition-all flex-shrink-0"
              aria-label="Close player"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 text-center px-3 pt-1.5">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.32em] text-gray-500">
                Now Playing
              </p>
              <p className="mt-2.5 text-sm text-gray-300 leading-tight break-words sm:hidden">
                {track.artist}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0">
              <button
                onClick={() => setIsMinimized(true)}
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/20 transition-all"
                aria-label="Minimize player"
              >
                <ChevronDown className="w-5 h-5" />
              </button>

              <button
                className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/20 transition-all"
                aria-label="Like track"
              >
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative mb-6 sm:mb-8 mx-auto w-full max-w-[320px]">
            <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
              {track.coverArt ? (
                <img
                  src={safeArtworkUrl(track.coverArt)}
                  alt={`${track.title} cover`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.currentTarget as HTMLImageElement;
                    if (el.src !== DEFAULT_ARTWORK_URL) el.src = DEFAULT_ARTWORK_URL;
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-7 sm:mb-8 px-2 sm:px-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight break-words">
              {track.title}
            </h2>
            <p className="mt-2 text-base sm:text-lg text-gray-400 leading-relaxed break-words hidden sm:block">
              {track.artist}
            </p>
          </div>

          <div className="mb-8 sm:mb-7 px-1">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="relative">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, #4a5568 ${progressPercent}%, #4a5568 100%)`
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-5 sm:gap-8 mb-8 sm:mb-7">
            <button
              onClick={onToggleShuffle}
              className={`transition-colors duration-200 ${
                shuffle ? 'text-green-400' : 'text-gray-400 hover:text-white'
              }`}
              aria-label="Toggle shuffle"
            >
              <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={onPrevious}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Previous track"
            >
              <SkipBack className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg flex-shrink-0"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-black" />
              ) : (
                <Play className="w-8 h-8 text-black ml-1" fill="currentColor" />
              )}
            </button>

            <button
              onClick={onNext}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Next track"
            >
              <SkipForward className="w-7 h-7 sm:w-8 sm:h-8" />
            </button>

            <button
              onClick={onToggleRepeat}
              className={`relative transition-colors duration-200 ${
                repeat !== 'none' ? 'text-green-400' : 'text-gray-400 hover:text-white'
              }`}
              aria-label="Toggle repeat"
            >
              <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
              {repeat === 'one' && (
                <span className="absolute -top-1 -right-1 text-[10px] font-semibold">1</span>
              )}
            </button>
          </div>

          <div className="flex items-center space-x-3 px-1">
            <button
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            >
              {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volume * 100}%, #4a5568 ${volume * 100}%, #4a5568 100%)`
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
