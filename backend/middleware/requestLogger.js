const logger = require('../utils/logger');

/**
 * Request logging middleware
 * Logs incoming requests with method, URL, IP, and response time
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    // Add request ID to request object for tracking
    req.requestId = requestId;

    // Log request start
    logger.debug('Incoming request', {
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        userId: req.user?.id || 'anonymous'
    });

    // Capture response finish event
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            requestId,
            method: req.method,
            url: req.originalUrl || req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userId: req.user?.id || 'anonymous'
        };

        // Log based on status code
        if (res.statusCode >= 500) {
            logger.error('Request failed', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Request error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};

module.exports = requestLogger;
