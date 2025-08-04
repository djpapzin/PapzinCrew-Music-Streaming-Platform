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
  ChevronUp
} from 'lucide-react';
import { PlayerState } from '../types/music';

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
      <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/20 p-3 z-40">
        <div 
          className="flex items-center space-x-3 cursor-pointer"
          onClick={() => setShowMobilePlayer(true)}
        >
          <img
            src={currentSong.imageUrl}
            alt={currentSong.album}
            className="w-10 h-10 rounded object-cover shadow-lg"
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
        <div className="lg:hidden fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/20">
            <button
              onClick={() => setShowMobilePlayer(false)}
              className="text-white"
            >
              <ChevronUp className="w-6 h-6" />
            </button>
            <h2 className="text-white font-medium">Now Playing</h2>
            <button className="text-gray-400">
              <MoreHorizontal className="w-6 h-6" />
            </button>
          </div>

          {/* Album Art */}
          <div className="flex-1 flex items-center justify-center p-8">
            <img
              src={currentSong.imageUrl}
              alt={currentSong.album}
              className="w-80 h-80 max-w-full max-h-full rounded-lg object-cover shadow-2xl"
            />
          </div>

          {/* Song Info */}
          <div className="px-6 pb-4">
            <h1 className="text-white text-2xl font-bold mb-2">{currentSong.title}</h1>
            <p className="text-gray-400 text-lg">{currentSong.artist}</p>
          </div>

          {/* Progress */}
          <div className="px-6 pb-4">
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
          <div className="px-6 pb-8">
            <div className="flex items-center justify-center space-x-8 mb-6">
              <button
                onClick={onToggleShuffle}
                className={`transition-colors duration-200 ${
                  shuffle ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                <Shuffle className="w-6 h-6" />
              </button>

              <button
                onClick={onPrevious}
                className="text-white"
              >
                <SkipBack className="w-8 h-8" />
              </button>

              <button
                onClick={onTogglePlay}
                className="w-16 h-16 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-black" />
                ) : (
                  <Play className="w-8 h-8 text-black ml-1" fill="currentColor" />
                )}
              </button>

              <button
                onClick={onNext}
                className="text-white"
              >
                <SkipForward className="w-8 h-8" />
              </button>

              <button
                onClick={onToggleRepeat}
                className={`transition-colors duration-200 ${
                  repeat !== 'none' ? 'text-green-400' : 'text-gray-400'
                }`}
              >
                <Repeat className="w-6 h-6" />
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
                src={currentSong.imageUrl}
                alt={currentSong.album}
                className="w-14 h-14 rounded-lg object-cover shadow-lg"
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
              
              <button className="text-gray-400 hover:text-white transition-colors duration-200">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Player;