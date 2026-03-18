import { Song, Playlist, Album, Artist } from '../types/music';

const placeholderCover = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=600&q=80';
const placeholderAudio = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

export const mockSongs: Song[] = [
  {
    id: 'song-1',
    title: 'Midnight Signal',
    artist: 'Papzin & Crew',
    album: 'Neon Drift',
    duration: 213,
    imageUrl: placeholderCover,
    audioUrl: placeholderAudio,
    genre: 'Afro Fusion',
    year: 2026,
  },
  {
    id: 'song-2',
    title: 'City Echoes',
    artist: 'Local Heroes',
    album: 'Street Stories',
    duration: 187,
    imageUrl: placeholderCover,
    audioUrl: placeholderAudio,
    genre: 'Hip Hop',
    year: 2025,
  },
];

export const mockAlbums: Album[] = [
  {
    id: 'album-1',
    title: 'Neon Drift',
    artist: 'Papzin & Crew',
    imageUrl: placeholderCover,
    year: 2026,
    songs: [mockSongs[0]],
    genre: 'Afro Fusion',
  },
  {
    id: 'album-2',
    title: 'Street Stories',
    artist: 'Local Heroes',
    imageUrl: placeholderCover,
    year: 2025,
    songs: [mockSongs[1]],
    genre: 'Hip Hop',
  },
];

export const mockPlaylists: Playlist[] = [
  {
    id: 'playlist-1',
    title: 'Papzin Rising',
    description: 'Fresh independent sounds from Papzin & Crew.',
    imageUrl: placeholderCover,
    songs: mockSongs,
    createdBy: 'Papzin & Crew',
    isPublic: true,
  },
  {
    id: 'playlist-2',
    title: 'Local Heat',
    description: 'Street-tested records from breakout artists.',
    imageUrl: placeholderCover,
    songs: [mockSongs[1]],
    createdBy: 'Community Picks',
    isPublic: true,
  },
];

export const mockArtists: Artist[] = [
  {
    id: 'artist-1',
    name: 'Papzin & Crew',
    imageUrl: placeholderCover,
    followers: 24500,
    genres: ['Afro Fusion', 'Hip Hop'],
    albums: [mockAlbums[0]],
  },
  {
    id: 'artist-2',
    name: 'Local Heroes',
    imageUrl: placeholderCover,
    followers: 18200,
    genres: ['Hip Hop'],
    albums: [mockAlbums[1]],
  },
];

export default {
  mockSongs,
  mockPlaylists,
  mockAlbums,
  mockArtists,
};
