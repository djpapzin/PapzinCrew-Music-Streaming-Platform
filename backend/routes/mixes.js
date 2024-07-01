// backend/routes/mixes.js
const express = require('express');
const router = express.Router();
const { upload, mixes } = require('../cloudinaryConfig');

// Endpoint to upload a mix
router.post('/', upload.single('file'), (req, res) => {
  const { title, description } = req.body;
  const file = req.file;

  if (!title || !description || !file) {
    return res.status(400).send('All fields are required');
  }

  const mix = {
    id: mixes.length + 1,
    title,
    description,
    url: file.path, // URL from Cloudinary
  };

  mixes.push(mix);
  res.status(201).json(mix);
});

// Endpoint to retrieve all mixes
router.get('/', (req, res) => {
  res.json(mixes);
});

module.exports = router;
