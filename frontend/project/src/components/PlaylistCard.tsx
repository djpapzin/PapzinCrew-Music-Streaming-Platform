import React from 'react';
import { Play } from 'lucide-react';
import { Playlist, Album } from '../types/music';

interface PlaylistCardProps {
  item: Playlist | Album;
  onPlay: () => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({ item, onPlay }) => {
  const isPlaylist = 'description' in item;
  
  return (
    <div className="group bg-white/5 hover:bg-white/10 rounded-lg p-3 lg:p-4 transition-all duration-300 hover:shadow-xl cursor-pointer">
      <div className="relative">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full aspect-square object-cover rounded-lg shadow-lg"
        />
        <button
          onClick={onPlay}
          className="absolute bottom-2 right-2 w-10 lg:w-12 h-10 lg:h-12 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
        >
          <Play className="w-5 lg:w-6 h-5 lg:h-6 text-black ml-0.5 lg:ml-1" fill="currentColor" />
        </button>
      </div>

      <div className="mt-3 lg:mt-4">
        <h3 className="text-white font-semibold text-sm lg:text-lg line-clamp-1">{item.title}</h3>
        <p className="text-gray-400 text-xs lg:text-sm mt-1 line-clamp-2">
          {isPlaylist ? item.description : `${item.artist} • ${item.year}`}
        </p>
      </div>
    </div>
  );
};

export default PlaylistCard;