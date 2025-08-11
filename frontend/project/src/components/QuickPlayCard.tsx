import React from 'react';
import { Play, Clock } from 'lucide-react';
import { Song, Playlist, Album } from '../types/music';

interface QuickPlayCardProps {
  item: Song | Playlist | Album;
  type: 'song' | 'playlist' | 'album';
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

const QuickPlayCard: React.FC<QuickPlayCardProps> = ({ item, type, onPlay }) => {
  const getTitle = () => {
    if (type === 'song') {
      return (item as Song).title;
    }
    return item.title;
  };

  const getSubtitle = () => {
    if (type === 'song') {
      const song = item as Song;
      return `${song.artist} • ${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}`;
    }
    if (type === 'playlist') {
      const playlist = item as Playlist;
      return `${playlist.songs.length} songs`;
    }
    const album = item as Album;
    return `${album.artist} • ${album.year}`;
  };

  const getImageUrl = () => {
    const src = type === 'song' ? (item as Song).imageUrl : item.imageUrl;
    return src && src.trim().length > 0 ? src : PLACEHOLDER;
  };

  return (
    <div 
      onClick={onPlay}
      className="group flex items-center bg-white/5 hover:bg-white/10 rounded-lg p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
    >
      <div className="relative flex-shrink-0">
        <img
          src={getImageUrl()}
          alt={getTitle()}
          className="w-10 lg:w-12 h-10 lg:h-12 rounded object-cover shadow-lg"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if (el.src !== PLACEHOLDER) el.src = PLACEHOLDER;
          }}
        />

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded flex items-center justify-center">
          <Play className="w-4 lg:w-5 h-4 lg:h-5 text-white" fill="currentColor" />
        </div>
      </div>
      
      <div className="ml-3 flex-1 min-w-0">
        <p className="text-white font-medium text-sm lg:text-base truncate">{getTitle()}</p>
        <p className="text-gray-400 text-xs lg:text-sm truncate">{getSubtitle()}</p>
      </div>
      
      {type === 'song' && (
        <Clock className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
      )}
    </div>
  );
};

export default QuickPlayCard;