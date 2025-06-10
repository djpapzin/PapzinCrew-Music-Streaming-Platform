import React, { useState, useEffect } from 'react';
import UploadForm from './components/UploadForm';
import MusicPlayer from './components/MusicPlayer';
import axios from 'axios';

// Configure axios default settings
axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.headers.common['Accept'] = 'application/json';
axios.defaults.headers.post['Content-Type'] = 'application/json';
axios.defaults.timeout = 10000; // 10 seconds timeout

function App() {
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch songs when component mounts
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    try {
      setLoading(true);
      setError(null); // Reset any previous errors
      
      console.log('Attempting to fetch songs from API...');
      const response = await axios.get('/api/mixes');
      
      console.log('Songs fetched successfully:', response.data);
      setSongs(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching songs:', err);
      setError(`Failed to fetch songs: ${err.message || 'Unknown error'}. The server might be offline.`);
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    fetchSongs(); // Refresh song list after successful upload
  };

  const handleSongSelect = (song) => {
    setCurrentSong(song);
  };

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <header className="bg-gradient-to-r from-purple-800 to-blue-700 p-4 shadow-lg">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-center">PapzinCrew Music Player</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Upload New Track</h2>
            <UploadForm onUploadSuccess={handleUploadSuccess} />
          </div>

          <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Available Tracks</h2>
            {loading ? (
              <p className="text-gray-400">Loading songs...</p>
            ) : error ? (
              <p className="text-red-400">{error}</p>
            ) : songs.length === 0 ? (
              <p className="text-gray-400">No tracks available. Upload one to get started!</p>
            ) : (
              <ul className="space-y-2">
                {songs.map((song) => (
                  <li
                    key={song.id}
                    onClick={() => handleSongSelect(song)}
                    className={`p-3 rounded cursor-pointer transition hover:bg-gray-700 ${
                      currentSong && currentSong.id === song.id ? 'bg-blue-900' : 'bg-gray-700'
                    }`}
                  >
                    <div className="font-medium">{song.title}</div>
                    <div className="text-sm text-gray-300">{song.description}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {currentSong && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
            <MusicPlayer song={currentSong} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
