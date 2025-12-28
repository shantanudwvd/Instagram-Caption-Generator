// utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

const isDevelopment = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Determine log level based on environment
const getLogLevel = () => {
    if (process.env.LOG_LEVEL) {
        return process.env.LOG_LEVEL;
    }
    return isDevelopment ? 'debug' : 'info';
};

// JSON format for file logs (production-friendly)
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Pretty console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;

        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            // Filter out internal winston properties
            const cleanMeta = Object.keys(meta)
                .filter(key => !key.startsWith('Symbol('))
                .reduce((obj, key) => {
                    obj[key] = meta[key];
                    return obj;
                }, {});

            if (Object.keys(cleanMeta).length > 0) {
                log += ` ${JSON.stringify(cleanMeta, null, 2)}`;
            }
        }

        return log;
    })
);

// Create transports array
const transports = [];

// File transports for all environments
transports.push(
    // Combined log file - all logs
    new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: jsonFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
    }),
    // Error log file - errors only
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: jsonFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
    })
);

// Console transport for development
if (isDevelopment) {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat,
            level: 'debug'
        })
    );
} else if (isProduction) {
    // In production, also log to console but in JSON format
    transports.push(
        new winston.transports.Console({
            format: jsonFormat,
            level: 'info'
        })
    );
}

// Create the logger
const logger = winston.createLogger({
    level: getLogLevel(),
    defaultMeta: {
        service: 'caption-generator',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: transports,
    // Handle exceptions and rejections
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: jsonFormat
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: jsonFormat
        })
    ],
    // Exit on error set to false to prevent winston from exiting the process
    exitOnError: false
});

// Log startup message
logger.info('Logger initialized', {
    environment: process.env.NODE_ENV || 'development',
    logLevel: getLogLevel()
});

module.exports = logger;
