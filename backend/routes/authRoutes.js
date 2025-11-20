const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const profileUploadDir = path.join(process.cwd(), 'uploads', 'profile_photos');
if (!fs.existsSync(profileUploadDir)) {
    fs.mkdirSync(profileUploadDir, { recursive: true });
}

const upload = multer({
    dest: profileUploadDir,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image uploads are allowed'));
        }
        cb(null, true);
    }
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, password, photoUrl } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await userService.registerUser({ name, email, password, photoUrl });
        const token = userService.generateToken(user);

        res.status(201).json({ user, token });
    } catch (error) {
        const status = error.message.includes('exists') ? 409 : 400;
        res.status(status).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await userService.authenticateUser(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        await userService.markLastLogin(user.id);
        const token = userService.generateToken(user);

        res.json({ user, token });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});

router.put('/me', authMiddleware, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const updatedUser = await userService.updateProfile(req.user.id, {
            name,
            email,
            password
        });

        const token = userService.generateToken(updatedUser);

        res.json({ user: updatedUser, token });
    } catch (error) {
        const status = error.message.includes('exists') ? 409 : 400;
        res.status(status).json({ error: error.message });
    }
});

// Upload and attach profile photo
router.post('/photo', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Photo file is required' });
        }

        // Debug logging
        if (!req.user) {
            logger.error('No user found in request', { 
                hasAuthHeader: !!req.headers.authorization,
                method: req.method,
                path: req.path 
            });
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const userId = req.user.id || req.user._id;
        if (!userId) {
            logger.error('User ID not found in req.user', { 
                userKeys: Object.keys(req.user),
                user: req.user 
            });
            return res.status(400).json({ error: 'User ID not found' });
        }

        logger.debug('Uploading profile photo', { 
            userId,
            email: req.user.email,
            hasFile: !!req.file 
        });

        const photoUrl = `${req.protocol}://${req.get('host')}/uploads/profile_photos/${req.file.filename}`;
        
        const updatedUser = await userService.updateProfile(userId, {
            photoUrl,
            email: req.user.email // fallback lookup by email if needed
        });
        
        const token = userService.generateToken(updatedUser);

        logger.info('Profile photo uploaded successfully', { userId });
        res.json({ user: updatedUser, token, photoUrl });
    } catch (error) {
        logger.error('Error uploading profile photo', { 
            error: error.message,
            stack: error.stack,
            userId: req.user?.id || req.user?._id,
            userEmail: req.user?.email
        });
        
        const status = error.message.includes('image') || error.message.includes('User not found') || error.message.includes('Invalid user ID') ? 400 : 500;
        res.status(status).json({ error: error.message || 'Failed to upload photo' });
    }
});

module.exports = router;
