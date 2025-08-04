import React, { useState } from 'react';
import { Upload, Image, Music, Tag, Globe, Download, Eye, Users, ChevronDown } from 'lucide-react';

const UploadPage: React.FC = () => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
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
      setUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePublish = () => {
    console.log('Publishing:', { file: uploadedFile, ...formData });
    // Handle publish logic here
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
              <Music className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <p className="text-white font-medium text-lg">
                {uploadedFile ? uploadedFile.name : 'Select 100MB file(s) or less to upload'}
              </p>
              <p className="text-gray-400 mt-2">or drag & drop file(s) here</p>
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
              <div className="w-24 h-24 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
                <Image className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-2">Upload track image</h3>
                <p className="text-gray-400 text-sm">
                  Image resolution should be greater than 150 X 150px
                </p>
                <p className="text-gray-500 text-xs mt-1">(Recommended)</p>
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

          {/* Publish Button */}
          <div className="pt-4">
            <button
              onClick={handlePublish}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg transform hover:scale-105"
            >
              Publish
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