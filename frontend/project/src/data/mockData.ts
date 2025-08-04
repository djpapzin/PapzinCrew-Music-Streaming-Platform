import { Song, Album, Playlist, Artist } from '../types/music';

export const mockSongs: Song[] = [
  {
    id: '1',
    title: 'Midnight Dreams',
    artist: 'Luna Eclipse',
    album: 'Nocturnal Vibes',
    duration: 245,
    imageUrl: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Electronic',
    year: 2024
  },
  {
    id: '2',
    title: 'Ocean Waves',
    artist: 'Coastal Sounds',
    album: 'Nature\'s Symphony',
    duration: 312,
    imageUrl: 'https://images.pexels.com/photos/1738986/pexels-photo-1738986.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Ambient',
    year: 2023
  },
  {
    id: '3',
    title: 'City Lights',
    artist: 'Urban Rhythm',
    album: 'Metropolitan',
    duration: 198,
    imageUrl: 'https://images.pexels.com/photos/374710/pexels-photo-374710.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Hip Hop',
    year: 2024
  },
  {
    id: '4',
    title: 'Mountain Peak',
    artist: 'Alpine Dreams',
    album: 'High Altitude',
    duration: 267,
    imageUrl: 'https://images.pexels.com/photos/1624438/pexels-photo-1624438.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Folk',
    year: 2023
  },
  {
    id: '5',
    title: 'Neon Nights',
    artist: 'Synthwave Studios',
    album: 'Retro Future',
    duration: 289,
    imageUrl: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Synthwave',
    year: 2024
  },
  // Adding Papzin & Crew featured content
  {
    id: '6',
    title: 'Rising Star',
    artist: 'Papzin & Crew',
    album: 'Independent Voices',
    duration: 234,
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Hip Hop',
    year: 2024
  },
  {
    id: '7',
    title: 'Underground Anthem',
    artist: 'Local Heroes',
    album: 'Street Stories',
    duration: 198,
    imageUrl: 'https://images.pexels.com/photos/1587927/pexels-photo-1587927.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Rap',
    year: 2024
  },
  // South African Genre Songs
  {
    id: '8',
    title: 'Ke Star',
    artist: 'Focalistic ft. Davido',
    album: 'Amapiano Vibes',
    duration: 213,
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Amapiano',
    year: 2024
  },
  {
    id: '9',
    title: 'Umsebenzi Wethu',
    artist: 'Busta 929 ft. Mpura',
    album: 'Piano Sessions',
    duration: 267,
    imageUrl: 'https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Amapiano',
    year: 2024
  },
  {
    id: '10',
    title: 'Siyathandana',
    artist: 'Cassper Nyovest ft. Abidoza',
    album: 'Piano Love',
    duration: 245,
    imageUrl: 'https://images.pexels.com/photos/1738986/pexels-photo-1738986.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Amapiano',
    year: 2024
  },
  {
    id: '11',
    title: 'Midnight House',
    artist: 'Black Coffee',
    album: 'Deep House Sessions',
    duration: 298,
    imageUrl: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'House',
    year: 2024
  },
  {
    id: '12',
    title: 'Deep Feelings',
    artist: 'Culoe De Song',
    album: 'House Nation',
    duration: 312,
    imageUrl: 'https://images.pexels.com/photos/374710/pexels-photo-374710.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'House',
    year: 2024
  },
  {
    id: '13',
    title: 'Spiritual Awakening',
    artist: 'Atmos Blaq',
    album: 'House Therapy',
    duration: 287,
    imageUrl: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'House',
    year: 2024
  },
  {
    id: '14',
    title: 'African Spirit',
    artist: 'Burna Boy',
    album: 'Afro Fusion',
    duration: 234,
    imageUrl: 'https://images.pexels.com/photos/1624438/pexels-photo-1624438.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Afro',
    year: 2024
  },
  {
    id: '15',
    title: 'Lagos Nights',
    artist: 'Wizkid',
    album: 'Afrobeats Collection',
    duration: 198,
    imageUrl: 'https://images.pexels.com/photos/1587927/pexels-photo-1587927.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Afro',
    year: 2024
  },
  {
    id: '16',
    title: 'Ubuntu',
    artist: 'Master KG',
    album: 'African Rhythms',
    duration: 256,
    imageUrl: 'https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Afro',
    year: 2024
  },
  {
    id: '17',
    title: 'Durban Fever',
    artist: 'DJ Lag',
    album: 'Gqom Nation',
    duration: 189,
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Gqom',
    year: 2024
  },
  {
    id: '18',
    title: 'Township Vibes',
    artist: 'Distruction Boyz',
    album: 'Gqom Revolution',
    duration: 201,
    imageUrl: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Gqom',
    year: 2024
  },
  {
    id: '19',
    title: 'Sgubhu Sounds',
    artist: 'Babes Wodumo',
    album: 'Gqom Queen',
    duration: 178,
    imageUrl: 'https://images.pexels.com/photos/374710/pexels-photo-374710.jpeg?auto=compress&cs=tinysrgb&w=300',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
    genre: 'Gqom',
    year: 2024
  }
];

export const mockAlbums: Album[] = [
  {
    id: '1',
    title: 'Nocturnal Vibes',
    artist: 'Luna Eclipse',
    imageUrl: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=300',
    year: 2024,
    genre: 'Electronic',
    songs: [mockSongs[0]]
  },
  {
    id: '2',
    title: 'Nature\'s Symphony',
    artist: 'Coastal Sounds',
    imageUrl: 'https://images.pexels.com/photos/1738986/pexels-photo-1738986.jpeg?auto=compress&cs=tinysrgb&w=300',
    year: 2023,
    genre: 'Ambient',
    songs: [mockSongs[1]]
  },
  {
    id: '3',
    title: 'Independent Voices',
    artist: 'Papzin & Crew',
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    year: 2024,
    genre: 'Hip Hop',
    songs: [mockSongs[5]]
  }
];

export const mockPlaylists: Playlist[] = [
  // Machine-generated playlists only
  {
    id: '1',
    title: 'Discover Weekly',
    description: 'Your weekly mix of fresh discoveries and personalized recommendations',
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: mockSongs.slice(0, 8),
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  {
    id: '2',
    title: 'Rising Stars',
    description: 'Tomorrow\'s headliners, today\'s discoveries - algorithmically curated',
    imageUrl: 'https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: [mockSongs[5], mockSongs[6], mockSongs[2], mockSongs[7]],
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  {
    id: '3',
    title: 'Daily Mix 1',
    description: 'Made for you based on your listening habits',
    imageUrl: 'https://images.pexels.com/photos/1587927/pexels-photo-1587927.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: [mockSongs[0], mockSongs[4], mockSongs[8], mockSongs[11]],
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  // South African Genre Playlists
  {
    id: '4',
    title: 'Amapiano',
    description: 'The hottest Amapiano tracks from South Africa',
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: [mockSongs[7], mockSongs[8], mockSongs[9]],
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  {
    id: '5',
    title: 'House',
    description: 'Deep house vibes from the motherland',
    imageUrl: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: [mockSongs[10], mockSongs[11], mockSongs[12]],
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  {
    id: '6',
    title: 'Afro',
    description: 'Afrobeats and Afro fusion hits',
    imageUrl: 'https://images.pexels.com/photos/1624438/pexels-photo-1624438.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: [mockSongs[13], mockSongs[14], mockSongs[15]],
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  {
    id: '7',
    title: 'Gqom',
    description: 'Raw Gqom beats straight from Durban',
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: [mockSongs[16], mockSongs[17], mockSongs[18]],
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  {
    id: '8',
    title: 'Release Radar',
    description: 'Catch all the latest releases from artists you follow',
    imageUrl: 'https://images.pexels.com/photos/1738986/pexels-photo-1738986.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: mockSongs.slice(-6),
    createdBy: 'Papzin & Crew',
    isPublic: true
  },
  {
    id: '9',
    title: 'On Repeat',
    description: 'Songs you can\'t stop playing, automatically updated',
    imageUrl: 'https://images.pexels.com/photos/374710/pexels-photo-374710.jpeg?auto=compress&cs=tinysrgb&w=300',
    songs: [mockSongs[7], mockSongs[10], mockSongs[13], mockSongs[5]],
    createdBy: 'Papzin & Crew',
    isPublic: true
  }
];

export const mockArtists: Artist[] = [
  {
    id: '1',
    name: 'Luna Eclipse',
    imageUrl: 'https://images.pexels.com/photos/1587927/pexels-photo-1587927.jpeg?auto=compress&cs=tinysrgb&w=300',
    followers: 125000,
    genres: ['Electronic', 'Ambient'],
    albums: [mockAlbums[0]]
  },
  {
    id: '2',
    name: 'Coastal Sounds',
    imageUrl: 'https://images.pexels.com/photos/1300402/pexels-photo-1300402.jpeg?auto=compress&cs=tinysrgb&w=300',
    followers: 89000,
    genres: ['Ambient', 'Nature'],
    albums: [mockAlbums[1]]
  },
  {
    id: '3',
    name: 'Papzin & Crew',
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    followers: 15000,
    genres: ['Hip Hop', 'Rap'],
    albums: [mockAlbums[2]]
  },
  // South African Artists
  {
    id: '4',
    name: 'Focalistic',
    imageUrl: 'https://images.pexels.com/photos/1587927/pexels-photo-1587927.jpeg?auto=compress&cs=tinysrgb&w=300',
    followers: 850000,
    genres: ['Amapiano', 'Hip Hop'],
    albums: []
  },
  {
    id: '5',
    name: 'Black Coffee',
    imageUrl: 'https://images.pexels.com/photos/167636/pexels-photo-167636.jpeg?auto=compress&cs=tinysrgb&w=300',
    followers: 2100000,
    genres: ['House', 'Deep House'],
    albums: []
  },
  {
    id: '6',
    name: 'Burna Boy',
    imageUrl: 'https://images.pexels.com/photos/1624438/pexels-photo-1624438.jpeg?auto=compress&cs=tinysrgb&w=300',
    followers: 3200000,
    genres: ['Afro', 'Afrobeats'],
    albums: []
  },
  {
    id: '7',
    name: 'DJ Lag',
    imageUrl: 'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=300',
    followers: 45000,
    genres: ['Gqom'],
    albums: []
  }
];