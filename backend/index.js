// backend/index.js
const express = require('express');
const cors = require('cors');
const mixesRoutes = require('./routes/mixes');

const app = express();
app.use(cors());
app.use(express.json());

// Use mixes routes
app.use('/api/mixes', mixesRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
