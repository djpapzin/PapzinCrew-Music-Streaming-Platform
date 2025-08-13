import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Player from './components/Player';
import MobileNav from './components/MobileNav';
import { usePlayer } from './hooks/usePlayer';
import { Routes, Route } from 'react-router-dom';
import { Song, Playlist, Album, Artist } from './types/music';
import Toast from './components/Toast';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  
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

  const API_BASE = (import.meta as any).env?.VITE_API_URL || (window.location.origin.includes('netlify') ? 'https://papzincrew-backend.onrender.com' : 'http://localhost:8000');
  const toAbsoluteUrl = (url?: string | null): string => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return `${API_BASE}${url}`;
    return `${API_BASE}/${url}`;
  };

  const fetchTracks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tracks/`);
      if (!res.ok) throw new Error(`Failed to load tracks: ${res.status}`);
      const mixes = await res.json();
      const mapped: Song[] = (mixes || []).map((mix: any) => ({
        id: String(mix.id),
        title: mix.title || 'Untitled',
        artist: (mix.artist && mix.artist.name) || 'Unknown Artist',
        album: mix.album || '',
        duration: mix.duration_seconds || 0,
        imageUrl: toAbsoluteUrl(mix.cover_art_url) || '',
        audioUrl: mix.file_path ? `${API_BASE}/tracks/${mix.id}/stream` : '',
        genre: mix.genre || '',
        year: mix.year || 0,
        playable: Boolean(mix.file_path),
      }));
      setSongs(mapped);
    } catch (err) {
      console.error('Failed to fetch tracks', err);
      setSongs([]);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  useEffect(() => {
    const handler = () => {
      fetchTracks();
    };
    // Refresh library after successful upload
    window.addEventListener('library:refresh', handler as any);
    return () => window.removeEventListener('library:refresh', handler as any);
  }, [fetchTracks]);

  const handlePlayPlaylist = (playlist: Playlist | Album) => {
    const list = 'songs' in playlist ? playlist.songs : [];
    if (list.length > 0) {
      playSong(list[0], list);
    }
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Global toast notifications */}
      <Toast />
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" playsInline crossOrigin="anonymous" />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
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
                onNavigate={() => setSidebarOpen(false)} 
              />
            </div>
          </div>
        )}
        
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onMenuClick={() => setSidebarOpen(true)}
          />
          
          <MainContent
            searchQuery={searchQuery}
            songs={songs}
            playlists={playlists}
            albums={albums}
            artists={artists}
            currentSong={playerState.currentSong}
            isPlaying={playerState.isPlaying}
            onPlaySong={playSong}
            onPlayPlaylist={handlePlayPlaylist}
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden">
        <MobileNav />
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