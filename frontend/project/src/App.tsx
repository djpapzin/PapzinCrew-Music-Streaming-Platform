import { useLocation } from 'react-router-dom';
import { recordVisit } from './lib/anonymousUsage';
import { fetchCatalog } from './lib/fetchCatalog';
import { playbackUrl } from './lib/playbackUrl';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  const location=useLocation();
  useEffect(()=>{recordVisit();},[]);
  const [playerOpenRequest, setPlayerOpenRequest] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists] = useState<Playlist[]>([]);
  const [albums] = useState<Album[]>([]);
  const [artists] = useState<Artist[]>([]);
  const catalogAbort = useRef<AbortController | null>(null);
  const catalogRetry = useRef<number>();
  const catalogFailures = useRef(0);
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

  const fetchTracks = useCallback(async (): Promise<void> => {
    window.clearTimeout(catalogRetry.current);
    catalogAbort.current?.abort();
    const controller = new AbortController();
    catalogAbort.current = controller;
    setTracksLoading(true);
    setTracksError(null);
    try {
      const mixes = await fetchCatalog(API_BASE, controller.signal);
      if (controller.signal.aborted) return;
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
      catalogFailures.current = 0;
      setTracksError(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Failed to fetch tracks', err);
      setTracksError(err instanceof Error ? err.message : 'Unable to load tracks.');
      if (!(err instanceof Error && 'retryable' in err && err.retryable === false)) {
        const delay = [5000, 15000, 30000][catalogFailures.current++];
        if (delay !== undefined) catalogRetry.current = window.setTimeout(() => void fetchTracks(), delay);
      } else catalogFailures.current = 0;
    } finally {
      if (catalogAbort.current === controller) setTracksLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    void fetchTracks();
    const recover = () => { if (catalogFailures.current > 0) void fetchTracks(); };
    const visible = () => { if (document.visibilityState === 'visible') recover(); };
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearTimeout(catalogRetry.current);
      catalogAbort.current?.abort();
      window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', visible);
    };
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
          <Sidebar playerActive={Boolean(playerState.currentSong)} />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div 
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative w-64 h-full">
              <Sidebar playerActive={Boolean(playerState.currentSong)}
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
          
          {location.pathname==='/settings'&&<PlaybackTiming attempts={playbackAttempts} storageError={timingStorageError} />}
          <MainContent
            searchQuery={searchQuery}
            songs={songs}
            playlists={playlists}
            albums={albums}
            artists={artists}
            playbackPending={playbackAttempts[0]?.status==='waiting'}
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
          isLoading={playbackAttempts[0]?.status==='waiting'}
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
