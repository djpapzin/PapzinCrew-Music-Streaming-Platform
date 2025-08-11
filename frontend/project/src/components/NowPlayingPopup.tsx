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
            <img src={track.coverArt} alt={`${track.title} cover`} className="w-full h-full object-cover" />
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
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-black/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-md w-full mx-auto overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Minimize Button */}
        <button
          onClick={() => setIsMinimized(true)}
          className="absolute top-4 right-14 z-10 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all"
          aria-label="Minimize player"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* More Options Button */}
        <button className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all">
          <Heart className="w-5 h-5" />
        </button>

        <div className="p-8 pt-16">
          {/* Album Art */}
          <div className="relative mb-8">
            <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
              {track.coverArt ? (
                <img
                  src={track.coverArt}
                  alt={`${track.title} cover`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                  <svg className="w-16 h-16 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Track Info */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2 truncate">
              {track.title}
            </h2>
            <p className="text-gray-400 text-lg truncate">
              {track.artist}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
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
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, #4a5568 ${progressPercent}%, #4a5568 100%)`
                }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-8 mb-6">
            {/* Shuffle */}
            <button
              onClick={onToggleShuffle}
              className={`transition-colors duration-200 ${
                shuffle ? 'text-green-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Shuffle className="w-6 h-6" />
            </button>

            {/* Previous */}
            <button
              onClick={onPrevious}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-8 h-8" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={onTogglePlay}
              className="w-16 h-16 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-black" />
              ) : (
                <Play className="w-8 h-8 text-black ml-1" fill="currentColor" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={onNext}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <SkipForward className="w-8 h-8" />
            </button>

            {/* Repeat */}
            <button
              onClick={onToggleRepeat}
              className={`transition-colors duration-200 ${
                repeat !== 'none' ? 'text-green-400' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Repeat className="w-6 h-6" />
              {repeat === 'one' && (
                <span className="absolute -mt-1 -ml-1 text-xs">1</span>
              )}
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
              className="text-gray-400 hover:text-white transition-colors"
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
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
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
