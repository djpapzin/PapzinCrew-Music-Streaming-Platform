import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Shuffle, Radio } from 'lucide-react';
import { Song, Playlist } from '../types/music';

export interface QuickPlayCollection { title: string; description: string; songs: Song[]; href: string; }
interface QuickPlayProps {
  collections?: QuickPlayCollection[];
  songs: Song[];
  playlists: Playlist[];
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
}

const QuickPlay: React.FC<QuickPlayProps> = ({
  songs,
  collections = [],
  onPlaySong
}) => {
  const playable = songs.filter(song => song.playable !== false && song.audioUrl);
  const hasSongs = playable.length > 0;

  const handleQuickPlay = () => {
    if (!hasSongs) return;
    // Play a random song from all available songs
    const randomSong = playable[Math.floor(Math.random() * playable.length)];
    onPlaySong(randomSong, playable);
  };

  const handleShufflePlay = () => {
    if (!hasSongs) return;
    // Create a shuffled queue and start playing
    const shuffledSongs = [...playable].sort(() => Math.random() - 0.5);
    onPlaySong(shuffledSongs[0], shuffledSongs);
  };

  const handleRadioPlay = () => {
    if (!hasSongs) return;
    const seed = playable[Math.floor(Math.random() * playable.length)];
    const related = playable.filter(song => song.id !== seed.id && (song.artist === seed.artist || (seed.genre && song.genre === seed.genre)));
    const others = playable.filter(song => song.id !== seed.id && !related.some(item => item.id === song.id));
    onPlaySong(seed, [seed, ...related.sort(() => Math.random() - 0.5), ...others.sort(() => Math.random() - 0.5)]);
  };

  return (
    <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-4 lg:p-6 border border-purple-500/20 mb-6 lg:mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h3 className="text-lg lg:text-xl font-bold text-white mb-2">Quick Play</h3>
          <p className="text-gray-300 text-sm">
            Jump right into the music with one click
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={handleQuickPlay}
            disabled={!hasSongs}
            className={`flex items-center justify-center space-x-2 bg-white text-black px-4 py-2 min-h-11 rounded-full font-medium transition-all duration-200 ${hasSongs ? 'hover:bg-gray-200 hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
          >
            <Play className="w-4 h-4" fill="currentColor" />
            <span>Play</span>
          </button>
          
          <button
            onClick={handleShufflePlay}
            disabled={!hasSongs}
            className={`flex items-center justify-center space-x-2 bg-green-500 text-white px-4 py-2 min-h-11 rounded-full font-medium transition-all duration-200 ${hasSongs ? 'hover:bg-green-400 hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>
          
          <button
            onClick={handleRadioPlay}
            disabled={!hasSongs}
            className={`flex items-center justify-center space-x-2 bg-purple-500 text-white px-4 py-2 min-h-11 rounded-full font-medium transition-all duration-200 ${hasSongs ? 'hover:bg-purple-400 hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
          >
            <Radio className="w-4 h-4" />
            <span>Radio</span>
          </button>
        </div>
      </div>
      {collections.length > 0 && <div className="grid sm:grid-cols-2 gap-3 mt-5">
        {collections.map(collection => {
          const queue = collection.songs.filter(song => song.playable !== false && song.audioUrl);
          return <section key={collection.title} className="rounded-xl bg-black/25 border border-white/10 p-4 flex flex-col gap-3 min-w-0">
            <div><h4 className="text-lg font-bold">{collection.title}</h4><p className="text-sm text-gray-300 mt-1">{collection.description}</p></div>
            <button disabled={!queue.length} onClick={() => {
              const index = Math.floor(Math.random() * queue.length);
              const ordered = [...queue.slice(index), ...queue.slice(0,index)];
              if (ordered.length) onPlaySong(ordered[0], ordered);
            }} className="mt-auto min-h-12 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-3 font-semibold flex gap-2 items-center justify-center"><Play size={18}/> Play {collection.title}</button>
            <Link to={collection.href} className="min-h-11 flex items-center justify-center text-purple-200 text-sm">Explore {collection.title} →</Link>
          </section>;
        })}
      </div>}
    </div>
  );
};

export default QuickPlay;