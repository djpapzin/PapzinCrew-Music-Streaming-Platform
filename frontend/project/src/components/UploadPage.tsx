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
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [uploadStatus, setUploadStatus] = useState<{
    stage: 'idle' | 'uploading' | 'processing' | 'generating_art' | 'success' | 'error';
    progress: number;
    message: string;
  }>({
    stage: 'idle',
    progress: 0,
    message: ''
  });
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
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

    // If custom prompt is shown but empty, show an error
    if (showCustomPrompt && !customPrompt.trim()) {
      alert('Please enter a custom prompt or click "Generate Automatically"');
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
    setUploadStatus({
      stage: 'uploading',
      progress: 0,
      message: 'Preparing to upload your track...'
    });

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
      
      // Add custom prompt if provided
      if (showCustomPrompt && customPrompt.trim()) {
        uploadFormData.append('custom_prompt', customPrompt.trim());
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadStatus(prev => ({
            ...prev,
            progress: percentComplete,
            message: `Uploading your track... ${percentComplete}%`
          }));
        }
      });
      
      // Set up load start handler
      xhr.upload.addEventListener('loadstart', () => {
        setUploadStatus({
          stage: 'uploading',
          progress: 0,
          message: 'Starting upload...'
        });
      });
      
      // Create promise to handle XMLHttpRequest
      const uploadPromise = new Promise<Response>((resolve, reject) => {
        xhr.onload = () => {
          // Update status to processing before handling the response
          setUploadStatus({
            stage: 'processing',
            progress: 100,
            message: 'Processing your track...'
          });
          
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
            console.error('Upload failed with status:', xhr.status, xhr.statusText);
            console.error('Response text:', xhr.responseText);
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        };
        
        xhr.onerror = (error) => {
          console.error('Network error during upload:', error);
          reject(new Error('Network error'));
        };
        
        xhr.ontimeout = () => {
          console.error('Upload timed out');
          reject(new Error('Upload timeout'));
        };
        
        xhr.open('POST', 'http://localhost:8000/upload', true);
        // Set withCredentials to include cookies if needed
        xhr.withCredentials = false;
        
        // Set headers
        xhr.setRequestHeader('Accept', 'application/json');
        
        // For CORS preflight, the browser will handle the headers
        // We don't need to manually set Content-Type for FormData, the browser will set it with the correct boundary
        
        xhr.send(uploadFormData);
      });
      
      const response = await uploadPromise;

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        
        // Update status to generating art if needed
        if (result.generating_art) {
          setUploadStatus({
            stage: 'generating_art',
            progress: 100,
            message: 'Generating cover art...'
          });
        } else {
          setUploadStatus({
            stage: 'success',
            progress: 100,
            message: 'Upload complete!'
          });
          setPublishStatus('success');
        }
        
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
            setShowCustomPrompt(false);
            setCustomPrompt('');
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
            setUploadStatus({
              stage: 'idle',
              progress: 0,
              message: ''
            });
          }, 500);
        }, 1500);
      } else {
        const errorData = await response.json();
        console.error('Upload failed:', errorData);
        setUploadStatus({
          stage: 'error',
          progress: 0,
          message: `Upload failed: ${errorData.detail || 'Unknown error'}`
        });
        setPublishStatus('error');
        alert(`Upload failed: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        stage: 'error',
        progress: 0,
        message: 'Upload failed. Please check your connection and try again.'
      });
      setPublishStatus('error');
      alert('Upload failed. Please check your connection and try again.');
    } finally {
      setIsPublishing(false);
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
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
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
                  {coverArt ? 'Track image' : 'Upload track image'}
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

            {!coverArt && !showCustomPrompt && (
              <div className="pt-2">
                <button
                  onClick={() => setShowCustomPrompt(true)}
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center"
                >
                  <span>Customize AI-generated cover art</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}

            {showCustomPrompt && (
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-white font-medium text-sm">Customize AI Cover Art</h4>
                  <button 
                    onClick={() => setShowCustomPrompt(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe the cover art you'd like to generate (e.g., 'futuristic city at night with neon lights')"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-20"
                />
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Leave blank to generate automatically</span>
                  <button
                    onClick={() => setShowCustomPrompt(false)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Generate Automatically
                  </button>
                </div>
              </div>
            )}
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

          {(uploadStatus.stage === 'uploading' || uploadStatus.stage === 'processing' || uploadStatus.stage === 'generating_art' || uploadStatus.stage === 'success' || uploadStatus.stage === 'error') && (
            <div className="pt-4">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm font-medium">
                    {uploadStatus.stage === 'uploading' && 'Uploading your track...'}
                    {uploadStatus.stage === 'processing' && 'Processing your track...'}
                    {uploadStatus.stage === 'generating_art' && 'Generating cover art...'}
                    {uploadStatus.stage === 'success' && 'Upload complete!'}
                    {uploadStatus.stage === 'error' && 'Upload failed'}
                  </span>
                  <span className="text-purple-400 text-sm font-bold">
                    {uploadStatus.progress}%{uploadStatus.stage === 'success' && ' '}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ease-out ${
                      uploadStatus.stage === 'error' 
                        ? 'bg-red-500' 
                        : uploadStatus.stage === 'success'
                        ? 'bg-green-500'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500'
                    }`}
                    style={{ width: `${uploadStatus.progress}%` }}
                  ></div>
                </div>
                <div className="text-gray-400 text-xs">
                  {uploadStatus.stage === 'uploading' && (
                    <span>Please don't close this page while uploading...</span>
                  )}
                  {uploadStatus.stage === 'processing' && (
                    <span>Processing your track. This may take a moment...</span>
                  )}
                  {uploadStatus.stage === 'generating_art' && (
                    <span>Creating beautiful cover art for your track...</span>
                  )}
                  {uploadStatus.stage === 'success' && (
                    <span className="text-green-400">Your track has been successfully uploaded and is now processing.</span>
                  )}
                  {uploadStatus.stage === 'error' && (
                    <span className="text-red-400">{uploadStatus.message || 'An error occurred during upload.'}</span>
                  )}
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
              {isPublishing && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="ml-2">
                    {uploadStatus.stage === 'uploading' && `Uploading...`}
                    {uploadStatus.stage === 'processing' && 'Processing...'}
                    {uploadStatus.stage === 'generating_art' && 'Generating Art...'}
                  </span>
                </>
              )}
              {!isPublishing && (
                <span>
                  {uploadStatus.stage === 'success' 
                    ? 'Published Successfully! ' 
                    : uploadStatus.stage === 'error'
                    ? 'Try Again'
                    : 'Publish'}
                </span>
              )}
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