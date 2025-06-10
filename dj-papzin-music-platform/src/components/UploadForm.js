import React, { useState } from 'react';
import axios from 'axios';

function UploadForm({ onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    // Basic validation for audio files
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      setError('');
    } else {
      setFile(null);
      setError('Please select an audio file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title || !description || !file) {
      setError('All fields are required');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file);

    try {
      console.log('Attempting to upload file...');
      await axios.post('/api/mixes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setSuccess('Track uploaded successfully!');
      setTitle('');
      setDescription('');
      setFile(null);
      
      // Trigger parent component to refresh song list
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900 text-white p-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-900 text-white p-3 rounded">
          {success}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
          placeholder="Track title"
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
          placeholder="Track description"
          rows="3"
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Audio File
        </label>
        <input
          type="file"
          onChange={handleFileChange}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
          accept="audio/*"
          disabled={uploading}
        />
        <p className="text-xs text-gray-400 mt-1">
          Supported formats: MP3, WAV, OGG, etc.
        </p>
      </div>

      <button
        type="submit"
        disabled={uploading}
        className={`w-full py-2 px-4 rounded font-medium ${
          uploading
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
        }`}
      >
        {uploading ? 'Uploading...' : 'Upload Track'}
      </button>
    </form>
  );
}

export default UploadForm;
