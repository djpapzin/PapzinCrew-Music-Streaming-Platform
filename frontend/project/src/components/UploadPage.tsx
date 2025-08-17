import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Image, Music, Tag, Globe, Download, Eye, Users, ChevronDown, Loader2, AlertCircle, CheckCircle, XCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Song } from '../types/music';

// Base API URL (Render/production uses VITE_API_URL; fallback to local dev)
const API_BASE = import.meta.env.VITE_API_URL || (window.location.origin.includes('netlify') ? 'https://papzincrew-backend.onrender.com' : 'http://localhost:8000');

// Ensure API_BASE doesn't end with a slash
const API_URL = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

// Add fade-in animation
const fadeInKeyframes = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
`;

// Create a style element for our animations
const styleElement = document.createElement('style');
styleElement.textContent = fadeInKeyframes;
document.head.appendChild(styleElement);

interface UploadError {
  error: string;
  error_code: string;
  [key: string]: any;
}

interface FileValidationResult {
  valid: boolean;
  mime_type?: string;
  file_extension?: string;
  file_size_bytes?: number;
  error?: string;
  error_code?: string;
  detected_type?: string;
}

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
  const [fileValidation, setFileValidation] = useState<FileValidationResult | null>(null);
  // Upload status model powers the segmented stepper in the status modal.
  // phase drives the highlighted step and mini bar:
  // - 'file_upload' (0–40%), 'metadata_extraction' (40–70%), 'ai_generation' (70–100%), 'complete'
  const [duplicateTrack, setDuplicateTrack] = useState<any>(null);
  const [uploadError, setUploadError] = useState<UploadError | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    stage: 'idle' | 'uploading' | 'processing' | 'generating_art' | 'success' | 'error';
    progress: number;
    message: string;
    details?: string;
    speed?: string;
    timeRemaining?: string;
    phase: 'file_upload' | 'metadata_extraction' | 'ai_generation' | 'complete' | 'none';
    phaseProgress: number;
    canCancel: boolean;
    extractedMetadata?: any;
  }>({
    stage: 'idle',
    progress: 0,
    message: '',
    details: '',
    speed: '',
    timeRemaining: '',
    phase: 'none',
    phaseProgress: 0,
    canCancel: false,
    extractedMetadata: null
  });
  
  // Track upload speed and time remaining
  const uploadStartTime = React.useRef<number | null>(null);
  const lastLoaded = React.useRef<number>(0);
  const lastTime = React.useRef<number>(0);
  const [publishStatus, setPublishStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const statusModalRef = useRef<HTMLDivElement>(null);
  const currentXhrRef = useRef<XMLHttpRequest | null>(null);
  const artGenerationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshLibrary = useCallback(() => {
    try {
      window.dispatchEvent(new Event('library:refresh'));
    } catch (e) {
      console.debug('Failed to dispatch library:refresh', e);
    }
  }, []);
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

  const validateAndSetFile = useCallback(async (file: File) => {
    // Reset states
    setFileValidation(null);
    setDuplicateTrack(null);
    setUploadError(null);
    
    // Basic client-side validation
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setFileValidation({
        valid: false,
        error: `File is too large. Maximum size is 100MB.`,
        error_code: 'file_too_large'
      });
      return false;
    }
    
    // Set file for metadata extraction
    setUploadedFile(file);
    
    // Extract metadata which will also validate the file
    await extractMetadata(file);
    return true;
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const extractMetadata = async (file: File) => {
    setExtractingMetadata(true);
    setFileValidation(null);
    
    try {
      // Create a new File object to ensure we have a fresh copy
      const fileCopy = new File([file], file.name, { type: file.type });
      
      const formData = new FormData();
      formData.append('file', fileCopy);
      
      const response = await fetch(`${API_URL}/upload/extract-metadata`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const metadata = await response.json();
        console.log('Metadata extraction response:', metadata);
        
        // Extract the actual metadata from the response structure
        const extractedMetadata = metadata.metadata || metadata;
        console.log('Extracted metadata object:', extractedMetadata);
        
        // Update form fields with extracted metadata
        const updatedFormData = {
          title: extractedMetadata.title || '',
          tagArtists: extractedMetadata.artist || '',
          genre: extractedMetadata.genre || 'Podcast Shows',
          description: extractedMetadata.album ? `Album: ${extractedMetadata.album}${extractedMetadata.year ? ` (${extractedMetadata.year})` : ''}` : ''
        };
        
        console.log('Form data updates:', updatedFormData);
        
        setFormData(prev => ({
          ...prev,
          ...updatedFormData
        }));
        
        // Set cover art if available
        if (metadata.cover_art) {
          setCoverArt(metadata.cover_art);
        }
        
        // Set file as valid if we got this far
        setFileValidation({
          valid: true,
          mime_type: file.type,
          file_extension: file.name.split('.').pop()?.toLowerCase() || '',
          file_size_bytes: file.size
        });
      } else {
        let errorData;
        try {
          errorData = await response.json();
          console.error('Backend error response:', errorData);
          setUploadError(errorData);
          
          if (errorData.error_code === 'file_too_large' || 
              errorData.error_code === 'unsupported_file_type' ||
              errorData.error_code === 'invalid_audio_file') {
            setFileValidation({
              valid: false,
              error: errorData.error,
              error_code: errorData.error_code,
              detected_type: errorData.detected_type
            });
          }
        } catch (e) {
          console.error('Failed to parse error response:', e);
          setUploadError({
            error: 'Failed to process file. Please try again.',
            error_code: 'unknown_error'
          });
        }
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
      setUploadError({
        error: 'Error processing file. Please try again.',
        error_code: 'processing_error'
      });
    } finally {
      setExtractingMetadata(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Cancel button is visible when uploadStatus.canCancel is true.
  // It aborts the in-flight XMLHttpRequest and cleans up timers.
  const cancelUpload = () => {
    // Cancel XMLHttpRequest if it exists
    if (currentXhrRef.current) {
      currentXhrRef.current.abort();
      currentXhrRef.current = null;
    }
    
    // Clear any art generation timeout
    if (artGenerationTimeoutRef.current) {
      clearTimeout(artGenerationTimeoutRef.current);
      artGenerationTimeoutRef.current = null;
    }
    
    // Reset upload state
    setIsPublishing(false);
    setShowStatusModal(false);
    setUploadStatus({
      stage: 'idle',
      progress: 0,
      message: '',
      details: '',
      speed: '',
      timeRemaining: '',
      phase: 'none',
      phaseProgress: 0,
      canCancel: false,
      extractedMetadata: null
    });
    
    console.log('Upload cancelled by user');
  };

  // Helper function to calculate file hash
  const calculateFileHash = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const checkForDuplicateTrack = async (title: string, artist: string, fileSize: number): Promise<boolean> => {
    try {
      let fileHash: string | undefined;
      let duration: number | undefined;
      
      // Calculate file hash if file is available
      if (uploadedFile) {
        try {
          fileHash = await calculateFileHash(uploadedFile);
        } catch (error) {
          console.warn('Could not calculate file hash:', error);
        }
      }
      
      // Extract duration from metadata if available
      if (formData.description && formData.description.includes('Duration:')) {
        const durationMatch = formData.description.match(/Duration: (\d+):(\d+)/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
        }
      }

      const response = await fetch(`${API_URL}/upload/check-duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          artist_name: artist,
          file_size: fileSize,
          file_hash: fileHash,
          duration_seconds: duration,
          album: formData.description // Using description as album for now
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error checking for duplicates:', error);
        return false;
      }

      const result = await response.json();
      if (result.duplicate) {
        setDuplicateTrack(result);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return false;
    }
  };

  const handlePublish = async (forceUpload = false) => {
    console.log('[Upload] handlePublish called', { forceUpload, hasDuplicate: !!duplicateTrack });
    if (!uploadedFile) {
      setUploadError({
        error: 'Please select an audio file first.',
        error_code: 'no_file_selected'
      });
      return;
    }

    // If we have a duplicate and user hasn't confirmed to continue
    if (duplicateTrack && !forceUpload) {
      console.log('[Upload] Duplicate present. Waiting for user to confirm overwrite.');
      return; // The UI will show the duplicate warning
    }
    
    // Check for duplicate track before starting upload
    if (!forceUpload) {
      setUploadStatus({
        stage: 'processing',
        progress: 0,
        message: 'Checking for duplicates...',
        details: 'Verifying if this track already exists',
        speed: '',
        timeRemaining: ''
      });
      
      setShowStatusModal(true);
      const isDuplicate = await checkForDuplicateTrack(
        formData.title || uploadedFile.name.replace(/\.[^/.]+$/, ''), // Use filename without extension as fallback title
        formData.tagArtists || 'Unknown Artist',
        uploadedFile.size
      );
      
      if (isDuplicate) {
        // The checkForDuplicateTrack function will update the duplicateTrack state
        // and the UI will show the duplicate warning
        setShowStatusModal(false);
        setUploadStatus({ stage: 'idle', progress: 0, message: '', details: '', speed: '', timeRemaining: '' });
        return;
      }
    }

    // Custom prompt is optional; if blank, we'll generate automatically
    if (showCustomPrompt) {
      console.log('[Upload] Custom prompt state:', { provided: !!customPrompt.trim() });
    }

    if (!formData.title.trim()) {
      setUploadError({
        error: 'Please enter a title for your track.',
        error_code: 'missing_title'
      });
      return;
    }

    if (!formData.tagArtists.trim()) {
      setUploadError({
        error: 'Please enter the artist name.',
        error_code: 'missing_artist'
      });
      return;
    }

    setShowStatusModal(true);
    setIsPublishing(true);
    setUploadStatus({
      stage: 'uploading',
      progress: 0,
      message: 'Preparing to upload your track...',
      details: 'Initializing upload process',
      speed: '',
      timeRemaining: '',
      phase: 'file_upload',
      phaseProgress: 0,
      canCancel: true,
      extractedMetadata: null
    });
    
    // If user chose to force upload, clear duplicate warning UI
    if (forceUpload) {
      console.log('[Upload] Forcing upload. Clearing duplicate banner and setting skip_duplicate_check.');
      setDuplicateTrack(null);
    }

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
      
      // When forcing upload, instruct backend to skip duplicate detection
      if (forceUpload) {
        console.log('[Upload] Appending skip_duplicate_check=true to FormData');
        uploadFormData.append('skip_duplicate_check', 'true');
      }
      
      // Add custom prompt only if provided
      if (showCustomPrompt && customPrompt.trim()) {
        uploadFormData.append('custom_prompt', customPrompt.trim());
      }

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      currentXhrRef.current = xhr; // Store reference for cancellation
      
      // Reset upload tracking
      uploadStartTime.current = Date.now();
      lastLoaded.current = 0;
      lastTime.current = Date.now();
      
      // Set up progress tracking.
      // Phase 1 maps the raw upload progress (0–100%) to overall 0–40%.
      // After we transition to the next phases, we guard against late upload
      // events resetting overall progress below 40%.
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const now = Date.now();
          const fileUploadProgress = Math.round((event.loaded / event.total) * 100);
          const loadedMB = event.loaded / (1024 * 1024);
          const totalMB = event.total / (1024 * 1024);
          
          // Calculate upload speed
          const timeElapsed = (now - lastTime.current) / 1000; // in seconds
          const loadedDiff = event.loaded - lastLoaded.current;
          const speedKbps = timeElapsed > 0 ? (loadedDiff / timeElapsed) / 1024 : 0;
          
          // Calculate time remaining
          const remainingBytes = event.total - event.loaded;
          const remainingTime = speedKbps > 0 ? (remainingBytes / 1024) / speedKbps : 0;
          
          // Update refs
          lastLoaded.current = event.loaded;
          lastTime.current = now;
          
          // Format time remaining
          const formatTime = (seconds: number): string => {
            if (seconds < 60) return `${Math.ceil(seconds)}s`;
            const mins = Math.floor(seconds / 60);
            const secs = Math.ceil(seconds % 60);
            return `${mins}m ${secs}s`;
          };
          
          // Phase 1: File Upload (0-40% of total progress)
          const overallProgress = Math.round(fileUploadProgress * 0.4);
          
          // Determine upload phase message
          let phaseMessage = 'Uploading file';
          if (fileUploadProgress < 10) phaseMessage = 'Starting upload';
          else if (fileUploadProgress > 90) phaseMessage = 'Finalizing upload';
          
          setUploadStatus(prev => {
            // Only update during the initial file upload phase. Once we
            // transition to processing/AI phases, ignore late upload events
            // that could incorrectly reset progress back to 40%.
            if (prev.phase !== 'file_upload') return prev;
            return {
              ...prev,
              stage: 'uploading',
              progress: overallProgress,
              message: `${phaseMessage}: ${fileUploadProgress}%`,
              details: `${loadedMB.toFixed(1)}MB of ${totalMB.toFixed(1)}MB uploaded`,
              phase: 'file_upload',
              phaseProgress: fileUploadProgress,
              canCancel: true,
              speed: speedKbps > 1024 
                ? `${(speedKbps / 1024).toFixed(1)} MB/s` 
                : `${Math.ceil(speedKbps)} KB/s`,
              timeRemaining: remainingTime > 0 ? `About ${formatTime(remainingTime)} remaining` : 'Almost done...'
            };
          });
        }
      });
      
      // Set up load start handler
      xhr.upload.addEventListener('loadstart', () => {
        setUploadStatus({
          stage: 'uploading',
          progress: 0,
          message: 'Preparing upload...',
          details: 'Connecting to server',
          speed: '0 KB/s',
          timeRemaining: 'Starting...',
          phase: 'file_upload',
          phaseProgress: 0,
          canCancel: true,
          extractedMetadata: null
        });
      });
      
      // Set up error handler
      xhr.upload.addEventListener('error', (error) => {
        console.error('Upload error:', error);
        setUploadStatus({
          stage: 'error',
          progress: 0,
          message: 'Upload failed',
          details: 'Network error. Please check your connection and try again.',
          speed: '',
          timeRemaining: '',
          phase: 'none',
          phaseProgress: 0,
          canCancel: false,
          extractedMetadata: null
        });
        setIsPublishing(false);
        currentXhrRef.current = null;
      });
      
      // Create promise to handle XMLHttpRequest
      const uploadPromise = new Promise<Response>((resolve, reject) => {
        xhr.onload = () => {
          // Parse response JSON once if possible
          let parsed: any = null;
          try { parsed = JSON.parse(xhr.responseText); } catch (_) {}

          // FastAPI nests payload under `detail` for HTTPException
          const detail = parsed?.detail || parsed;

          // Handle duplicate conflict (409) BEFORE 2xx branch
          if (xhr.status === 409 && (detail?.error_code === 'duplicate_track' || parsed?.error_code === 'duplicate_track')) {
            const dupInfo = detail?.duplicate_info || parsed?.duplicate_info || null;
            setDuplicateTrack(dupInfo || { match_type: 'db_unique_constraint', reason: 'Duplicate found' });
            setIsPublishing(false);
            setShowStatusModal(false);
            setUploadStatus({
              stage: 'idle',
              progress: 0,
              message: '',
              details: '',
              speed: '',
              timeRemaining: ''
            });
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = parsed || {};
              
              // Phase 2: Metadata Processing (40-70% of total progress)
              setUploadStatus({
                stage: 'processing',
                progress: 40,
                message: 'Processing track...',
                details: 'Analyzing audio and extracting metadata',
                speed: '',
                timeRemaining: 'This may take a moment...',
                phase: 'metadata_extraction',
                phaseProgress: 0,
                canCancel: true,
                extractedMetadata: response.metadata || null
              });
              
              // Simulate metadata processing progress
              const metadataInterval = setInterval(() => {
                setUploadStatus(prev => {
                  if (prev.phase === 'metadata_extraction' && prev.phaseProgress < 100) {
                    const newPhaseProgress = Math.min(prev.phaseProgress + 20, 100);
                    const overallProgress = 40 + (newPhaseProgress * 0.3); // 40% + up to 30%
                    return {
                      ...prev,
                      progress: Math.round(overallProgress),
                      phaseProgress: newPhaseProgress,
                      details: newPhaseProgress < 50 ? 'Analyzing audio format...' :
                              newPhaseProgress < 80 ? 'Extracting metadata...' :
                              'Preparing for cover art generation...'
                    };
                  }
                  return prev;
                });
              }, 300);
              
              // Clear interval after processing
              setTimeout(() => {
                clearInterval(metadataInterval);
              }, 1500);
              
              // If we get here, the upload was successful
              resolve(response);
            } catch (error) {
              console.error('Error parsing response:', error);
              reject(new Error('Failed to parse server response'));
            }
          } else {
            // Handle HTTP error statuses
            console.error('Upload failed with status:', xhr.status, xhr.statusText);
            console.error('Response text:', xhr.responseText);
            
            // Prefer server-provided message when available
            const serverMsg = detail?.error || parsed?.error || detail?.message || xhr.statusText;
            setUploadStatus(prev => ({
              ...prev,
              stage: 'error',
              progress: 0,
              message: 'Upload failed',
              details: serverMsg,
              canCancel: false,
              phase: 'none',
              phaseProgress: 0,
              speed: '',
              timeRemaining: ''
            }));
            
            reject(new Error(`HTTP ${xhr.status}: ${serverMsg}`));
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
        
        console.log('[Upload] Opening XHR to /upload');
        xhr.open('POST', `${API_URL}/upload`, true);
        // Set withCredentials to include cookies if needed
        xhr.withCredentials = false;
        
        // Set headers
        xhr.setRequestHeader('Accept', 'application/json');
        
        // For CORS preflight, the browser will handle the headers
        // We don't need to manually set Content-Type for FormData, the browser will set it with the correct boundary
        
        console.log('[Upload] Sending XHR with form data (forced? ', forceUpload, ')');
        xhr.send(uploadFormData);
      });
      
      const result = await uploadPromise;
        console.log('Upload successful:', result);
        
      // Phase 3: AI Art Generation (70-100% of total progress)
        if (result.generating_art) {
          setUploadStatus({
            stage: 'generating_art',
            progress: 70,
            message: '🎨 Creating cover art...',
            details: 'Using AI to generate a unique cover image',
            speed: '',
            timeRemaining: 'This usually takes 10-20 seconds',
            phase: 'ai_generation',
            phaseProgress: 0,
            canCancel: true,
            extractedMetadata: result.metadata || null
          });
          
          // Simulate AI generation progress
          const artInterval = setInterval(() => {
            setUploadStatus(prev => {
              if (prev.phase === 'ai_generation' && prev.phaseProgress < 90) {
                const newPhaseProgress = Math.min(prev.phaseProgress + 15, 90);
                const overallProgress = 70 + (newPhaseProgress * 0.3); // 70% + up to 27%
                return {
                  ...prev,
                  progress: Math.round(overallProgress),
                  phaseProgress: newPhaseProgress,
                  details: newPhaseProgress < 30 ? 'Analyzing song metadata...' :
                          newPhaseProgress < 60 ? 'Generating AI artwork...' :
                          'Finalizing cover art...'
                };
              }
              return prev;
            });
          }, 800);
          
          // Store interval reference for cleanup
          artGenerationTimeoutRef.current = artInterval;
          
          // Poll for art generation status
          const checkArtStatus = async (trackId: string, attempt = 1) => {
            try {
              const statusResponse = await fetch(`${API_URL}/tracks/${trackId}/art-status`);
              if (statusResponse.ok) {
                const status = await statusResponse.json();
                
                if (status.status === 'completed') {
                  // Clear art generation interval
                  if (artGenerationTimeoutRef.current) {
                    clearInterval(artGenerationTimeoutRef.current);
                    artGenerationTimeoutRef.current = null;
                  }
                  
                  setUploadStatus({
                    stage: 'success',
                    progress: 100,
                    message: '🎉 Upload complete!',
                    details: 'Your track is ready to play',
                    speed: '',
                    timeRemaining: 'Redirecting...',
                    phase: 'complete',
                    phaseProgress: 100,
                    canCancel: false,
                    extractedMetadata: null
                  });
                  setPublishStatus('success');
                  currentXhrRef.current = null;
                  refreshLibrary();
                  return true;
                } else if (status.status === 'failed') {
                  console.warn('Art generation failed, using default cover');
                  // Clear art generation interval
                  if (artGenerationTimeoutRef.current) {
                    clearInterval(artGenerationTimeoutRef.current);
                    artGenerationTimeoutRef.current = null;
                  }
                  
                  setUploadStatus({
                    stage: 'success',
                    progress: 100,
                    message: '✅ Upload complete!',
                    details: 'Your track is ready (using default cover)',
                    speed: '',
                    timeRemaining: 'Redirecting...'
                  });
                  setPublishStatus('success');
                  refreshLibrary();
                  return true;
                } else if (attempt < 10) { // Max 10 attempts (about 30 seconds)
                  // Update status with progress
                  setUploadStatus(prev => ({
                    ...prev,
                    details: `Generating cover art... (${attempt * 10}%)`,
                    timeRemaining: `About ${20 - (attempt * 2)}s remaining`
                  }));
                  
                  // Check again in 3 seconds
                  setTimeout(() => checkArtStatus(trackId, attempt + 1), 3000);
                } else {
                  // Timeout after max attempts
                  console.warn('Art generation timed out, using default cover');
                  setUploadStatus({
                    stage: 'success',
                    progress: 100,
                    message: '✅ Upload complete!',
                    details: 'Your track is ready (using default cover)',
                    speed: '',
                    timeRemaining: 'Redirecting...'
                  });
                  setPublishStatus('success');
                  refreshLibrary();
                  return true;
                }
              }
            } catch (error) {
              console.error('Error checking art status:', error);
              if (attempt < 3) { // Retry on network errors
                setTimeout(() => checkArtStatus(trackId, attempt + 1), 3000);
              } else {
                setUploadStatus(prev => ({
                  ...prev,
                  message: '✅ Upload complete!',
                  details: 'Your track is ready (skipped cover art)',
                  timeRemaining: 'Redirecting...'
                }));
                setPublishStatus('success');
                refreshLibrary();
              }
            }
            return false;
          };
          
          // Start polling for art status
          if (result.id) {
            checkArtStatus(result.id);
          }
        } else {
          setUploadStatus({
            stage: 'success',
            progress: 100,
            message: '✅ Upload complete!',
            details: 'Your track is now available',
            speed: '',
            timeRemaining: 'Redirecting...'
          });
          setPublishStatus('success');
          refreshLibrary();
        }
        
        // Convert uploaded mix to Song format for player
        const uploadedSong: Song = {
          id: result.id.toString(),
          title: result.title,
          artist: result.artist.name,
          album: result.album || 'Single',
          duration: result.duration_seconds,
          imageUrl: result.cover_art_url
            ? (result.cover_art_url.startsWith('http') ? result.cover_art_url : `${API_URL}${result.cover_art_url}`)
            : '/default-cover.jpg',
          audioUrl: result.stream_url
            ? (result.stream_url.startsWith('http') ? result.stream_url : `${API_URL}${result.stream_url}`)
            : `${API_URL}/tracks/${result.id}/stream`,
          genre: result.genre || 'Unknown',
          year: result.year || new Date().getFullYear()
        };
        
        console.log('Created song object for playback:', uploadedSong);
        
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
    <div className="upload-page-container">
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">Upload single stream</h1>
        </div>

        {/* File Upload Section */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
        {/* Error Message */}
        {uploadError && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg flex items-start space-x-2">
            <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Upload Error</p>
              <p className="text-sm">{uploadError.error}</p>
              {uploadError.error_code === 'unsupported_file_type' && uploadError.detected_type && (
                <p className="text-xs mt-1">Detected type: {uploadError.detected_type}</p>
              )}
            </div>
          </div>
        )}
        
        {/* File Validation Status */}
        {fileValidation && !fileValidation.valid && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-300 px-4 py-3 rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">File Issue</p>
              <p className="text-sm">{fileValidation.error}</p>
              {fileValidation.error_code === 'unsupported_file_type' && fileValidation.detected_type && (
                <p className="text-xs mt-1">Detected type: {fileValidation.detected_type}</p>
              )}
            </div>
          </div>
        )}
        
        {fileValidation?.valid && (
          <div className="bg-green-500/10 border border-green-500/50 text-green-300 px-4 py-3 rounded-lg flex items-start space-x-2">
            <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">File Validated</p>
              <p className="text-sm">
                {fileValidation.file_size_bytes && `Size: ${(fileValidation.file_size_bytes / (1024 * 1024)).toFixed(1)}MB`}
                {fileValidation.mime_type && ` • Type: ${fileValidation.mime_type}`}
              </p>
            </div>
          </div>
        )}
        
        {/* Enhanced Duplicate Track Warning */}
        {duplicateTrack && (
          <div className={`border px-4 py-3 rounded-lg animate-fade-in ${
            duplicateTrack.match_type === 'exact_file' 
              ? 'bg-red-500/10 border-red-500/50 text-red-300'
              : duplicateTrack.confidence >= 0.9
              ? 'bg-orange-500/10 border-orange-500/50 text-orange-300'
              : 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300'
          }`}>
            <div className="flex items-start space-x-3">
              <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                duplicateTrack.match_type === 'exact_file' ? 'text-red-400'
                : duplicateTrack.confidence >= 0.9 ? 'text-orange-400'
                : 'text-yellow-400'
              }`} />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-medium ${
                      duplicateTrack.match_type === 'exact_file' ? 'text-red-200'
                      : duplicateTrack.confidence >= 0.9 ? 'text-orange-200'
                      : 'text-yellow-200'
                    }`}>
                      {duplicateTrack.match_type === 'exact_file' ? 'Exact Duplicate Detected' 
                       : duplicateTrack.confidence >= 0.9 ? 'Very Similar Track Found'
                       : 'Possible Duplicate Track'}
                    </p>
                    {duplicateTrack.confidence && (
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs opacity-80">Confidence:</span>
                        <div className="flex items-center space-x-1">
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                duplicateTrack.confidence >= 0.9 ? 'bg-red-400'
                                : duplicateTrack.confidence >= 0.8 ? 'bg-orange-400'
                                : 'bg-yellow-400'
                              }`}
                              style={{ width: `${duplicateTrack.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono">{(duplicateTrack.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setDuplicateTrack(null)}
                    className={`hover:opacity-75 transition-colors ${
                      duplicateTrack.match_type === 'exact_file' ? 'text-red-400'
                      : duplicateTrack.confidence >= 0.9 ? 'text-orange-400'
                      : 'text-yellow-400'
                    }`}
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm mt-2 opacity-90">
                  {duplicateTrack.reason || 'A similar track was found in the library:'}
                </p>
                <div className={`mt-3 bg-black/20 p-4 rounded-lg border ${
                  duplicateTrack.match_type === 'exact_file' ? 'border-red-500/20'
                  : duplicateTrack.confidence >= 0.9 ? 'border-orange-500/20'
                  : 'border-yellow-500/20'
                }`}>
                  <div className="flex items-start space-x-3">
                    <div className={`w-12 h-12 rounded flex items-center justify-center flex-shrink-0 ${
                      duplicateTrack.match_type === 'exact_file' ? 'bg-red-500/10'
                      : duplicateTrack.confidence >= 0.9 ? 'bg-orange-500/10'
                      : 'bg-yellow-500/10'
                    }`}>
                      <Music className={`w-5 h-5 ${
                        duplicateTrack.match_type === 'exact_file' ? 'text-red-400'
                        : duplicateTrack.confidence >= 0.9 ? 'text-orange-400'
                        : 'text-yellow-400'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        duplicateTrack.match_type === 'exact_file' ? 'text-red-100'
                        : duplicateTrack.confidence >= 0.9 ? 'text-orange-100'
                        : 'text-yellow-100'
                      }`}>{duplicateTrack.title}</p>
                      <p className={`text-sm truncate ${
                        duplicateTrack.match_type === 'exact_file' ? 'text-red-300/80'
                        : duplicateTrack.confidence >= 0.9 ? 'text-orange-300/80'
                        : 'text-yellow-300/80'
                      }`}>{duplicateTrack.artist_name}</p>
                      
                      {/* Basic Info */}
                      <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs ${
                        duplicateTrack.match_type === 'exact_file' ? 'text-red-400/80'
                        : duplicateTrack.confidence >= 0.9 ? 'text-orange-400/80'
                        : 'text-yellow-400/80'
                      }`}>
                        <span>Size: {duplicateTrack.file_size_mb?.toFixed(1)}MB</span>
                        <span>Uploaded: {new Date(duplicateTrack.uploaded_at).toLocaleDateString()}</span>
                        {duplicateTrack.size_difference_pct && (
                          <span>Size difference: {duplicateTrack.size_difference_pct}%</span>
                        )}
                      </div>
                      
                      {/* Similarity Metrics */}
                      {(duplicateTrack.title_similarity || duplicateTrack.artist_similarity || duplicateTrack.duration_similarity) && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium opacity-80">Similarity Breakdown:</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {duplicateTrack.title_similarity && (
                              <div className="flex justify-between">
                                <span>Title:</span>
                                <span className="font-mono">{(duplicateTrack.title_similarity * 100).toFixed(0)}%</span>
                    </div>
                            )}
                            {duplicateTrack.artist_similarity && (
                              <div className="flex justify-between">
                                <span>Artist:</span>
                                <span className="font-mono">{(duplicateTrack.artist_similarity * 100).toFixed(0)}%</span>
                              </div>
                            )}
                            {duplicateTrack.duration_similarity && (
                              <div className="flex justify-between">
                                <span>Duration:</span>
                                <span className="font-mono">{(duplicateTrack.duration_similarity * 100).toFixed(0)}%</span>
                              </div>
                            )}
                            {duplicateTrack.album_similarity && (
                              <div className="flex justify-between">
                                <span>Album:</span>
                                <span className="font-mono">{(duplicateTrack.album_similarity * 100).toFixed(0)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); console.log('[Upload] Upload Anyway clicked'); handlePublish(true); }}
                    disabled={isPublishing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border flex items-center space-x-2 ${isPublishing ? 'opacity-50 cursor-not-allowed bg-yellow-500/10 border-yellow-500/20 text-yellow-400/70' : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border-yellow-500/30 hover:border-yellow-500/50'}`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Anyway</span>
                  </button>
                  <button
                    onClick={() => {
                      setDuplicateTrack(null);
                      setUploadStatus({
                        stage: 'idle',
                        progress: 0,
                        message: '',
                        details: '',
                        speed: '',
                        timeRemaining: ''
                      });
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors border border-white/10 hover:border-white/20 flex items-center space-x-2"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
                <p className="text-xs mt-3 text-yellow-400/70">
                  If this is a different version or remix, consider updating the title to reflect the difference.
                </p>
              </div>
            </div>
          </div>
        )}
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

          {showStatusModal ? (
            <div 
              className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget && uploadStatus.stage !== 'uploading' && uploadStatus.stage !== 'processing' && uploadStatus.stage !== 'generating_art') {
                  setShowStatusModal(false);
                }
              }}
            >
              <div 
                ref={statusModalRef}
                className="bg-gray-900/95 rounded-2xl p-6 max-w-lg w-full mx-4 border border-white/10 shadow-2xl shadow-black/50 transform transition-all duration-300 animate-fade-in relative"
              >
                <button 
                  onClick={() => {
                    if (uploadStatus.stage !== 'uploading' && uploadStatus.stage !== 'processing' && uploadStatus.stage !== 'generating_art') {
                      setShowStatusModal(false);
                    }
                  }}
                  className={`absolute top-4 right-4 p-1 rounded-full ${uploadStatus.stage === 'uploading' || uploadStatus.stage === 'processing' || uploadStatus.stage === 'generating_art' 
                    ? 'text-gray-500 cursor-not-allowed' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                  disabled={uploadStatus.stage === 'uploading' || uploadStatus.stage === 'processing' || uploadStatus.stage === 'generating_art'}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {uploadStatus.stage === 'uploading' && (
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                          </div>
                          <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/30 to-blue-500/30 rounded-full animate-pulse blur-sm"></div>
                        </div>
                      )}
                      {uploadStatus.stage === 'processing' && (
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                          </div>
                          <div className="absolute -inset-1 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full animate-pulse blur-sm"></div>
                        </div>
                      )}
                      {uploadStatus.stage === 'generating_art' && (
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
                          </div>
                          <div className="absolute -inset-1 bg-gradient-to-br from-pink-500/30 to-rose-500/30 rounded-full animate-pulse blur-sm"></div>
                        </div>
                      )}
                      {uploadStatus.stage === 'success' && (
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-400" />
                          </div>
                          <div className="absolute -inset-1 bg-gradient-to-br from-green-500/30 to-emerald-500/30 rounded-full animate-ping opacity-20"></div>
                        </div>
                      )}
                      {uploadStatus.stage === 'error' && (
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-red-400" />
                          </div>
                          <div className="absolute -inset-1 bg-gradient-to-br from-red-500/30 to-rose-500/30 rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-white leading-tight">
                        {uploadStatus.message}
                      </h3>
                      {uploadStatus.details && (
                        <p className="text-gray-300 text-sm mt-1">{uploadStatus.details}</p>
                      )}
                      
                      {uploadStatus.timeRemaining && (
                        <p className="text-xs text-gray-400 mt-2">
                          {uploadStatus.timeRemaining}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Phase stepper and per-phase progress */}
                  {(uploadStatus.stage === 'uploading' || uploadStatus.stage === 'processing' || uploadStatus.stage === 'generating_art') && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <div className={`flex-1 flex items-center ${uploadStatus.progress >= 1 ? 'text-white' : ''}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${uploadStatus.progress >= 1 ? 'bg-purple-500/30 border-purple-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>1</div>
                          <span className="ml-2 truncate">Upload</span>
                        </div>
                        <div className="w-8 h-px bg-gray-700 mx-2" />
                        <div className={`flex-1 flex items-center ${uploadStatus.progress >= 40 ? 'text-white' : ''}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${uploadStatus.progress >= 40 ? 'bg-blue-500/30 border-blue-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>2</div>
                          <span className="ml-2 truncate">Process</span>
                        </div>
                        <div className="w-8 h-px bg-gray-700 mx-2" />
                        <div className={`flex-1 flex items-center ${uploadStatus.progress >= 70 ? 'text-white' : ''}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${uploadStatus.progress >= 70 ? 'bg-pink-500/30 border-pink-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>3</div>
                          <span className="ml-2 truncate">Cover Art</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-300">
                        <span>Current phase: </span>
                        <span className="font-medium text-white">
                          {uploadStatus.phase === 'file_upload' ? 'File Upload' : uploadStatus.phase === 'metadata_extraction' ? 'Metadata Processing' : uploadStatus.phase === 'ai_generation' ? 'AI Cover Art' : uploadStatus.phase === 'complete' ? 'Complete' : 'Preparing'}
                        </span>
                      </div>
                      <div>
                        <div className="w-full bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              uploadStatus.phase === 'file_upload'
                                ? 'bg-gradient-to-r from-purple-500 to-blue-500'
                                : uploadStatus.phase === 'metadata_extraction'
                                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                  : 'bg-gradient-to-r from-pink-500 to-rose-500'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, uploadStatus.phaseProgress || 0))}%` }}
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-gray-400">
                          {uploadStatus.phase === 'file_upload' && (uploadStatus.phaseProgress < 10 ? 'Starting upload...' : uploadStatus.phaseProgress < 90 ? 'Uploading audio...' : 'Finalizing upload...')}
                          {uploadStatus.phase === 'metadata_extraction' && (uploadStatus.phaseProgress < 50 ? 'Analyzing audio format...' : uploadStatus.phaseProgress < 80 ? 'Extracting metadata...' : 'Preparing for cover art generation...')}
                          {uploadStatus.phase === 'ai_generation' && (uploadStatus.phaseProgress < 30 ? 'Analyzing song metadata...' : uploadStatus.phaseProgress < 60 ? 'Generating AI artwork...' : 'Finalizing cover art...')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {(uploadStatus.stage === 'uploading' || uploadStatus.stage === 'processing' || uploadStatus.stage === 'generating_art') && (
                    <div className="space-y-3">
                      <div className="w-full bg-gray-800/50 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            uploadStatus.stage === 'uploading' 
                              ? 'bg-gradient-to-r from-purple-500 to-blue-500' 
                              : uploadStatus.stage === 'processing'
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                : 'bg-gradient-to-r from-pink-500 to-rose-500'
                          }`}
                          style={{ 
                            width: `${uploadStatus.progress}%`,
                            transitionProperty: 'width',
                            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        />
                      </div>
                      
                      {(uploadStatus.speed || uploadStatus.progress) && (
                        <div className="flex justify-between items-center text-xs">
                          {uploadStatus.speed && (
                            <div className="flex items-center space-x-1 text-gray-400">
                              <span>Speed:</span>
                              <span className="font-mono text-white">{uploadStatus.speed}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400">Progress:</span>
                            <span className="font-mono text-white">
                              {Math.round(uploadStatus.progress)}%
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {uploadStatus.stage === 'uploading' && uploadStatus.details && (
                        <div className="text-xs text-gray-400 mt-1">
                          {uploadStatus.details}
                        </div>
                      )}
                      {uploadStatus.timeRemaining && (
                        <div className="space-y-1">
                          <span className="text-gray-400">Time Remaining</span>
                          <div className="font-mono text-white">{uploadStatus.timeRemaining}</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {uploadStatus.canCancel && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={cancelUpload}
                        className="px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition-colors"
                      >
                        Cancel upload
                      </button>
                    </div>
                  )}
                  
                  {uploadStatus.stage === 'error' && (
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setUploadStatus({ 
                            stage: 'idle', 
                            progress: 0, 
                            message: '',
                            details: '',
                            speed: '',
                            timeRemaining: ''
                          });
                          setIsPublishing(false);
                        }}
                        className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </div>
            ) : null}

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
      </div>
    </div>
  );
};

export default UploadPage;

