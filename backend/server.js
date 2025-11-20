const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');

dotenv.config();

const app = express();

const corsOptions = {
    origin: [
        "https://captionmuse.adityagusain.com",
        "https://instagram-caption-generator-shantanudwvds-projects.vercel.app",
        "http://localhost:3000", // Replace with your Vercel frontend URL
    ],
    methods: "GET,POST,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// Middleware
app.use(express.json());

// Request logging middleware (should be early in the middleware chain)
app.use(requestLogger);

// Apply routes
routes(app);

// Error handling middleware (should be after routes)
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        requestId: req.requestId,
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl || req.url,
        userId: req.user?.id || 'anonymous'
    });

    // Don't leak error details in production
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    logger.warn('Route not found', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl || req.url
    });
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
});