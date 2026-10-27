import { playbackUrl } from './lib/playbackUrl';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainContent from './components/MainContent';
import Player from './components/Player';
import PlaybackTiming from './components/PlaybackTiming';
import MobileNav from './components/MobileNav';
import { usePlayer } from './hooks/usePlayer';
import { Song, Playlist, Album, Artist } from './types/music';
import Toast from './components/Toast';
import { API_BASE, toAbsoluteApiUrl } from './lib/api';
import { originalArtworkForTrack, generatedArtworkForTrack, safeArtworkUrl } from './lib/artwork';
import { LibraryProvider } from './state/LibraryContext';

const INTERNAL_PROBE_TRACK_PATTERNS = [
  /^(?:origin probe|redeploy(?: fresh)? probe|phoneuploadtest)\b/i,
  /^b2 proof\b/i,
  /^starter mix\s+\d+\s+\d{8}$/i,
  /\bproof\s+20\d{6,}/i,
];

const isPublicTrack = (mix: any): boolean => {
  if (mix?.availability && String(mix.availability).toLowerCase() !== 'public') return false;
  const title = String(mix?.title || '').trim();
  if (!title) return true;
  return !INTERNAL_PROBE_TRACK_PATTERNS.some((pattern) => pattern.test(title));
};

function App() {
  const [playerOpenRequest, setPlayerOpenRequest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists] = useState<Playlist[]>([]);
  const [albums] = useState<Album[]>([]);
  const [artists] = useState<Artist[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState<string | null>(null);
  
  const {
    audioRef,
    playbackAttempts,
    timingStorageError,
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

  const fetchTracks = useCallback(async () => {
    setTracksLoading(true);
    setTracksError(null);
    try {
      // Render free instances can outlast Netlify's proxy timeout on a cold start.
      // Retry once through the backend origin before showing a recoverable error.
      let res = await fetch(`${API_BASE}/tracks/?limit=1000`);
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        res = await fetch('https://papzincrew-backend.onrender.com/tracks/?limit=1000');
      }
      if (!res.ok) {
        let message = `Failed to load tracks (${res.status})`;

        if (res.status >= 500) {
          message = `Catalog service unavailable (${res.status}).`;
        } else if (res.status === 404) {
          message = 'Catalog endpoint not found (404).';
        } else if (res.status === 401 || res.status === 403) {
          message = `Catalog request blocked (${res.status}).`;
        }

        let responseBody = '';
        try {
          responseBody = await res.text();
        } catch {
          responseBody = '';
        }

        console.error('Failed to load tracks response', {
          status: res.status,
          body: responseBody.slice(0, 500),
        });

        throw new Error(message);
      }
      const mixes = await res.json();
      const publicMixes = (mixes || []).filter((mix: any) => isPublicTrack(mix));
      const visibleMixes = publicMixes;
      const mapped: Song[] = visibleMixes.map((mix: any) => ({
        id: String(mix.id),
        title: mix.title || 'Untitled',
        artist: (mix.artist && mix.artist.name) || 'Unknown Artist',
        album: mix.album || '',
        duration: mix.duration_seconds || 0,
        imageUrl: safeArtworkUrl(originalArtworkForTrack(mix.id, mix.title) ?? (mix.cover_art_url?.trim() ? toAbsoluteApiUrl(mix.cover_art_url) : generatedArtworkForTrack(mix.id, mix.title))),
        audioUrl: playbackUrl(mix),
        genre: mix.genre || '',
        year: mix.year || 0,
        playable: Boolean(mix.file_path),
        description: typeof mix.description === "string" ? mix.description : "",
        tracklist: typeof mix.tracklist === "string" ? mix.tracklist : "",
      }));
      setSongs(mapped);
      setTracksError(null);
    } catch (err) {
      console.error('Failed to fetch tracks', err);
      setSongs([]);
      setTracksError(err instanceof Error ? err.message : 'Unable to load tracks.');
    } finally {
      setTracksLoading(false);
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

  // Only an explicit selection opens the mobile player. Resume and queue
  // advancement use the player's existing actions without changing this token.
  const handlePlaySong = (song: Song, queue?: Song[]) => {
    if (playerState.currentSong?.id === song.id) {
      if (!playerState.isPlaying) togglePlay();
      return;
    }
    if (!song.audioUrl || song.playable === false) return;
    setPlayerOpenRequest(request => request + 1);
    playSong(song, queue);
  };

  const handlePlayPlaylist = (playlist: Playlist | Album) => {
    const list = 'songs' in playlist ? playlist.songs : [];
    if (list.length > 0) {
      handlePlaySong(list[0], list);
    }
  };

  return (
    <LibraryProvider songs={songs}><div className="app-shell bg-black text-white flex flex-col">
      {/* Global toast notifications */}
      <Toast />
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" playsInline />
      
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
          
          <PlaybackTiming attempts={playbackAttempts} storageError={timingStorageError} />
          <MainContent
            searchQuery={searchQuery}
            songs={songs}
            playlists={playlists}
            albums={albums}
            artists={artists}
            tracksLoading={tracksLoading}
            tracksError={tracksError}
            currentSong={playerState.currentSong}
            isPlaying={playerState.isPlaying}
            volume={playerState.volume}
            setVolume={setVolume}
            onRetry={fetchTracks}
            onPlaySong={handlePlaySong}
            onTogglePlay={togglePlay}
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
          openRequest={playerOpenRequest}
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
    </div></LibraryProvider>
  );
}

export default App;
