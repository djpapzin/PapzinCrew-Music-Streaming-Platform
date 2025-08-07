'use client';

import React from 'react';
import { useDropzone } from 'react-dropzone';
import { ImageIcon } from './icons/ImageIcon';
import { cn } from '@/lib/utils';

interface CoverArtUploaderProps {
  coverArt: string | null;
  onCoverArtChange: (file: File | null) => void;
}

export const CoverArtUploader: React.FC<CoverArtUploaderProps> = ({
  coverArt,
  onCoverArtChange,
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onCoverArtChange(acceptedFiles[0]);
      }
    },
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Cover Art</h3>
      <div
        {...getRootProps()}
        className={cn(
          "relative aspect-square w-full max-w-sm mx-auto cursor-pointer",
          "border-2 border-dashed border-border rounded-lg",
          "hover:border-primary transition-colors duration-200",
          "bg-muted/50 hover:bg-muted/70",
          isDragActive && "border-primary bg-primary/10"
        )}
      >
        <input {...getInputProps()} />
        
        {coverArt ? (
          <div className="relative w-full h-full rounded-lg overflow-hidden group">
            <img
              src={coverArt}
              alt="Cover art preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Click to replace</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Drop image, or click to select
            </p>
          </div>
        )}
      </div>
    </div>
  );
};