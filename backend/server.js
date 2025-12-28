const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const routes = require('./routes');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();

// CORS configuration - allows frontend origins to access the backend
const getAllowedOrigins = () => {
    const origins = [
        "https://www.captionmuse.shop",
        "https://instagram-caption-generator-shantanudwvds-projects.vercel.app",
        "http://localhost:3000", // Frontend development URL
    ];

    // Add origins from environment variable if provided (comma-separated)
    // Example: CORS_ORIGINS=https://myapp.vercel.app,https://myapp.netlify.app
    if (process.env.CORS_ORIGINS) {
        const envOrigins = process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean);
        origins.push(...envOrigins);
        logger.info('Added CORS origins from environment', { envOrigins });
    }

    // Add common Vercel pattern if FRONTEND_URL is set
    if (process.env.FRONTEND_URL) {
        origins.push(process.env.FRONTEND_URL);
        // Also add without trailing slash
        if (process.env.FRONTEND_URL.endsWith('/')) {
            origins.push(process.env.FRONTEND_URL.slice(0, -1));
        } else {
            origins.push(process.env.FRONTEND_URL + '/');
        }
    }

    // Remove duplicates
    return [...new Set(origins)];
};

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }

        const allowedOrigins = getAllowedOrigins();

        // Normalize origin (remove trailing slash, lowercase for comparison)
        const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');
        const normalizedAllowed = allowedOrigins.map(o => o.toLowerCase().replace(/\/$/, ''));

        // Check if origin is in allowed list (case-insensitive)
        if (normalizedAllowed.indexOf(normalizedOrigin) !== -1) {
            logger.debug('CORS allowed origin (exact match)', { origin, normalizedOrigin });
            return callback(null, true);
        }

        // Allow Vercel preview deployments (*.vercel.app)
        if (origin.includes('.vercel.app')) {
            logger.debug('CORS allowed Vercel origin', { origin });
            return callback(null, true);
        }

        // Allow Netlify deployments (*.netlify.app)
        if (origin.includes('.netlify.app')) {
            logger.debug('CORS allowed Netlify origin', { origin });
            return callback(null, true);
        }

        // In development, allow localhost origins
        if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
            logger.debug('CORS allowed localhost origin (dev)', { origin });
            return callback(null, true);
        }

        logger.warn('CORS blocked origin', {
            origin,
            normalizedOrigin,
            allowedOrigins,
            normalizedAllowed
        });
        callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// Middleware
app.use(express.json());

// Request logging middleware (should be early in the middleware chain)
app.use(requestLogger);

// Health check endpoint for Docker/ECS
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Serve uploaded assets
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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
app.listen(PORT, '0.0.0.0', () => {
    logger.info('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
});
