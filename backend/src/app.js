require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/trips', require('./routes/trips'));
app.use('/images', require('./routes/images'));

// Root
app.get('/', (req, res) => {
    res.json({message: 'CoTravel API running', version: '1.0.0'});
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
