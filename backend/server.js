const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const app = express();
const port = 5000;

// Set up memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Enable CORS with more explicit configuration
app.use(cors({
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Pre-flight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory store for mixes
const mixes = [];

// Add your demo track if none exist yet
if (mixes.length === 0) {
  mixes.push({
    id: 1,
    title: 'Kelvin Momo and Da Muziqal Chef - Bo Gogo',
    description: 'Featuring Tracy Thatohatsi',
    filename: 'Kelvin Momo and Da Muziqal Chef Bo Gogo Ft Tracy Thatohatsi.mp3',
    mimetype: 'audio/mpeg',
    size: 3145728, // Estimated size
    // Note: The actual audio buffer will need to be loaded when a user uploads the file
  });
}

// Endpoint to handle file uploads
app.post('/api/mixes', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const mix = {
    id: mixes.length + 1,
    title: req.body.title || 'Untitled Mix',
    description: req.body.description || 'No description',
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    buffer: req.file.buffer,
    size: req.file.size,
  };

  mixes.push(mix);

  // Return the created mix without the buffer to avoid large responses
  const response = { ...mix };
  delete response.buffer;
  
  res.status(201).json(response);
});

// Endpoint to fetch all mixes
app.get('/api/mixes', (req, res) => {
  const mixSummaries = mixes.map(mix => ({
    id: mix.id,
    title: mix.title,
    description: mix.description,
    filename: mix.filename,
    size: mix.size,
  }));

  res.json(mixSummaries);
});

// Endpoint to stream a specific mix by ID
app.get('/api/mixes/:id', (req, res) => {
  const mix = mixes.find(m => m.id === parseInt(req.params.id));
  if (!mix) {
    return res.status(404).json({ error: 'Mix not found' });
  }

  // If this is our demo mix with no buffer
  if (!mix.buffer) {
    // Send a proper response with a message instead of a 404
    return res.status(200).json({
      message: 'This is a demo track. Please upload the actual MP3 file to play it.',
      demoTrack: true,
      id: mix.id,
      title: mix.title,
      description: mix.description
    });
  }

  // Handle range requests for better streaming
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : mix.buffer.length - 1;
    const chunkSize = (end - start) + 1;

    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${mix.buffer.length}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mix.mimetype
    });

    // Create a slice of the buffer
    const bufferSlice = mix.buffer.slice(start, end + 1);
    res.send(bufferSlice);
  } else {
    // Send the entire file if no range is requested
    res.set({
      'Content-Type': mix.mimetype,
      'Content-Length': mix.buffer.length,
      'Accept-Ranges': 'bytes'
    });
    res.send(mix.buffer);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Upload and stream music at http://localhost:3000`);
});
