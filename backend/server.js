const express = require('express');
const multer = require('multer');
const cors = require('cors');
const app = express();
const port = 5000;

// Set up memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Enable CORS for local development
app.use(cors());
app.use(express.json());

// In-memory store for mixes
const mixes = [];

// Endpoint to handle file uploads
app.post('/api/mixes', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const mix = {
    id: mixes.length + 1,
    title: req.body.title,
    description: req.body.description,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    buffer: req.file.buffer,
    size: req.file.size,
  };

  mixes.push(mix);

  res.send('File uploaded successfully.');
});

// Endpoint to fetch mixes
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
    return res.status(404).send('Mix not found.');
  }

  res.set('Content-Type', mix.mimetype);
  res.send(mix.buffer);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
