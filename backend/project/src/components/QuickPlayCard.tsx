import React from 'react';
import { Play, Clock } from 'lucide-react';
import { Song, Playlist, Album } from '../types/music';

interface QuickPlayCardProps {
  item: Song | Playlist | Album;
  type: 'song' | 'playlist' | 'album';
  onPlay: () => void;
}

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
    if (type === 'song') {
      return (item as Song).imageUrl;
    }
    return item.imageUrl;
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