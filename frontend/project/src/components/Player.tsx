import DeviceVolumeControl from './DeviceVolumeControl';
import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { PlayerState } from '../types/music';
import { NowPlayingPopup } from './NowPlayingPopup';
import { safeArtworkUrl, DEFAULT_ARTWORK_URL } from '../lib/artwork';
import { useLibrary } from '../state/LibraryContext';
import SongActions from './SongActions';

interface PlayerProps {
  openRequest?: number;
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
  openRequest = 0,
  onTogglePlay,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek,
  onToggleShuffle,
  onToggleRepeat
}) => {
  const { library, toggleLike } = useLibrary();
  const [showMobilePlayer, setShowMobilePlayer] = useState(false);
  const [showNowPlayingPopup, setShowNowPlayingPopup] = useState(false);

  const { currentSong, isPlaying, volume, currentTime, duration, shuffle, repeat } = playerState;

  useEffect(() => {
    if (openRequest > 0 && window.matchMedia('(max-width: 1023px)').matches) {
      setShowMobilePlayer(true);
    }
  }, [openRequest]);

  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowMobilePlayer(false); setShowNowPlayingPopup(false); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  if (!currentSong) {
    return null;
  }

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => onSeek(Number(e.target.value));
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Mobile Mini Player */}
      <div
        className="mobile-mini-player lg:hidden fixed left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/20 pt-3 pb-3 z-40"
      >
        <div
          className="flex items-center space-x-3 cursor-pointer"
          role="button" tabIndex={0} aria-label="Open Now Playing"
          onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setShowMobilePlayer(true); } }}
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
            aria-label={isPlaying ? 'Pause' : 'Play'}
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
            aria-label="Seek track"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}




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
          role="dialog" aria-modal="true" aria-label="Now Playing"
          className="lg:hidden fixed inset-0 bg-black z-50 flex flex-col overflow-hidden"
          style={{ height: '100dvh', minHeight: '100dvh' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 pb-4 border-b border-white/20"
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
          >
            <button
              aria-label="Minimize player"
              onClick={() => setShowMobilePlayer(false)}
              className="text-white flex-shrink-0"
            >
              {/* Minimize to mini-player */}
              <Minimize2 className="w-6 h-6" />
            </button>
            <h2 className="text-white font-medium">Now Playing</h2>
            <div className="flex gap-3"><SongActions song={currentSong} /></div>
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
              aria-label="Seek track"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeekChange}




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
                aria-label="Toggle shuffle" aria-pressed={shuffle}
                onClick={onToggleShuffle}
                className={`min-h-11 min-w-11 flex items-center justify-center transition-colors duration-200 ${
                  shuffle ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                <Shuffle className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <button
                aria-label="Previous track"
                onClick={onPrevious}
                className="min-h-12 min-w-12 flex items-center justify-center text-white"
              >
                <SkipBack className="w-7 h-7 sm:w-8 sm:h-8" />
              </button>

              <button
                aria-label={isPlaying ? 'Pause' : 'Play'}
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
                aria-label="Next track"
                onClick={onNext}
                className="min-h-12 min-w-12 flex items-center justify-center text-white"
              >
                <SkipForward className="w-7 h-7 sm:w-8 sm:h-8" />
              </button>

              <button
                aria-label={`Repeat: ${repeat}`} aria-pressed={repeat !== 'none'}
                onClick={onToggleRepeat}
                className={`min-h-11 min-w-11 flex items-center justify-center transition-colors duration-200 ${
                  repeat !== 'none' ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                <Repeat className="w-5 h-5 sm:w-6 sm:h-6" />{repeat === 'one' && <span className="text-xs">1</span>}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center space-x-3">
              <button
                aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
                className="text-gray-400"
              >
                {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <DeviceVolumeControl><input
                type="range"
                aria-label="Volume"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volume * 100}%, #4a5568 ${volume * 100}%, #4a5568 100%)`
                }}
              /></DeviceVolumeControl>
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
              <div className="flex gap-3"><SongActions song={currentSong}/></div>
            </div>

            {/* Center: Player controls */}
            <div className="flex flex-col items-center space-y-2">
              {/* Control buttons */}
              <div className="flex items-center space-x-4">
                <button
                  aria-label="Toggle shuffle" aria-pressed={shuffle}
                onClick={onToggleShuffle}
                  className={`transition-colors duration-200 ${
                    shuffle ? 'text-green-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  aria-label="Previous track"
                onClick={onPrevious}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  aria-label={isPlaying ? 'Pause' : 'Play'}
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
                  aria-label="Next track"
                onClick={onNext}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <SkipForward className="w-5 h-5" />
                </button>

                <button
                  aria-label={`Repeat: ${repeat}`} aria-pressed={repeat !== 'none'}
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
                    aria-label="Seek track"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeekChange}


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
                  aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                onClick={() => onVolumeChange(volume > 0 ? 0 : 0.7)}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <DeviceVolumeControl><input
                  type="range"
                  aria-label="Volume"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #ffffff 0%, #ffffff ${volume * 100}%, #4a5568 ${volume * 100}%, #4a5568 100%)`
                  }}
                /></DeviceVolumeControl>
              </div>

              <button
                aria-label="Open Now Playing"
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
        liked={library.liked.includes(currentSong.id)}
        onToggleLike={() => toggleLike(currentSong.id)}
      />
    </>
  );
};

export default Player;
