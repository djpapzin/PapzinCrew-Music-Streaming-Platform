'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TrackData {
  title: string;
  artist: string;
  album: string;
  year: string;
  about: string;
  genre: string;
  tags: string;
  tagArtists: string;
  availability: string;
  explicit: string;
  tracklist: string;
}

interface TrackFormProps {
  initialData: Partial<TrackData>;
  onSubmit: (data: TrackData) => void;
  isUploading: boolean;
}

export const TrackForm: React.FC<TrackFormProps> = ({ initialData, onSubmit, isUploading }) => {
  const [formData, setFormData] = useState<TrackData>({
    title: initialData.title || '',
    artist: initialData.artist || '',
    album: initialData.album || '',
    year: initialData.year ? String(initialData.year) : '',
    about: '',
    genre: initialData.genre?.[0] || '',
    tags: '',
    tagArtists: '',
    availability: 'public',
    explicit: 'no',
    tracklist: '',
  });

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      title: initialData.title || '',
      artist: initialData.artist || '',
      album: initialData.album || '',
      year: initialData.year ? String(initialData.year) : '',
      genre: initialData.genre?.[0] || prev.genre || '',
    }));
  }, [initialData.title, initialData.artist, initialData.album, initialData.year, initialData.genre]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleInputChange = (field: keyof TrackData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">Track Details</h3>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter track title"
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artist" className="text-sm font-medium">
              Artist *
            </Label>
            <Input
              id="artist"
              value={formData.artist}
              onChange={(e) => handleInputChange('artist', e.target.value)}
              placeholder="Enter artist name"
              required
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="album" className="text-sm font-medium">
              Album
            </Label>
            <Input
              id="album"
              value={formData.album}
              onChange={(e) => handleInputChange('album', e.target.value)}
              placeholder="Enter album name"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="year" className="text-sm font-medium">
              Year
            </Label>
            <Input
              id="year"
              type="number"
              value={formData.year}
              onChange={(e) => handleInputChange('year', e.target.value)}
              placeholder="Enter release year"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="about" className="text-sm font-medium">
              About This Stream
            </Label>
            <Textarea
              id="about"
              value={formData.about}
              onChange={(e) => handleInputChange('about', e.target.value)}
              placeholder="Describe your track..."
              rows={4}
              className="w-full resize-none"
            />
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-primary hover:text-primary/80 p-0 h-auto font-medium"
        >
          {showAdvanced ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Advanced Options
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show Advanced Options
            </>
          )}
        </Button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t border-border">
            {/* Tracklist field - first in advanced */}
            <div className="space-y-2">
              <Label htmlFor="tracklist" className="text-sm font-medium">
                Tracklist
              </Label>
              <Textarea
                id="tracklist"
                value={formData.tracklist}
                onChange={(e) => handleInputChange('tracklist', e.target.value)}
                placeholder="List the tracks in this mix (one per line)"
                rows={3}
                className="w-full resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="genre" className="text-sm font-medium">
                  Genre
                </Label>
                <Select
                  value={formData.genre}
                  onValueChange={(value) => handleInputChange('genre', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pop">Pop</SelectItem>
                    <SelectItem value="rock">Rock</SelectItem>
                    <SelectItem value="hip-hop">Hip-Hop</SelectItem>
                    <SelectItem value="electronic">Electronic</SelectItem>
                    <SelectItem value="jazz">Jazz</SelectItem>
                    <SelectItem value="classical">Classical</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="r&b">R&B</SelectItem>
                    <SelectItem value="indie">Indie</SelectItem>
                    <SelectItem value="alternative">Alternative</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="availability" className="text-sm font-medium">
                  Availability
                </Label>
                <Select 
                  defaultValue="public"
                  onValueChange={(value) => handleInputChange('availability', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags" className="text-sm font-medium">
                Tags
              </Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => handleInputChange('tags', e.target.value)}
                placeholder="Enter tags separated by commas"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagArtists" className="text-sm font-medium">
                Tag Artists
              </Label>
              <Input
                id="tagArtists"
                value={formData.tagArtists}
                onChange={(e) => handleInputChange('tagArtists', e.target.value)}
                placeholder="Enter featured or collaborating artists separated by commas"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="explicit" className="text-sm font-medium">
                  Explicit Content
                </Label>
                <Select 
                  defaultValue="no"
                  onValueChange={(value) => handleInputChange('explicit', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Publish Button */}
        <div className="pt-6">
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 text-base"
            size="lg"
            disabled={isUploading}
          >
            {isUploading ? 'Publishing...' : 'Publish Track'}
          </Button>
        </div>
      </form>
    </div>
  );
};