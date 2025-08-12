import React from 'react';
import { Play, Shuffle, Radio } from 'lucide-react';
import { Song, Playlist } from '../types/music';

interface QuickPlayProps {
  songs: Song[];
  playlists: Playlist[];
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
}

const QuickPlay: React.FC<QuickPlayProps> = ({
  songs,
  playlists,
  onPlaySong,
  onPlayPlaylist
}) => {
  const hasSongs = Array.isArray(songs) && songs.length > 0;
  const hasPlaylists = Array.isArray(playlists) && playlists.length > 0;

  const handleQuickPlay = () => {
    if (!hasSongs) return;
    // Play a random song from all available songs
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    onPlaySong(randomSong, songs);
  };

  const handleShufflePlay = () => {
    if (!hasSongs) return;
    // Create a shuffled queue and start playing
    const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
    onPlaySong(shuffledSongs[0], shuffledSongs);
  };

  const handleRadioPlay = () => {
    if (!hasPlaylists) return;
    // Play from a random playlist (simulating radio mode)
    const randomPlaylist = playlists[Math.floor(Math.random() * playlists.length)];
    onPlayPlaylist(randomPlaylist);
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
            className={`flex items-center justify-center space-x-2 bg-white text-black px-4 py-2 rounded-full font-medium transition-all duration-200 ${hasSongs ? 'hover:bg-gray-200 hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
          >
            <Play className="w-4 h-4" fill="currentColor" />
            <span>Play</span>
          </button>
          
          <button
            onClick={handleShufflePlay}
            disabled={!hasSongs}
            className={`flex items-center justify-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-full font-medium transition-all duration-200 ${hasSongs ? 'hover:bg-green-400 hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
          >
            <Shuffle className="w-4 h-4" />
            <span>Shuffle</span>
          </button>
          
          <button
            onClick={handleRadioPlay}
            disabled={!hasPlaylists}
            className={`flex items-center justify-center space-x-2 bg-purple-500 text-white px-4 py-2 rounded-full font-medium transition-all duration-200 ${hasPlaylists ? 'hover:bg-purple-400 hover:scale-105' : 'opacity-50 cursor-not-allowed'}`}
          >
            <Radio className="w-4 h-4" />
            <span>Radio</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickPlay;