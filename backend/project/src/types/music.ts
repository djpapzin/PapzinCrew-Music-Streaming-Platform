export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  imageUrl: string;
  audioUrl: string;
  genre: string;
  year: number;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  year: number;
  songs: Song[];
  genre: string;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  songs: Song[];
  createdBy: string;
  isPublic: boolean;
}

export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  followers: number;
  genres: string[];
  albums: Album[];
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  queue: Song[];
  currentIndex: number;
  shuffle: boolean;
  repeat: 'none' | 'one' | 'all';
}