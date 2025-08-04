# Technical Documentation

## Architecture Overview

The Music Streaming File Upload Interface is built using a modern React architecture with Next.js 13+ App Router, TypeScript for type safety, and a component-based design pattern. The application follows a clean separation of concerns with dedicated components for each major functionality.

## Core Technologies

### Framework & Runtime
- **Next.js 13.5.1**: React framework with App Router for file-based routing
- **React 18.2.0**: Component library with hooks and concurrent features
- **TypeScript 5.2.2**: Static type checking and enhanced developer experience
- **Node.js**: Server-side runtime (development and build processes)

### Styling & UI
- **Tailwind CSS 3.3.3**: Utility-first CSS framework
- **shadcn/ui**: High-quality React component library built on Radix UI
- **CSS Custom Properties**: Theme-able design tokens
- **Responsive Design**: Mobile-first approach with breakpoint system

### File Handling & Metadata
- **react-dropzone 14.2.3**: File upload with drag-and-drop functionality
- **music-metadata-browser 2.5.10**: Client-side audio metadata extraction
- **File API**: Browser-native file handling capabilities

## Component Architecture

### Main Page Component (`app/page.tsx`)

The main page component orchestrates the entire user flow and manages global state.

#### State Management
```typescript
interface TrackMetadata {
  title?: string;
  artist?: string;
  picture?: string;
}

// Primary state variables
const [audioFile, setAudioFile] = useState<File | null>(null);
const [coverArtFile, setCoverArtFile] = useState<File | null>(null);
const [metadata, setMetadata] = useState<TrackMetadata>({});
const [coverArtUrl, setCoverArtUrl] = useState<string | null>(null);
const [isProcessing, setIsProcessing] = useState(false);
```

#### Metadata Extraction Process
```typescript
const extractMetadata = async (file: File) => {
  setIsProcessing(true);
  try {
    const buffer = await file.arrayBuffer();
    const parsedMetadata = await parseBuffer(new Uint8Array(buffer));
    
    // Extract text metadata
    const extractedData: TrackMetadata = {
      title: parsedMetadata.common.title || file.name.replace(/\.[^/.]+$/, ''),
      artist: parsedMetadata.common.artist || parsedMetadata.common.albumartist || 'Unknown Artist',
    };

    // Extract and process cover art
    if (parsedMetadata.common.picture && parsedMetadata.common.picture.length > 0) {
      const picture = parsedMetadata.common.picture[0];
      const blob = new Blob([picture.data], { type: picture.format });
      const imageUrl = URL.createObjectURL(blob);
      setCoverArtUrl(imageUrl);
      extractedData.picture = imageUrl;
    }

    setMetadata(extractedData);
  } catch (error) {
    // Fallback handling for unsupported files
    console.error('Error extracting metadata:', error);
    setMetadata({
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Unknown Artist',
    });
  } finally {
    setIsProcessing(false);
  }
};
```

### Cover Art Uploader (`components/CoverArtUploader.tsx`)

Handles cover art display and replacement functionality.

#### Key Features
- **Drag & Drop**: Integrated dropzone for image files
- **Preview Display**: Shows current cover art with hover effects
- **File Validation**: Accepts common image formats (PNG, JPG, JPEG, GIF, WebP)
- **Responsive Design**: Maintains aspect ratio across screen sizes

#### Implementation Details
```typescript
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
```

### Track Form Component (`components/TrackForm.tsx`)

Manages track metadata input and form validation.

#### Form Data Structure
```typescript
interface TrackData {
  title: string;
  artist: string;
  about: string;
  genre: string;
  tags: string;
  availability: string;
  language: string;
  explicit: string;
}
```

#### Advanced Options Toggle
The form implements a collapsible advanced section using React state:
```typescript
const [showAdvanced, setShowAdvanced] = useState(false);

// Toggle button with dynamic icon and text
<Button
  type="button"
  variant="ghost"
  onClick={() => setShowAdvanced(!showAdvanced)}
  className="flex items-center gap-2"
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
```

## File Upload Flow

### Step 1: Initial Dropzone
1. User sees centered dropzone with upload instructions
2. Dropzone accepts audio files up to 100MB
3. Visual feedback during drag operations
4. File validation on drop/selection

### Step 2: Metadata Processing
1. File is processed using `music-metadata-browser`
2. Text metadata (title, artist) extracted and stored
3. Cover art extracted and converted to blob URL
4. Processing state shown to user during extraction

### Step 3: Form Population
1. View transitions to two-column layout
2. Extracted metadata populates form fields
3. Cover art displayed in preview component
4. User can modify all extracted data

### Step 4: Data Compilation
1. Form submission gathers all user input
2. FormData object created with:
   - Form field values
   - Original audio file
   - Cover art file (if replaced)
3. Data logged to console for development

## Data Flow Diagram

```
User File Selection
        ↓
File Validation & Processing
        ↓
Metadata Extraction (music-metadata-browser)
        ↓
State Updates (metadata, coverArt, etc.)
        ↓
UI Re-render (form population)
        ↓
User Form Interaction
        ↓
Form Submission & Data Compilation
        ↓
FormData Creation & Console Output
```

## Error Handling

### File Upload Errors
- **File Size**: 100MB limit with user notification
- **File Type**: Only audio formats accepted
- **Multiple Files**: Single file restriction enforced

### Metadata Extraction Errors
- **Unsupported Format**: Graceful fallback to filename
- **Corrupted Files**: Error logging with user-friendly message
- **Missing Metadata**: Default values provided

### Form Validation
- **Required Fields**: Title and Artist marked as required
- **Input Sanitization**: Form data validated before submission

## Performance Considerations

### File Processing
- **Asynchronous Operations**: Non-blocking metadata extraction
- **Memory Management**: Blob URLs created and managed properly
- **Large File Handling**: Progress indication during processing

### Image Optimization
- **Lazy Loading**: Cover art loaded on demand
- **Blob URL Management**: Proper cleanup to prevent memory leaks
- **Responsive Images**: Appropriate sizing for different screen sizes

### Bundle Optimization
- **Code Splitting**: Components loaded as needed
- **Tree Shaking**: Unused code eliminated in production
- **Static Export**: Optimized for deployment

## Browser Compatibility

### Required APIs
- **File API**: File reading and processing
- **Drag & Drop API**: File upload functionality
- **Blob API**: Image URL creation
- **ArrayBuffer**: Binary data processing

### Supported Browsers
- Chrome 90+ (full support)
- Firefox 88+ (full support)
- Safari 14+ (full support)
- Edge 90+ (full support)

### Fallbacks
- **No Drag & Drop**: Click-to-upload still available
- **No File API**: Graceful degradation with error messages
- **Limited Metadata**: Filename-based fallbacks

## Security Considerations

### File Validation
- **MIME Type Checking**: Server-side validation recommended
- **File Size Limits**: Client and server-side enforcement
- **Content Scanning**: Malware detection in production

### Data Handling
- **Client-Side Processing**: Metadata extraction in browser
- **No Server Storage**: Files processed locally
- **CORS Considerations**: Cross-origin resource sharing

## Deployment Configuration

### Next.js Configuration (`next.config.js`)
```javascript
const nextConfig = {
  output: 'export',           // Static export for deployment
  eslint: {
    ignoreDuringBuilds: true, // Skip linting during build
  },
  images: { 
    unoptimized: true         // Disable image optimization for static export
  },
};
```

### Build Process
1. **TypeScript Compilation**: Type checking and transpilation
2. **CSS Processing**: Tailwind compilation and optimization
3. **Bundle Creation**: JavaScript bundling and minification
4. **Static Generation**: HTML pre-generation for all routes

## Testing Strategy

### Unit Testing
- Component rendering tests
- Form validation tests
- Metadata extraction tests
- File upload simulation

### Integration Testing
- End-to-end user flow testing
- File processing pipeline testing
- Error handling scenarios

### Performance Testing
- Large file upload testing
- Memory usage monitoring
- Bundle size analysis

## Monitoring & Analytics

### Error Tracking
- Client-side error logging
- File processing failure tracking
- User interaction analytics

### Performance Metrics
- File upload completion rates
- Metadata extraction success rates
- User flow completion tracking

## Future Enhancements

### Planned Features
- **Batch Upload**: Multiple file processing
- **Audio Preview**: In-browser playback
- **Cloud Storage**: Direct upload to storage services
- **Advanced Metadata**: Additional ID3 tag support

### Technical Improvements
- **Web Workers**: Background file processing
- **Progressive Upload**: Chunked file uploads
- **Offline Support**: Service worker integration
- **Real-time Validation**: Live form feedback

## API Integration Points

### Upload Endpoint
```typescript
// Example API integration
const handlePublish = async (formData: TrackData) => {
  const publishData = new FormData();
  
  // Add form fields
  Object.keys(formData).forEach(key => {
    publishData.append(key, formData[key]);
  });
  
  // Add files
  if (audioFile) publishData.append('audioFile', audioFile);
  if (coverArtFile) publishData.append('coverArt', coverArtFile);
  
  // Send to API
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: publishData,
  });
  
  return response.json();
};
```

### Expected API Response
```typescript
interface UploadResponse {
  success: boolean;
  trackId?: string;
  message: string;
  errors?: string[];
}
```

This technical documentation provides a comprehensive overview of the implementation details, architecture decisions, and considerations for maintaining and extending the music streaming file upload interface.