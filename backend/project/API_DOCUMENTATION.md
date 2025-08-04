# API Documentation - Papzin & Crew

## 🌐 API Overview

This document outlines the planned API structure for the Papzin & Crew music streaming platform. Currently, the application uses mock data, but this documentation serves as a blueprint for future backend implementation.

## 🏗️ API Architecture

### Base URL
```
Production: https://api.papzincrew.com/v1
Staging: https://staging-api.papzincrew.com/v1
Development: http://localhost:3001/api/v1
```

### Authentication
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 🎵 Songs API

### Get All Songs
```http
GET /songs
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `genre` (string): Filter by genre
- `artist` (string): Filter by artist name
- `year` (number): Filter by release year
- `sort` (string): Sort by (title, artist, year, duration, popularity)
- `order` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "songs": [
      {
        "id": "song_123",
        "title": "Midnight Dreams",
        "artist": "Luna Eclipse",
        "album": "Nocturnal Vibes",
        "duration": 245,
        "imageUrl": "https://cdn.papzincrew.com/images/songs/song_123.jpg",
        "audioUrl": "https://cdn.papzincrew.com/audio/songs/song_123.mp3",
        "genre": "Electronic",
        "year": 2024,
        "playCount": 15420,
        "likes": 892,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 25,
      "totalItems": 500,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Get Song by ID
```http
GET /songs/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "song_123",
    "title": "Midnight Dreams",
    "artist": "Luna Eclipse",
    "album": "Nocturnal Vibes",
    "duration": 245,
    "imageUrl": "https://cdn.papzincrew.com/images/songs/song_123.jpg",
    "audioUrl": "https://cdn.papzincrew.com/audio/songs/song_123.mp3",
    "genre": "Electronic",
    "year": 2024,
    "playCount": 15420,
    "likes": 892,
    "isLiked": false,
    "lyrics": "Song lyrics here...",
    "credits": {
      "producer": "John Producer",
      "writer": "Luna Eclipse",
      "engineer": "Sound Engineer"
    },
    "relatedSongs": ["song_124", "song_125"],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Search Songs
```http
GET /songs/search?q={query}
```

**Query Parameters:**
- `q` (string, required): Search query
- `page` (number): Page number
- `limit` (number): Items per page
- `filters` (object): Additional filters

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "song_123",
        "title": "Midnight Dreams",
        "artist": "Luna Eclipse",
        "album": "Nocturnal Vibes",
        "imageUrl": "https://cdn.papzincrew.com/images/songs/song_123.jpg",
        "duration": 245,
        "relevanceScore": 0.95
      }
    ],
    "totalResults": 42,
    "searchTime": "0.15s",
    "suggestions": ["midnight", "dreams", "luna eclipse"]
  }
}
```

## 🎤 Artists API

### Get All Artists
```http
GET /artists
```

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page
- `genre` (string): Filter by genre
- `country` (string): Filter by country
- `verified` (boolean): Filter verified artists
- `independent` (boolean): Filter independent artists

**Response:**
```json
{
  "success": true,
  "data": {
    "artists": [
      {
        "id": "artist_123",
        "name": "Luna Eclipse",
        "imageUrl": "https://cdn.papzincrew.com/images/artists/artist_123.jpg",
        "followers": 125000,
        "genres": ["Electronic", "Ambient"],
        "country": "South Africa",
        "verified": true,
        "independent": true,
        "bio": "Electronic music producer from Cape Town...",
        "socialLinks": {
          "instagram": "https://instagram.com/lunaeclipse",
          "twitter": "https://twitter.com/lunaeclipse",
          "website": "https://lunaeclipse.com"
        },
        "stats": {
          "totalPlays": 2500000,
          "monthlyListeners": 45000,
          "totalSongs": 24,
          "totalAlbums": 3
        }
      }
    ]
  }
}
```

### Get Artist by ID
```http
GET /artists/{id}
```

### Follow/Unfollow Artist
```http
POST /artists/{id}/follow
DELETE /artists/{id}/follow
```

## 📀 Albums API

### Get All Albums
```http
GET /albums
```

### Get Album by ID
```http
GET /albums/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "album_123",
    "title": "Nocturnal Vibes",
    "artist": {
      "id": "artist_123",
      "name": "Luna Eclipse"
    },
    "imageUrl": "https://cdn.papzincrew.com/images/albums/album_123.jpg",
    "year": 2024,
    "genre": "Electronic",
    "totalDuration": 2847,
    "totalTracks": 12,
    "songs": [
      {
        "id": "song_123",
        "title": "Midnight Dreams",
        "duration": 245,
        "trackNumber": 1
      }
    ],
    "description": "A journey through electronic soundscapes...",
    "recordLabel": "Independent",
    "releaseDate": "2024-01-15",
    "credits": {
      "producer": "Luna Eclipse",
      "mastering": "Master Studio",
      "artwork": "Visual Artist"
    }
  }
}
```

## 🎶 Playlists API

### Get User Playlists
```http
GET /playlists
```

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

### Create Playlist
```http
POST /playlists
```

**Request Body:**
```json
{
  "title": "My Awesome Playlist",
  "description": "A collection of my favorite tracks",
  "isPublic": true,
  "imageUrl": "https://example.com/playlist-cover.jpg"
}
```

### Add Song to Playlist
```http
POST /playlists/{id}/songs
```

**Request Body:**
```json
{
  "songId": "song_123",
  "position": 5
}
```

### Remove Song from Playlist
```http
DELETE /playlists/{id}/songs/{songId}
```

### Update Playlist Order
```http
PUT /playlists/{id}/reorder
```

**Request Body:**
```json
{
  "songIds": ["song_123", "song_124", "song_125"]
}
```

## 🔍 Search API

### Global Search
```http
GET /search?q={query}&type={type}
```

**Query Parameters:**
- `q` (string, required): Search query
- `type` (string): Search type (all, songs, artists, albums, playlists)
- `limit` (number): Results per category

**Response:**
```json
{
  "success": true,
  "data": {
    "songs": {
      "results": [...],
      "total": 25
    },
    "artists": {
      "results": [...],
      "total": 8
    },
    "albums": {
      "results": [...],
      "total": 12
    },
    "playlists": {
      "results": [...],
      "total": 15
    },
    "totalResults": 60,
    "searchTime": "0.23s"
  }
}
```

## 📤 Upload API

### Upload Track
```http
POST /upload/track
```

**Headers:**
```http
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `audioFile` (file): Audio file (MP3, WAV, FLAC)
- `imageFile` (file, optional): Cover art image
- `title` (string): Track title
- `description` (string, optional): Track description
- `genre` (string): Music genre
- `tags` (string): Comma-separated tags
- `isPublic` (boolean): Public visibility
- `allowDownloads` (boolean): Allow downloads

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_123",
    "status": "processing",
    "estimatedTime": "2-5 minutes",
    "trackId": null
  }
}
```

### Check Upload Status
```http
GET /upload/status/{uploadId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_123",
    "status": "completed",
    "progress": 100,
    "trackId": "song_456",
    "errors": null,
    "processedAt": "2024-01-15T10:35:00Z"
  }
}
```

### Get Upload History
```http
GET /upload/history
```

## 👤 User API

### Get User Profile
```http
GET /users/me
```

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "username": "musiclover",
    "email": "user@example.com",
    "displayName": "Music Lover",
    "avatar": "https://cdn.papzincrew.com/avatars/user_123.jpg",
    "isArtist": false,
    "isVerified": false,
    "country": "South Africa",
    "joinedAt": "2023-06-15T10:30:00Z",
    "stats": {
      "totalPlaylists": 12,
      "totalFollowing": 45,
      "totalFollowers": 23,
      "totalListeningTime": 125400
    },
    "preferences": {
      "autoplay": true,
      "highQuality": true,
      "notifications": {
        "newReleases": true,
        "recommendations": true
      }
    }
  }
}
```

### Update User Profile
```http
PUT /users/me
```

### Get User's Liked Songs
```http
GET /users/me/liked-songs
```

### Like/Unlike Song
```http
POST /songs/{id}/like
DELETE /songs/{id}/like
```

## 📊 Analytics API

### Get Song Analytics
```http
GET /analytics/songs/{id}
```

**Headers:**
```http
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "songId": "song_123",
    "totalPlays": 15420,
    "uniqueListeners": 8945,
    "averageListenDuration": 180,
    "completionRate": 0.73,
    "demographics": {
      "countries": {
        "South Africa": 45,
        "Nigeria": 25,
        "Kenya": 15,
        "Ghana": 10,
        "Other": 5
      },
      "ageGroups": {
        "18-24": 35,
        "25-34": 40,
        "35-44": 20,
        "45+": 5
      }
    },
    "timeline": [
      {
        "date": "2024-01-15",
        "plays": 245,
        "uniqueListeners": 189
      }
    ]
  }
}
```

## 🎯 Recommendations API

### Get Personalized Recommendations
```http
GET /recommendations
```

**Query Parameters:**
- `type` (string): Recommendation type (songs, artists, playlists)
- `limit` (number): Number of recommendations
- `seed` (string): Seed for recommendations (song_id, artist_id)

### Get Similar Songs
```http
GET /songs/{id}/similar
```

### Get Trending Content
```http
GET /trending
```

**Query Parameters:**
- `type` (string): Content type (songs, artists, playlists)
- `timeframe` (string): Time period (day, week, month, year)
- `genre` (string): Filter by genre
- `country` (string): Filter by country

## 🔐 Authentication API

### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "username": "musiclover",
  "displayName": "Music Lover",
  "country": "South Africa"
}
```

### Login User
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "username": "musiclover",
      "displayName": "Music Lover"
    }
  }
}
```

### Refresh Token
```http
POST /auth/refresh
```

### Logout
```http
POST /auth/logout
```

## 📱 Mobile API Considerations

### Offline Sync
```http
GET /sync/delta?since={timestamp}
```

### Reduced Data Endpoints
```http
GET /songs/lite
GET /playlists/lite
```

## 🚨 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## 📈 Rate Limiting

### Rate Limits by Endpoint Type
- **Authentication**: 5 requests per minute
- **Search**: 100 requests per minute
- **Upload**: 10 requests per hour
- **General API**: 1000 requests per hour
- **Streaming**: Unlimited (with fair use policy)

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642262400
```

## 🔒 Security

### API Key Authentication (Public Endpoints)
```http
X-API-Key: your_api_key_here
```

### JWT Token Structure
```json
{
  "sub": "user_123",
  "iat": 1642259200,
  "exp": 1642262800,
  "scope": ["read", "write"],
  "role": "user"
}
```

### CORS Configuration
```http
Access-Control-Allow-Origin: https://papzincrew.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, X-API-Key
```

## 📊 Monitoring and Logging

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "storage": "healthy",
    "cache": "healthy"
  }
}
```

### API Metrics
```http
GET /metrics
```

---

This API documentation provides a comprehensive blueprint for the backend implementation of the Papzin & Crew music streaming platform, covering all major functionality and following REST API best practices.