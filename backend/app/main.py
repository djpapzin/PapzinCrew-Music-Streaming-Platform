from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from .db.database import engine
from .models import models
from .routers import tracks, categories, artists, uploads

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PapzinCrew Music Streaming API",
             description="API for PapzinCrew Music Streaming Platform",
             version="0.1.0")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; in production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(tracks.router)
app.include_router(categories.router)
app.include_router(artists.router)
app.include_router(uploads.router)

# Mount the 'uploads' directory to serve static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Papzin & Crew Music Streaming API"}

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}