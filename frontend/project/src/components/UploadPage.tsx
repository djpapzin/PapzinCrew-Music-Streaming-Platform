import React, { useState } from 'react';
import { Upload, Image, Music, Tag, Globe, Download, Eye, Users, ChevronDown, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Song } from '../types/music';

interface UploadPageProps {
  onPlaySong?: (song: Song, queue?: Song[]) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onPlaySong }) => {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [extractingMetadata, setExtractingMetadata] = useState(false);
  const [coverArt, setCoverArt] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tracklist: '',
    tagArtists: '',
    tags: '',
    genre: 'Podcast Shows',
    availability: 'Public',
    allowDownloads: 'Yes',
    displayEmbedCode: 'Yes',
    ageRestriction: 'All ages can listen to this stream'
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      extractMetadata(file);
    }
  };

  const extractMetadata = async (file: File) => {
    setExtractingMetadata(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:8000/upload/extract-metadata', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const metadata = await response.json();
        
        // Update form fields with extracted metadata
        setFormData(prev => ({
          ...prev,
          title: metadata.title || prev.title,
          tagArtists: metadata.artist || prev.tagArtists,
          genre: metadata.genre || prev.genre,
          description: metadata.album ? `Album: ${metadata.album}${metadata.year ? ` (${metadata.year})` : ''}` : prev.description
        }));
        
        // Set cover art if available
        if (metadata.cover_art) {
          setCoverArt(metadata.cover_art);
        }
      } else {
        console.error('Failed to extract metadata:', response.statusText);
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
    } finally {
      setExtractingMetadata(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      extractMetadata(file);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePublish = async () => {
    if (!uploadedFile) {
      alert('Please select an audio file first.');
      return;
    }

    if (!formData.title.trim()) {
      alert('Please enter a title for your track.');
      return;
    }

    if (!formData.tagArtists.trim()) {
      alert('Please enter the artist name.');
      return;
    }

    setIsPublishing(true);
    setPublishStatus('idle');
    setUploadProgress(0);

    try {
      const uploadFormData = new FormData();
      
      // Add the audio file
      uploadFormData.append('file', uploadedFile);
      
      // Add all form fields
      uploadFormData.append('title', formData.title);
      uploadFormData.append('artist_name', formData.tagArtists);
      uploadFormData.append('description', formData.description);
      uploadFormData.append('tracklist', formData.tracklist);
      uploadFormData.append('tags', formData.tags);
      uploadFormData.append('genre', formData.genre);
      uploadFormData.append('availability', formData.availability.toLowerCase());
      uploadFormData.append('allow_downloads', formData.allowDownloads.toLowerCase());
      uploadFormData.append('display_embed', formData.displayEmbedCode.toLowerCase());
      uploadFormData.append('age_restriction', formData.ageRestriction.toLowerCase());

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });
      
      // Create promise to handle XMLHttpRequest
      const uploadPromise = new Promise<Response>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Create a Response object from XMLHttpRequest
            const response = new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers({
                'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json'
              })
            });
            resolve(response);
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));
        
        xhr.open('POST', 'http://localhost:8000/upload');
        xhr.send(uploadFormData);
      });
      
      const response = await uploadPromise;

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        setPublishStatus('success');
        
        // Convert uploaded mix to Song format for player
        const uploadedSong: Song = {
          id: result.id.toString(),
          title: result.title,
          artist: result.artist.name,
          album: result.album || 'Single',
          duration: result.duration_seconds,
          imageUrl: result.cover_art_url ? `http://localhost:8000${result.cover_art_url}` : '/default-cover.jpg',
          audioUrl: `http://localhost:8000/${result.file_path}`,
          genre: result.genre || 'Unknown',
          year: result.year || new Date().getFullYear()
        };
        
        // Navigate to home page and start playing the uploaded song
        setTimeout(() => {
          if (onPlaySong) {
            onPlaySong(uploadedSong, [uploadedSong]);
          }
          navigate('/');
          
          // Reset form after navigation
          setTimeout(() => {
            setUploadedFile(null);
            setCoverArt(null);
            setUploadProgress(0);
            setFormData({
              title: '',
              description: '',
              tracklist: '',
              tagArtists: '',
              tags: '',
              genre: 'Podcast Shows',
              availability: 'Public',
              allowDownloads: 'Yes',
              displayEmbedCode: 'Yes',
              ageRestriction: 'All ages can listen to this stream'
            });
            setPublishStatus('idle');
          }, 500);
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('Upload failed:', errorData);
        setPublishStatus('error');
        alert(`Upload failed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setPublishStatus('error');
      alert('Upload failed. Please check your connection and try again.');
    } finally {
      setIsPublishing(false);
      if (publishStatus !== 'success') {
        setUploadProgress(0);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">Upload single stream</h1>
      </div>

      {/* File Upload Section */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
            dragActive 
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-gray-600 hover:border-gray-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-gray-600 rounded-lg flex items-center justify-center">
              {extractingMetadata ? (
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              ) : (
                <Music className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-white font-medium text-lg">
                {uploadedFile ? uploadedFile.name : 'Select 100MB file(s) or less to upload'}
              </p>
              <p className="text-gray-400 mt-2">
                {extractingMetadata ? 'Extracting metadata...' : 'or drag & drop file(s) here'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Upload Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Track Image Upload */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="flex items-start space-x-4">
              <div className="w-24 h-24 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center overflow-hidden">
                {coverArt ? (
                  <img 
                    src={coverArt} 
                    alt="Track cover art" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Image className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">
                  {coverArt ? 'Extracted track image' : 'Upload track image'}
                </h3>
                <p className="text-gray-400 text-sm">
                  {coverArt 
                    ? 'Cover art extracted from audio file metadata' 
                    : 'Image resolution should be greater than 150 X 150px'
                  }
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {coverArt ? '(Auto-extracted)' : '(Recommended)'}
                </p>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-white font-medium">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="Enter track title"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-gray-400 text-sm">Your title • 55 characters</p>
          </div>

          {/* About This Stream */}
          <div className="space-y-2">
            <label className="text-white font-medium">About This Stream</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your stream..."
              rows={4}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Tracklist */}
          <div className="space-y-2">
            <label className="text-white font-medium">Tracklist</label>
            <textarea
              value={formData.tracklist}
              onChange={(e) => handleInputChange('tracklist', e.target.value)}
              placeholder="Enter your tracklist..."
              rows={4}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Tag Artists */}
          <div className="space-y-2">
            <label className="text-white font-medium">Tag Artists</label>
            <input
              type="text"
              value={formData.tagArtists}
              onChange={(e) => handleInputChange('tagArtists', e.target.value)}
              placeholder="Tag other artists to show they performed together"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-gray-400 text-sm">Tag other artists to show they performed together</p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-white font-medium">Tags</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => handleInputChange('tags', e.target.value)}
              placeholder="Add tags to describe more about your stream"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-gray-400 text-sm">Add tags to describe more about your stream</p>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Genre */}
            <div className="space-y-2">
              <label className="text-white font-medium">Genre</label>
              <div className="relative">
                <select
                  value={formData.genre}
                  onChange={(e) => handleInputChange('genre', e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
                >
                  <option value="Podcast Shows">Podcast Shows</option>
                  <option value="Hip Hop">Hip Hop</option>
                  <option value="House">House</option>
                  <option value="Amapiano">Amapiano</option>
                  <option value="Afro">Afro</option>
                  <option value="Gqom">Gqom</option>
                  <option value="Electronic">Electronic</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Availability */}
            <div className="space-y-2">
              <label className="text-white font-medium">Availability</label>
              <div className="relative">
                <select
                  value={formData.availability}
                  onChange={(e) => handleInputChange('availability', e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private</option>
                  <option value="Unlisted">Unlisted</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Allow Downloads */}
            <div className="space-y-2">
              <label className="text-white font-medium">Allow downloads</label>
              <div className="relative">
                <select
                  value={formData.allowDownloads}
                  onChange={(e) => handleInputChange('allowDownloads', e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Display Embed Code */}
            <div className="space-y-2">
              <label className="text-white font-medium">Display embed code</label>
              <div className="relative">
                <select
                  value={formData.displayEmbedCode}
                  onChange={(e) => handleInputChange('displayEmbedCode', e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Age Restriction */}
          <div className="space-y-2">
            <label className="text-white font-medium">Age Restriction</label>
            <div className="relative">
              <select
                value={formData.ageRestriction}
                onChange={(e) => handleInputChange('ageRestriction', e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="All ages can listen to this stream">All ages can listen to this stream</option>
                <option value="18+ only">18+ only</option>
                <option value="21+ only">21+ only</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isPublishing && (
            <div className="pt-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm font-medium">Uploading your track...</span>
                  <span className="text-purple-400 text-sm font-bold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-gray-400 text-xs">
                  {uploadProgress < 100 ? 'Please don\'t close this page while uploading...' : 'Processing your track...'}
                </div>
              </div>
            </div>
          )}

          {/* Publish Button */}
          <div className="pt-4">
            <button
              onClick={handlePublish}
              disabled={isPublishing || !uploadedFile}
              className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center space-x-2 ${
                isPublishing || !uploadedFile
                  ? 'bg-gray-600 cursor-not-allowed'
                  : publishStatus === 'success'
                  ? 'bg-green-500 hover:bg-green-600'
                  : publishStatus === 'error'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 hover:shadow-lg transform hover:scale-105'
              } text-white`}
            >
              {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {isPublishing
                  ? `Uploading... ${uploadProgress}%`
                  : publishStatus === 'success'
                  ? 'Published Successfully!'
                  : publishStatus === 'error'
                  ? 'Upload Failed - Retry'
                  : 'Publish'
                }
              </span>
            </button>
          </div>
        </div>

        {/* Right Column - Tips */}
        <div className="space-y-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h3 className="text-white font-semibold mb-4">Get tips for your stream</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <Music className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">High Quality Audio</p>
                  <p className="text-gray-400 text-xs">Upload in the best quality possible</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <Tag className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Use Relevant Tags</p>
                  <p className="text-gray-400 text-xs">Help listeners discover your music</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <Image className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Eye-catching Artwork</p>
                  <p className="text-gray-400 text-xs">Use high-resolution cover art</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Engage Your Audience</p>
                  <p className="text-gray-400 text-xs">Write compelling descriptions</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/20">
            <h4 className="text-white font-semibold mb-2">Pro Tip</h4>
            <p className="text-gray-300 text-sm">
              Upload during peak hours (6-9 PM) for maximum visibility and engagement with your audience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;