const userService = require('../services/userService');
const logger = require('../utils/logger');

module.exports = async function authMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    try {
        const user = await userService.verifyToken(token);
        req.user = user;
        req.authToken = token;
        next();
    } catch (error) {
        logger.warn('Authentication failed', { error: error.message });
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};
