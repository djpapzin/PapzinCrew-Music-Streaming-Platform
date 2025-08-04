'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseBuffer } from 'music-metadata';
import axios from 'axios';
import { UploadIcon } from '@/components/icons/UploadIcon';
import { CoverArtUploader } from '@/components/CoverArtUploader';
import { TrackForm } from '@/components/TrackForm';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';

interface TrackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string[];
  picture?: string;
}

const UploadClientWrapper = dynamic(() => import('../upload-client-wrapper'), { ssr: false });

function HomeContent() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<TrackMetadata>({});
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'success' | 'error' | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');

  const resetUploadState = () => {
    setAudioFile(null);
    setCoverArtFile(null);
    setMetadata({});
    setCoverArtUrl(null);
    setIsProcessing(false);
    setUploadProgress(0);
    setIsUploading(false);
    setUploadStatus(null);
    setUploadMessage('');
  };

  const extractMetadata = async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsedMetadata = await parseBuffer(new Uint8Array(buffer));
      
      // Log all available common metadata fields for debugging
      console.log('Extracted metadata:', parsedMetadata.common);
      
      let title = parsedMetadata.common.title || '';
      let artist = parsedMetadata.common.artist || parsedMetadata.common.albumartist || '';
      let usedFilename = false;

      // If title or artist is missing, try to extract from filename
      if (!title || !artist) {
        // Remove extension
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        // Try to split by ' - '
        const parts = nameWithoutExt.split(' - ');
        if (parts.length === 2) {
          // Heuristic: usually 'Artist - Title', but sometimes reversed
          // We'll default to 'Artist - Title', but warn user to verify
          artist = artist || parts[0];
          title = title || parts[1];
          usedFilename = true;
        } else {
          // Fallback: use whole filename as title
          title = title || nameWithoutExt;
          artist = artist || 'Unknown Artist';
          usedFilename = true;
        }
      }

      const extractedData: TrackMetadata = {
        title,
        artist,
        album: parsedMetadata.common.album,
        year: parsedMetadata.common.year,
        genre: parsedMetadata.common.genre,
      };

      // Extract cover art if available
      if (parsedMetadata.common.picture && parsedMetadata.common.picture.length > 0) {
        const picture = parsedMetadata.common.picture[0];
        const blob = new Blob([picture.data], { type: picture.format });
        const imageUrl = URL.createObjectURL(blob);
        setCoverArtUrl(imageUrl);
        extractedData.picture = imageUrl;
      }

      setMetadata(extractedData);

      // Alert user if filename was used for extraction
      if (usedFilename) {
        let msg =
          'Could not extract full metadata from the file.\n' +
          'We used the filename to guess the artist and title. Please verify the information below.';
        if (file.name.includes(' - ')) {
          msg +=
            '\nNote: Sometimes the filename format is "Title - Artist" instead of "Artist - Title". Please double-check!';
        }
        alert(msg);
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
      // Fallback to filename if metadata extraction fails
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      let title = nameWithoutExt;
      let artist = 'Unknown Artist';
      let usedFilename = false;
      // Try to split by ' - '
      const parts = nameWithoutExt.split(' - ');
      if (parts.length === 2) {
        artist = parts[0];
        title = parts[1];
        usedFilename = true;
      }
      setMetadata({
        title,
        artist,
      });
      if (usedFilename) {
        let msg =
          'Could not extract metadata from the file.\n' +
          'We used the filename to guess the artist and title. Please verify the information below.';
        if (file.name.includes(' - ')) {
          msg +=
            '\nNote: Sometimes the filename format is "Title - Artist" instead of "Artist - Title". Please double-check!';
        }
        alert(msg);
      } else {
        alert('Could not extract metadata from the file. Please enter the correct artist and title.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setAudioFile(file);
      await extractMetadata(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/flac': ['.flac'],
      'audio/aac': ['.aac'],
      'audio/ogg': ['.ogg'],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const handleCoverArtChange = (file: File | null) => {
    if (file) {
      setCoverArtFile(file);
      const imageUrl = URL.createObjectURL(file);
      setCoverArtUrl(imageUrl);
    } else {
      setCoverArtFile(null);
      setCoverArtUrl(metadata.picture || null);
    }
  };

  const handlePublish = async (formData: any) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);
    setUploadMessage('');

    const publishData = new FormData();

    // Map frontend fields to backend fields
    publishData.append('title', formData.title || '');
    publishData.append('artist_name', formData.artist || '');
    publishData.append('album', formData.album || '');
    publishData.append('year', formData.year || '');
    publishData.append('description', formData.about || '');
    publishData.append('tracklist', formData.tracklist || '');
    publishData.append('tags', formData.tags || '');
    publishData.append('genre', formData.genre || '');
    publishData.append('availability', formData.availability || 'public');
    publishData.append('allow_downloads', 'yes'); // default for now
    publishData.append('display_embed', 'yes'); // default for now
    publishData.append('age_restriction', 'all'); // default for now

    // Add files
    if (audioFile) {
      publishData.append('file', audioFile);
    }
    if (coverArtFile) {
      publishData.append('cover_art', coverArtFile);
    }

    try {
      const response = await axios.post('http://localhost:8000/upload', publishData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total ?? 1)
          );
          setUploadProgress(percentCompleted);
        },
      });

      if (response.status === 201) {
        setUploadStatus('success');
        setUploadMessage('Track uploaded successfully! You can upload another file.');
        setTimeout(() => {
          resetUploadState();
        }, 3000);
      } else {
        setUploadStatus('error');
        setUploadMessage(`Upload failed: ${response.data.detail || 'Unknown error'}`);
      }
    } catch (err: any) {
      setUploadStatus('error');
      setUploadMessage(`Upload failed: ${err.response?.data?.detail || err.message || 'An unexpected error occurred.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!audioFile) {
    // Step 1: Initial dropzone view
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer",
              "hover:border-primary hover:bg-muted/50 transition-all duration-300",
              "bg-muted/30",
              isDragActive && "border-primary bg-primary/10 scale-105"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center space-y-6">
              <UploadIcon className="w-16 h-16 text-muted-foreground" />
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Upload single stream
                </h1>
                <p className="text-muted-foreground">
                  Select 100MB file(s) or less to upload<br />
                  or drag & drop file(s) here
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Form view after file selection
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Upload Track</h1>
          <p className="text-muted-foreground">
            File: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        </div>

        {isProcessing && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Extracting metadata...</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Cover Art */}
          <div>
            <CoverArtUploader
              coverArt={coverArtUrl}
              onCoverArtChange={handleCoverArtChange}
            />
          </div>

          {/* Right Column: Form */}
          <TrackForm
            initialData={{
              title: metadata.title || '',
              artist: metadata.artist || '',
            }}
            onSubmit={handlePublish}
            isUploading={isUploading}
          />
        </div>

        {isUploading && (
          <div className="fixed inset-0 bg-background/80 flex flex-col items-center justify-center z-50">
            <div className="w-1/2 p-8 bg-muted rounded-lg shadow-lg">
              <h3 className="text-lg font-medium mb-4">Uploading...</h3>
              <Progress value={uploadProgress} />
              <p className="text-center mt-2">{uploadProgress}%</p>
            </div>
          </div>
        )}

        {uploadStatus && (
          <div className="fixed top-5 right-5 z-50">
            <Alert variant={uploadStatus === 'success' ? 'default' : 'destructive'} className="max-w-md">
              <AlertTitle>{uploadStatus === 'success' ? 'Success!' : 'Error!'}</AlertTitle>
              <AlertDescription>{uploadMessage}</AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <UploadClientWrapper>
      <HomeContent />
    </UploadClientWrapper>
  );
} 