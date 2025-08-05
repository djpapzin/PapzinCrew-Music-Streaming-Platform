# PapzinCrew Music Streaming Platform - Quick Start Guide

## 🚀 Getting Started

This guide will help you quickly start both the backend and frontend servers for the PapzinCrew Music Streaming Platform with AI-assisted upload functionality.

## Prerequisites

- Python 3.8+ installed
- Node.js 16+ installed
- Git installed

## 🔧 Quick Start Commands

### 1. Start Python FastAPI Backend

```bash
cd backend
# Activate virtual environment if needed (Windows)
# .venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start React Frontend

```bash
cd frontend/project
npm install
npm run dev
```

## 🎵 Features Available

Once both servers are running, you'll have access to:

- **AI-Assisted Upload**: Automatic metadata extraction from audio files
- **Real-time Progress**: Visual upload progress tracking
- **Auto-play Integration**: Uploaded tracks automatically start playing
- **Cover Art Display**: Extracted album artwork from audio files
- **Seamless Navigation**: Smooth transition from upload to now playing

## 📍 Access Points

- **Frontend**: http://localhost:5173 (or the port shown in terminal)
- **Backend API**: http://localhost:8000
- **Upload Page**: http://localhost:5173/upload

## 🛠️ Troubleshooting

### Backend Issues
- Make sure you're in the `backend` directory
- Activate the virtual environment if you have one
- Install dependencies: `pip install -r requirements.txt`

### Frontend Issues
- Make sure you're in the `frontend/project` directory
- Clear node_modules if needed: `rm -rf node_modules && npm install`
- Check if port 5173 is available

## 🎯 Testing the Upload Feature

1. Navigate to http://localhost:5173/upload
2. Drag and drop an audio file or click to select
3. Watch as metadata is automatically extracted
4. Fill in any additional details
5. Click "Publish" to upload
6. The track will automatically start playing after upload

## 📝 Notes

- The backend uses FastAPI with automatic metadata extraction
- The frontend uses React with Vite for fast development
- Upload progress is tracked in real-time
- Cover art is automatically extracted from audio files
- All uploaded tracks are stored locally in the `uploads` directory

---

**Happy streaming! 🎶**
