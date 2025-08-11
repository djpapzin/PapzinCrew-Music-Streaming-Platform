import React from 'react';
import PlaylistCard from './PlaylistCard';
import SongRow from './SongRow';
import QuickPlay from './QuickPlay';
import QuickPlayCard from './QuickPlayCard';
import UploadPage from './UploadPage';
import { Routes, Route } from 'react-router-dom';
import { Song, Playlist, Album, Artist } from '../types/music';
import { Clock, Star, TrendingUp, Users, Award, Zap, Music } from 'lucide-react';

interface MainContentProps {
  searchQuery: string;
  songs: Song[];
  playlists: Playlist[];
  albums: Album[];
  artists: Artist[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (song: Song, queue?: Song[]) => void;
  onPlayPlaylist: (playlist: Playlist | Album) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeView,
  searchQuery,
  songs,
  playlists,
  albums,
  artists,
  currentSong,
  isPlaying,
  onPlaySong,
  onPlayPlaylist
}) => {
  const filterItems = <T extends { title?: string; name?: string }>(items: T[]): T[] => {
    if (!searchQuery) return items;
    return items.filter(item => {
      const name = (item.title || item.name || '').toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });
  };

  const renderHome = () => (
    <div className="space-y-6 lg:space-y-8">
      {/* Welcome to Papzin & Crew Section */}
      <div className="bg-gradient-to-br from-purple-900/60 to-pink-900/60 rounded-xl p-6 lg:p-8 border border-purple-500/30 backdrop-blur-sm">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
            <Music className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-4xl font-bold text-white mb-2">Welcome to Papzin & Crew</h1>
            <p className="text-gray-300 text-base lg:text-lg">
              Discover independent artists and support emerging talent through our platform
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mt-6">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
            <Star className="w-6 h-6 text-yellow-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Independent Artists</h3>
            <p className="text-gray-300 text-sm">Support emerging talent and discover fresh sounds</p>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20">
            <TrendingUp className="w-6 h-6 text-green-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Trending Music</h3>
            <p className="text-gray-300 text-sm">Stay updated with the hottest tracks and artists</p>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20 sm:col-span-2 lg:col-span-1">
            <Users className="w-6 h-6 text-blue-400 mb-2" />
            <h3 className="text-white font-semibold mb-1">Community Driven</h3>
            <p className="text-gray-300 text-sm">Join a community that celebrates music diversity</p>
          </div>
        </div>
      </div>

      {/* Quick Play Section */}
      <QuickPlay
        songs={songs}
        playlists={playlists}
        onPlaySong={onPlaySong}
        onPlayPlaylist={onPlayPlaylist}
      />

      {songs.length === 0 && (
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-xl lg:text-2xl font-bold text-white mb-2">No uploads yet</h2>
          <p className="text-gray-300">Go to the Upload page to add your first track.</p>
        </div>
      )}

      {/* Featured Content Section */}
      <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-6 lg:p-8 border border-white/10">
        <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">Featured Content</h2>
        <p className="text-gray-300 text-base lg:text-lg mb-6">Handpicked selections from our curated collection</p>
        
        {/* Quick Play Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {songs.slice(0, 4).map(song => (
            <QuickPlayCard
              key={song.id}
              item={song}
              type="song"
              onPlay={() => onPlaySong(song, songs)}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.slice(0, 6).map(playlist => (
            <div
              key={playlist.id}
              onClick={() => onPlayPlaylist(playlist)}
              className="flex items-center bg-white/10 hover:bg-white/20 rounded-lg p-3 cursor-pointer transition-colors duration-200 group"
            >
              <img
                src={playlist.imageUrl}
                alt={playlist.title}
                className="w-12 h-12 rounded object-cover shadow-lg flex-shrink-0"
              />
              <span className="ml-3 text-white font-medium truncate">{playlist.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access Section */}
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <Zap className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl lg:text-2xl font-bold text-white">Quick Access</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Songs */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white mb-3">Recent Songs</h3>
            <div className="space-y-2">
              {songs.slice(0, 5).map(song => (
                <QuickPlayCard
                  key={song.id}
                  item={song}
                  type="song"
                  onPlay={() => onPlaySong(song, songs)}
                />
              ))}
            </div>
          </div>

          {/* Popular Playlists */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white mb-3">Popular Playlists</h3>
            <div className="space-y-2">
              {playlists.slice(0, 5).map(playlist => (
                <QuickPlayCard
                  key={playlist.id}
                  item={playlist}
                  type="playlist"
                  onPlay={() => onPlayPlaylist(playlist)}
                />
              ))}
            </div>
          </div>

          {/* New Albums */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white mb-3">New Albums</h3>
            <div className="space-y-2">
              {albums.map(album => (
                <QuickPlayCard
                  key={album.id}
                  item={album}
                  type="album"
                  onPlay={() => onPlayPlaylist(album)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Independent Artists Spotlight */}
      <div>
        <div className="flex items-center space-x-3 mb-6">
          <Star className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl lg:text-2xl font-bold text-white">Independent Artists Spotlight</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {playlists.filter(p => p.createdBy === 'Papzin & Crew').map(playlist => (
            <PlaylistCard
              key={playlist.id}
              item={playlist}
              onPlay={() => onPlayPlaylist(playlist)}
            />
          ))}
        </div>
      </div>

      {/* Recently Played */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Recently played</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {playlists.slice(0, 6).map(playlist => (
            <PlaylistCard
              key={playlist.id}
              item={playlist}
              onPlay={() => onPlayPlaylist(playlist)}
            />
          ))}
        </div>
      </div>

      {/* Made for you */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Made for you</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {albums.map(album => (
            <PlaylistCard
              key={album.id}
              item={album}
              onPlay={() => onPlayPlaylist(album)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderUpload = () => <UploadPage onPlaySong={onPlaySong} />;

  const renderIndependent = () => (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 rounded-xl p-6 lg:p-8 border border-yellow-500/20">
        <div className="flex items-center space-x-4 mb-4">
          <Star className="w-6 lg:w-8 h-6 lg:h-8 text-yellow-400" />
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Independent Artists</h1>
        </div>
        <p className="text-gray-300 text-base lg:text-lg">
          Discover and support emerging talent. Every stream helps independent artists grow their careers.
        </p>
      </div>

      {/* Quick Play for Independent */}
      <QuickPlay
        songs={songs.filter(song => ['Papzin & Crew', 'Local Heroes'].includes(song.artist))}
        playlists={playlists.filter(p => p.createdBy === 'Papzin & Crew')}
        onPlaySong={onPlaySong}
        onPlayPlaylist={onPlayPlaylist}
      />

      {/* Featured Independent Artists */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Featured Artists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {artists.filter(artist => artist.followers < 100000).map(artist => (
            <div key={artist.id} className="group bg-white/5 hover:bg-white/10 rounded-lg p-4 transition-all duration-300 cursor-pointer">
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="w-full aspect-square object-cover rounded-full shadow-lg mb-4"
              />
              <h3 className="text-white font-semibold text-center text-sm lg:text-base">{artist.name}</h3>
              <p className="text-gray-400 text-xs lg:text-sm text-center">{artist.followers.toLocaleString()} followers</p>
            </div>
          ))}
        </div>
      </div>

      {/* Independent Playlists */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Curated by Papzin & Crew</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {playlists.filter(p => p.createdBy === 'Papzin & Crew').map(playlist => (
            <PlaylistCard
              key={playlist.id}
              item={playlist}
              onPlay={() => onPlayPlaylist(playlist)}
            />
          ))}
        </div>
      </div>

      {/* Independent Songs */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-4">Rising Tracks</h2>
        <div className="bg-white/5 rounded-lg overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 text-gray-400 text-sm">
            <div className="col-span-1">#</div>
            <div className="col-span-5">TITLE</div>
            <div className="col-span-3">ALBUM</div>
            <div className="col-span-2">GENRE</div>
            <div className="col-span-1 flex justify-end"><Clock className="w-4 h-4" /></div>
          </div>
          {songs.filter(song => ['Papzin & Crew', 'Local Heroes'].includes(song.artist)).map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              isPlaying={currentSong?.id === song.id && isPlaying}
              onPlay={() => onPlaySong(song, songs)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderTrending = () => (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-900/30 to-teal-900/30 rounded-xl p-6 lg:p-8 border border-green-500/20">
        <div className="flex items-center space-x-4 mb-4">
          <TrendingUp className="w-6 lg:w-8 h-6 lg:h-8 text-green-400" />
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Trending Now</h1>
        </div>
        <p className="text-gray-300 text-base lg:text-lg">
          The hottest tracks and artists making waves right now.
        </p>
      </div>

      {/* Quick Play for Trending */}
      <QuickPlay
        songs={songs.slice(0, 10)}
        playlists={playlists.slice(0, 5)}
        onPlaySong={onPlaySong}
        onPlayPlaylist={onPlayPlaylist}
      />

      {/* Trending Songs */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-4">Top Tracks This Week</h2>
        <div className="bg-white/5 rounded-lg overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 text-gray-400 text-sm">
            <div className="col-span-1">#</div>
            <div className="col-span-5">TITLE</div>
            <div className="col-span-3">ALBUM</div>
            <div className="col-span-2">GENRE</div>
            <div className="col-span-1 flex justify-end"><Clock className="w-4 h-4" /></div>
          </div>
          {songs.slice(0, 10).map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              isPlaying={currentSong?.id === song.id && isPlaying}
              onPlay={() => onPlaySong(song, songs)}
            />
          ))}
        </div>
      </div>

      {/* Trending Artists */}
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Trending Artists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {artists.map(artist => (
            <div key={artist.id} className="group bg-white/5 hover:bg-white/10 rounded-lg p-4 transition-all duration-300 cursor-pointer">
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="w-full aspect-square object-cover rounded-full shadow-lg mb-4"
              />
              <h3 className="text-white font-semibold text-center text-sm lg:text-base">{artist.name}</h3>
              <p className="text-gray-400 text-xs lg:text-sm text-center">{artist.followers.toLocaleString()} followers</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSearch = () => {
    const filteredSongs = filterItems(songs);
    const filteredPlaylists = filterItems(playlists);
    const filteredAlbums = filterItems(albums);

    if (!searchQuery) {
      return (
        <div className="space-y-6 lg:space-y-8">
          <div className="text-center py-12 lg:py-20">
            <h2 className="text-xl lg:text-2xl font-bold text-white mb-4">Search for music</h2>
            <p className="text-gray-400">Find your favorite songs, artists, albums, and playlists</p>
          </div>

          {/* Quick Play in Search */}
          <QuickPlay
            songs={songs}
            playlists={playlists}
            onPlaySong={onPlaySong}
            onPlayPlaylist={onPlayPlaylist}
          />

          {/* Browse Categories */}
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Browse all</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {playlists.map(playlist => (
                <PlaylistCard
                  key={playlist.id}
                  item={playlist}
                  onPlay={() => onPlayPlaylist(playlist)}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 lg:space-y-8">
        {filteredSongs.length > 0 && (
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white mb-4">Songs</h2>
            <div className="bg-white/5 rounded-lg overflow-hidden">
              <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 text-gray-400 text-sm">
                <div className="col-span-1">#</div>
                <div className="col-span-5">TITLE</div>
                <div className="col-span-3">ALBUM</div>
                <div className="col-span-2">GENRE</div>
                <div className="col-span-1 flex justify-end"><Clock className="w-4 h-4" /></div>
              </div>
              {filteredSongs.map((song, index) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={index}
                  isPlaying={currentSong?.id === song.id && isPlaying}
                  onPlay={() => onPlaySong(song, filteredSongs)}
                />
              ))}
            </div>
          </div>
        )}

        {filteredPlaylists.length > 0 && (
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white mb-4">Playlists</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredPlaylists.map(playlist => (
                <PlaylistCard
                  key={playlist.id}
                  item={playlist}
                  onPlay={() => onPlayPlaylist(playlist)}
                />
              ))}
            </div>
          </div>
        )}

        {filteredAlbums.length > 0 && (
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-white mb-4">Albums</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredAlbums.map(album => (
                <PlaylistCard
                  key={album.id}
                  item={album}
                  onPlay={() => onPlayPlaylist(album)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLibrary = () => (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Your Playlists</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {playlists.filter(p => p.createdBy === 'You').map(playlist => (
            <PlaylistCard
              key={playlist.id}
              item={playlist}
              onPlay={() => onPlayPlaylist(playlist)}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl lg:text-2xl font-bold text-white mb-6">Recently Added</h2>
        {songs.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-6 text-gray-300">
            No recent songs yet. Upload a track to get started.
          </div>
        ) : (
          <div className="bg-white/5 rounded-lg overflow-hidden">
            <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/10 text-gray-400 text-sm">
              <div className="col-span-1">#</div>
              <div className="col-span-5">TITLE</div>
              <div className="col-span-3">ALBUM</div>
              <div className="col-span-2">GENRE</div>
              <div className="col-span-1 flex justify-end"><Clock className="w-4 h-4" /></div>
            </div>
            {songs.slice(0, 10).map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                index={index}
                isPlaying={currentSong?.id === song.id && isPlaying}
                onPlay={() => onPlaySong(song, songs)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 bg-gradient-to-b from-gray-900/50 to-black p-4 lg:p-6 overflow-y-auto pb-20 lg:pb-6">
      <Routes>
        <Route path="/" element={renderHome()} />
        <Route path="/search" element={renderSearch()} />
        <Route path="/library" element={renderLibrary()} />
        <Route path="/playlists" element={renderLibrary()} />
        <Route path="/artists" element={renderLibrary()} />
        <Route path="/albums" element={renderLibrary()} />
        <Route path="/liked" element={renderLibrary()} />
        <Route path="/independent" element={renderIndependent()} />
        <Route path="/trending" element={renderTrending()} />
        <Route path="/upload" element={renderUpload()} />
      </Routes>
    </div>
  );
};

export default MainContent;