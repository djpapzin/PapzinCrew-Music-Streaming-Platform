import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Player from './components/Player';
import MobileNav from './components/MobileNav';
import { usePlayer } from './hooks/usePlayer';
import { mockSongs, mockPlaylists, mockAlbums, mockArtists } from './data/mockData';
import { Playlist, Album } from './types/music';

function App() {
  const [activeView, setActiveView] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const {
    audioRef,
    playerState,
    playSong,
    togglePlay,
    handleNext,
    handlePrevious,
    setVolume,
    seekTo,
    toggleShuffle,
    toggleRepeat
  } = usePlayer();

  const handlePlayPlaylist = (playlist: Playlist | Album) => {
    const songs = 'songs' in playlist ? playlist.songs : [];
    if (songs.length > 0) {
      playSong(songs[0], songs);
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Hidden audio element */}
      <audio ref={audioRef} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar activeView={activeView} setActiveView={setActiveView} />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative w-64 h-full">
              <Sidebar 
                activeView={activeView} 
                setActiveView={(view) => {
                  setActiveView(view);
                  setSidebarOpen(false);
                }} 
              />
            </div>
          </div>
        )}
        
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
            activeView={activeView}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onMenuClick={() => setSidebarOpen(true)}
          />
          
          <MainContent
            activeView={activeView}
            searchQuery={searchQuery}
            songs={mockSongs}
            playlists={mockPlaylists}
            albums={mockAlbums}
            artists={mockArtists}
            currentSong={playerState.currentSong}
            isPlaying={playerState.isPlaying}
            onPlaySong={playSong}
            onPlayPlaylist={handlePlayPlaylist}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden">
        <MobileNav activeView={activeView} setActiveView={setActiveView} />
      </div>

      {playerState.currentSong && (
        <Player
          playerState={playerState}
          onTogglePlay={togglePlay}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onVolumeChange={setVolume}
          onSeek={seekTo}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
        />
      )}
    </div>
  );
}

export default App;