import React, { useState, useRef, useEffect } from 'react';
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp, FaInfoCircle } from 'react-icons/fa';

function MusicPlayer({ song }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);

  useEffect(() => {
    // Reset player when song changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [song]);

  // Handle metadata loaded
  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  // Handle time update
  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle seek
  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Format time to MM:SS
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate the URL for the song
  const getSongUrl = () => {
    // If the song has a url property (from Cloudinary), use it
    if (song.url) return song.url;
    
    // Otherwise, construct the URL to stream from our backend
    return `http://localhost:5000/api/mixes/${song.id}`;
  };
  
  // State to track if current song is a demo with no audio
  const [isDemo, setIsDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');

  // Check if the current song is a demo track when component mounts or song changes
  useEffect(() => {
    if (song && song.id) {
      // Reset demo state when song changes
      setIsDemo(false);
      setDemoMessage('');
      
      // Check if this is the demo track
      fetch(`http://localhost:5000/api/mixes/${song.id}`)
        .then(response => response.json())
        .then(data => {
          if (data.demoTrack) {
            setIsDemo(true);
            setDemoMessage(data.message || 'This is a demo track with no audio file.');
          }
        })
        .catch(err => {
          console.error('Error checking if track is demo:', err);
        });
    }
  }, [song]);
  
  // Handle errors during audio loading
  const handleAudioError = (e) => {
    console.error('Error loading audio:', e);
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-bold text-white truncate">{song.title}</h2>
        <p className="text-gray-400 truncate">{song.description}</p>
        
        {isDemo && (
          <div className="flex items-center p-3 bg-yellow-900 text-yellow-200 rounded-md">
            <FaInfoCircle className="mr-2" />
            <p>{demoMessage}</p>
          </div>
        )}
      </div>

      {!isDemo && (
        <audio 
          ref={audioRef} 
          src={getSongUrl()}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onError={handleAudioError}
        />
      )}

      <div className="flex flex-col space-y-4">
        {/* Progress bar */}
        <div className="flex items-center space-x-3">
          <span className="text-sm">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-grow h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4 items-center">
          <button 
            onClick={togglePlayPause}
            className="bg-purple-600 hover:bg-purple-700 w-12 h-12 rounded-full flex items-center justify-center"
          >
            {isPlaying ? (
              <span className="text-2xl">⏸</span> // Pause symbol
            ) : (
              <span className="text-2xl">▶</span> // Play symbol
            )}
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center space-x-3">
          <span className="text-sm">🔈</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-grow h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm">🔊</span>
        </div>
      </div>
    </div>
  );
}

export default MusicPlayer;
