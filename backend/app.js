const express = require('express');
const multer = require('multer');
const app = express();
const port = 5000;

// Set up memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Enable CORS for local development
const cors = require('cors');
app.use(cors());

// Endpoint to handle file uploads
app.post('/api/mixes', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  console.log(req.file);

  // For now, we will simply log the file object to the console
  // In a real application, you would save the file to disk or a cloud storage service

  res.send('File uploaded successfully.');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
