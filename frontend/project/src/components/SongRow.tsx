import React from 'react';
import { Play, Heart, MoreHorizontal } from 'lucide-react';
import { Song } from '../types/music';

interface SongRowProps {
  song: Song;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
}

const PLACEHOLDER =
  "data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>\
  <defs>\
    <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>\
      <stop offset='0%' stop-color='%235b21b6'/>\
      <stop offset='100%' stop-color='%23db2777'/>\
    </linearGradient>\
  </defs>\
  <rect width='100%' height='100%' fill='url(%23g)'/>\
  <text x='50%' y='52%' font-size='48' text-anchor='middle' dominant-baseline='middle' fill='white'>♪</text>\
</svg>";

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const SongRow: React.FC<SongRowProps> = ({ song, index, isPlaying, onPlay }) => {
  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:grid group grid-cols-12 gap-4 px-4 py-2 hover:bg-white/5 rounded-lg transition-colors duration-200">
        {/* Index/Play button */}
        <div className="col-span-1 flex items-center">
          <div className="relative w-4">
            <span className={`text-gray-400 group-hover:hidden ${isPlaying ? 'text-green-400' : ''}`}>
              {index + 1}
            </span>
            <button
              onClick={onPlay}
              className="hidden group-hover:block w-4 h-4 text-white hover:text-green-400 transition-colors duration-200"
            >
              <Play className="w-4 h-4" fill="currentColor" />
            </button>
          </div>
        </div>

        {/* Song info */}
        <div className="col-span-5 flex items-center space-x-3">
          <img
            src={song.imageUrl && song.imageUrl.trim().length > 0 ? song.imageUrl : PLACEHOLDER}
            alt={song.album}
            className="w-10 h-10 rounded object-cover"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.src !== PLACEHOLDER) el.src = PLACEHOLDER;
            }}
          />
          <div className="min-w-0">
            <p className={`font-medium truncate ${isPlaying ? 'text-green-400' : 'text-white'}`}>
              {song.title}
            </p>
            <p className="text-gray-400 text-sm truncate">{song.artist}</p>
          </div>
        </div>

        {/* Album */}
        <div className="col-span-3 flex items-center">
          <p className="text-gray-400 text-sm truncate">{song.album}</p>
        </div>

        {/* Genre */}
        <div className="col-span-2 flex items-center">
          <p className="text-gray-400 text-sm truncate">{song.genre}</p>
        </div>

        {/* Actions */}
        <div className="col-span-1 flex items-center justify-end space-x-2">
          <button className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200">
            <Heart className="w-4 h-4" />
          </button>
          <p className="text-gray-400 text-sm">{formatDuration(song.duration)}</p>
          <button className="text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden group flex items-center space-x-3 px-4 py-3 hover:bg-white/5 rounded-lg transition-colors duration-200">
        <div className="relative">
          <img
            src={song.imageUrl && song.imageUrl.trim().length > 0 ? song.imageUrl : PLACEHOLDER}
            alt={song.album}
            className="w-12 h-12 rounded object-cover"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.src !== PLACEHOLDER) el.src = PLACEHOLDER;
            }}
          />
          <button
            onClick={onPlay}
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded flex items-center justify-center"
          >
            <Play className="w-5 h-5 text-white" fill="currentColor" />
          </button>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${isPlaying ? 'text-green-400' : 'text-white'}`}>
            {song.title}
          </p>
          <p className="text-gray-400 text-sm truncate">{song.artist} • {song.album}</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="text-gray-400 hover:text-white transition-colors duration-200">
            <Heart className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors duration-200">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

export default SongRow;