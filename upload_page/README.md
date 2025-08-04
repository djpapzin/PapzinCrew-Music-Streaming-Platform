# Music Streaming File Upload Interface

A modern, production-ready file upload interface for music streaming platforms built with Next.js, TypeScript, and Tailwind CSS. Features automatic metadata extraction, cover art handling, and a clean two-step user experience.

![Upload Interface Preview](https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1200&h=600&fit=crop)

## ✨ Features

### Core Functionality
- **Drag & Drop Upload**: Intuitive file upload with visual feedback
- **Automatic Metadata Extraction**: Extracts title, artist, and cover art from MP3 files
- **Cover Art Management**: Display, preview, and replace album artwork
- **Two-Step User Flow**: Clean progression from upload to detailed form
- **Advanced Options**: Collapsible section for genre, tags, and publishing settings
- **Form Validation**: Required field validation with user-friendly error handling

### Technical Features
- **TypeScript**: Full type safety throughout the application
- **Responsive Design**: Optimized for desktop and mobile devices
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **File Size Validation**: 100MB limit with clear user feedback
- **Multiple Audio Formats**: Support for MP3, WAV, FLAC, AAC, and OGG
- **Image Format Support**: PNG, JPG, JPEG, GIF, and WebP for cover art

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd music-upload-interface
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## 📖 Usage Guide

### Step 1: Upload Audio File
1. Drag and drop an audio file onto the upload zone, or click to select
2. Supported formats: MP3, WAV, FLAC, AAC, OGG (max 100MB)
3. The interface automatically extracts metadata and transitions to the form

### Step 2: Complete Track Details
1. **Basic Information**: Review and edit the auto-populated title and artist
2. **Cover Art**: The extracted cover art is displayed automatically
   - Click the cover art area to replace with a new image
   - Drag and drop images directly onto the cover art preview
3. **Description**: Add details about your track in the "About This Stream" field
4. **Advanced Options**: Click to expand additional settings:
   - Genre selection
   - Tags (comma-separated)
   - Availability (Public, Unlisted, Private)
   - Language and explicit content settings

### Step 3: Publish
Click the "Publish Track" button to process your upload. The form data is compiled and logged to the console for development purposes.

## 🛠️ Development

### Project Structure
```
├── app/
│   ├── globals.css          # Global styles and CSS variables
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Main upload interface
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── icons/               # Custom SVG icons
│   ├── CoverArtUploader.tsx # Cover art upload component
│   └── TrackForm.tsx        # Track metadata form
├── lib/
│   └── utils.ts             # Utility functions
└── README.md
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Dependencies

- **Next.js 13.5.1** - React framework with App Router
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components
- **react-dropzone** - File upload functionality
- **music-metadata-browser** - Audio metadata extraction
- **Lucide React** - Icon library

## 🎨 Design System

### Color Palette
The interface uses a sophisticated neutral color palette with semantic color tokens:
- **Primary**: High-contrast black for key actions
- **Secondary**: Subtle grays for secondary elements
- **Muted**: Light grays for backgrounds and disabled states
- **Accent**: Contextual colors for interactive elements

### Typography
- **Font**: Inter (Google Fonts) for excellent readability
- **Hierarchy**: Clear typographic scale from headings to body text
- **Line Height**: Optimized for readability (150% body, 120% headings)

### Spacing
- **8px Grid System**: Consistent spacing throughout the interface
- **Responsive Breakpoints**: Mobile-first approach with desktop enhancements

## 🔧 Customization

### Styling
The interface uses CSS custom properties for easy theming:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  /* ... additional color tokens */
}
```

### Form Fields
Add new form fields by extending the `TrackData` interface in `components/TrackForm.tsx`:
```typescript
interface TrackData {
  // existing fields...
  newField: string;
}
```

### File Validation
Modify accepted file types in the dropzone configuration:
```typescript
accept: {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  // add new formats here
}
```

## 📱 Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+
- **Features**: File API, Drag & Drop API, Web Audio API support required

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the technical documentation for implementation details
- Review the component source code for customization examples

---

Built with ❤️ using Next.js, TypeScript, and Tailwind CSS