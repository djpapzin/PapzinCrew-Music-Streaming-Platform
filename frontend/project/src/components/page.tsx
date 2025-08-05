'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseBuffer } from 'music-metadata-browser';
import { UploadIcon } from '@/components/icons/UploadIcon';
import { CoverArtUploader } from '@/components/CoverArtUploader';
import { TrackForm } from '@/components/TrackForm';
import { NowPlayingPopup } from '@/components/NowPlayingPopup';
import { cn } from '@/lib/utils';

interface TrackMetadata {
  title?: string;
  artist?: string;
  picture?: string;
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverArtFile, setCoverArtFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<TrackMetadata>({});
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nowPlayingTrack, setNowPlayingTrack] = useState<any>(null);
  const [showNowPlaying, setShowNowPlaying] = useState(false);

  const extractMetadata = async (file: File) => {
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsedMetadata = await parseBuffer(new Uint8Array(buffer));
      
      const extractedData: TrackMetadata = {
        title: parsedMetadata.common.title || file.name.replace(/\.[^/.]+$/, ''),
        artist: parsedMetadata.common.artist || parsedMetadata.common.albumartist || 'Unknown Artist',
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
    } catch (error) {
      console.error('Error extracting metadata:', error);
      // Fallback to filename if metadata extraction fails
      setMetadata({
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
      });
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

  const handlePublish = (formData: any) => {
    const publishData = new FormData();
    
    // Add form data
    Object.keys(formData).forEach(key => {
      publishData.append(key, formData[key]);
    });
    
    // Add files
    if (audioFile) {
      publishData.append('audioFile', audioFile);
    }
    
    if (coverArtFile) {
      publishData.append('coverArt', coverArtFile);
    }
    
    // Log the FormData contents (for development)
    console.log('Publishing track with data:');
    console.log('Form Data:', formData);
    console.log('Audio File:', audioFile);
    console.log('Cover Art File:', coverArtFile);
    console.log('FormData object:', publishData);
    
    // Here you would typically send the FormData to your API
    // Example: await fetch('/api/upload', { method: 'POST', body: publishData });
    
    // Demo: Show now playing popup after publish
    const demoTrack = {
      id: '1',
      title: formData.title,
      artist: formData.artist,
      coverArt: coverArtUrl,
      audioUrl: audioFile ? URL.createObjectURL(audioFile) : undefined,
    };
    
    setNowPlayingTrack(demoTrack);
    setShowNowPlaying(true);
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
          <div>
            <TrackForm
              initialData={metadata}
              onPublish={handlePublish}
            />
          </div>
        </div>
      </div>
      
      {/* Now Playing Popup */}
      <NowPlayingPopup
        track={nowPlayingTrack}
        isVisible={showNowPlaying}
        onClose={() => setShowNowPlaying(false)}
      />
    </div>
  );
}