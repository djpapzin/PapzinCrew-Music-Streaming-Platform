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
  Maximize2,
  Minimize2,
  MoreHorizontal
} from 'lucide-react';
import { PlayerState } from '../types/music';
import { NowPlayingPopup } from './NowPlayingPopup';
import { safeArtworkUrl, DEFAULT_ARTWORK_URL } from '../lib/artwork';

interface PlayerProps {
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

const Player: React.FC<PlayerProps> = ({
  playerState,
  onTogglePlay,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek,
  onToggleShuffle,
  onToggleRepeat
}) => {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [showMobilePlayer, setShowMobilePlayer] = useState(false);
  const [showNowPlayingPopup, setShowNowPlayingPopup] = useState(false);

  const { currentSong, isPlaying, volume, currentTime, duration, shuffle, repeat } = playerState;

  if (!currentSong) {
    return null;
  }

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSeekValue(value);
  };

  const handleSeekEnd = () => {
    setIsSeeking(false);
    onSeek(seekValue);
  };

  const progressPercent = duration > 0 ? ((isSeeking ? seekValue : currentTime) / duration) * 100 : 0;

  return (
    <>
      {/* Mobile Mini Player */}
      <div
        className="lg:hidden fixed bottom-16 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/20 px-3 pt-3 z-40"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div 
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => setShowMobilePlayer(true)}
        >
          <img
            src={safeArtworkUrl(currentSong.imageUrl)}
            alt={currentSong.album}
            className="w-10 h-10 rounded object-cover shadow-lg"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.src !== DEFAULT_ARTWORK_URL) el.src = DEFAULT_ARTWORK_URL;
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{currentSong.title}</p>
            <p className="text-gray-400 text-xs truncate">{currentSong.artist}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className="w-8 h-8 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-black" />
            ) : (
              <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
            )}
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="mt-2">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={isSeeking ? seekValue : currentTime}
            onChange={handleSeekChange}
            onMouseDown={handleSeekStart}
            onMouseUp={handleSeekEnd}
            onTouchStart={handleSeekStart}
            onTouchEnd={handleSeekEnd}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, #4a5568 ${progressPercent}%, #4a5568 100%)`
            }}
          />
        </div>
      </div>

      {/* Mobile Full Player */}
      {showMobilePlayer && (
        <div
          className="lg:hidden fixed inset-0 bg-black z-50 flex flex-col overflow-hidden"
          style={{ height: '100dvh', minHeight: '100dvh' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 pb-4 border-b border-white/20"
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
          >
            <button
              onClick={() => setShowMobilePlayer(false)}
              className="text-white flex-shrink-0"
            >
              {/* Minimize to mini-player */}
              <Minimize2 className="w-6 h-6" />
            </button>
            <h2 className="text-white font-medium">Now Playing</h2>
            <button className="text-gray-400">
              <MoreHorizontal className="w-6 h-6" />
            </button>
          </div>

          {/* Album Art */}
          <div className="flex-1 min-h-0 flex items-center justify-center px-5 py-4 sm:px-8 sm:py-6">
            <img
              src={safeArtworkUrl(currentSong.imageUrl)}
              alt={currentSong.album}
              className="w-full max-w-[min(74vw,18rem)] aspect-square max-h-[30vh] sm:max-h-[36vh] rounded-lg object-cover shadow-2xl"
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                if (el.src !== DEFAULT_ARTWORK_URL) el.src = DEFAULT_ARTWORK_URL;
              }}
            />
          </div>

          {/* Song Info */}
          <div className="px-6 pb-3 flex-shrink-0">
            <h1 className="text-white text-xl sm:text-2xl font-bold mb-1 break-words line-clamp-2">{currentSong.title}</h1>
            <p className="text-gray-400 text-base sm:text-lg truncate">{currentSong.artist}</p>
          </div>

          {/* Progress */}
          <div className="px-6 pb-3 flex-shrink-0">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={isSeeking ? seekValue : currentTime}
              onChange={handleSeekChange}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
              onTouchStart={handleSeekStart}
              onTouchEnd={handleSeekEnd}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider mb-2"
              style={{
                background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, #4a5568 ${progressPercent}%, #4a5568 100%)`
              }}
            />
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div
            className="px-5 sm:px-6 pt-2 flex-shrink-0"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between gap-3 sm:gap-4 mb-5">
              <button
                onClick={onToggleShuffle}
                className={`min-h-11 min-w-11 flex items-center justify-center transition-colors duration-200 ${
                  shuffle ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <button
                onClick={onPrevious}
                className="min-h-12 min-w-12 flex items-center justify-center text-white"
              >
                <SkipBack className="w-7 h-7 sm:w-8 sm:h-8" />
              </button>

              <button
                onClick={onTogglePlay}
                className="w-16 h-16 sm:w-18 sm:h-18 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-black" />
                ) : (
                  <Play className="w-8 h-8 text-black ml-1" fill="currentColor" />
                )}
              </button>

              <button
                onClick={onNext}
                className="min-h-12 min-w-12 flex items-center justify-center text-white"
              >
                <SkipForward className="w-7 h-7 sm:w-8 sm:h-8" />
              </button>

              <button
                onClick={onToggleRepeat}
                className={`min-h-11 min-w-11 flex items-center justify-center transition-colors duration-200 ${
                  repeat !== 'none' ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
                className="text-gray-400"
              >
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volume * 100}%, #4a5568 ${volume * 100}%, #4a5568 100%)`
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Player */}
      <div className="hidden lg:block fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/20 p-4 z-50">
        <div className="max-w-screen-xl mx-auto">
          <div className="grid grid-cols-3 items-center gap-4">
            {/* Left: Current song info */}
            <div className="flex items-center space-x-3">
              <img
                src={safeArtworkUrl(currentSong.imageUrl)}
                alt={currentSong.album}
                className="w-14 h-14 rounded-lg object-cover shadow-lg"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  if (el.src !== DEFAULT_ARTWORK_URL) el.src = DEFAULT_ARTWORK_URL;
                }}
              />
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{currentSong.title}</p>
                <p className="text-gray-400 text-sm truncate">{currentSong.artist}</p>
              </div>
              <button className="text-gray-400 hover:text-white transition-colors duration-200">
                <Heart className="w-5 h-5" />
              </button>
            </div>

            {/* Center: Player controls */}
            <div className="flex flex-col items-center space-y-2">
              {/* Control buttons */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={onToggleShuffle}
                  className={`transition-colors duration-200 ${
                    shuffle ? 'text-green-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={onPrevious}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={onTogglePlay}
                  className="w-8 h-8 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-black" />
                  ) : (
                    <Play className="w-4 h-4 text-black ml-0.5" fill="currentColor" />
                  )}
                </button>

                <button
                  onClick={onNext}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button
                  onClick={onToggleRepeat}
                  className={`transition-colors duration-200 ${
                    repeat !== 'none' ? 'text-green-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Repeat className="w-4 h-4" />
                  {repeat === 'one' && (
                    <span className="absolute -mt-1 -ml-1 text-xs">1</span>
                  )}
                </button>
              </div>

              {/* Progress bar */}
              <div className="flex items-center space-x-2 w-full max-w-md">
                <span className="text-xs text-gray-400 w-10 text-right">
                  {formatTime(currentTime)}
                </span>
                <div className="flex-1 relative">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={isSeeking ? seekValue : currentTime}
                    onChange={handleSeekChange}
                    onMouseDown={handleSeekStart}
                    onMouseUp={handleSeekEnd}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, #4a5568 ${progressPercent}%, #4a5568 100%)`
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-10">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Right: Volume and other controls */}
            <div className="flex items-center justify-end space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volume * 100}%, #4a5568 ${volume * 100}%, #4a5568 100%)`
                  }}
                />
              </div>
              
              <button 
                onClick={() => setShowNowPlayingPopup(true)}
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Now Playing Popup */}
      <NowPlayingPopup
        track={{
          id: currentSong.id,
          title: currentSong.title,
          artist: currentSong.artist,
          coverArt: safeArtworkUrl(currentSong.imageUrl),
          audioUrl: currentSong.audioUrl
        }}
        isVisible={showNowPlayingPopup}
        onClose={() => setShowNowPlayingPopup(false)}
        playerState={playerState}
        onTogglePlay={onTogglePlay}
        onNext={onNext}
        onPrevious={onPrevious}
        onVolumeChange={onVolumeChange}
        onSeek={onSeek}
        onToggleShuffle={onToggleShuffle}
        onToggleRepeat={onToggleRepeat}
      />
    </>
  );
};

export default Player;
