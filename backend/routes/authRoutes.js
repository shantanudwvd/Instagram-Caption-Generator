const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { uploadImage, deleteImage, extractPublicId } = require('../utils/cloudinary');

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
        const { firstName, lastName, name, email, password, photoUrl } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Support both new format (firstName/lastName) and legacy format (name)
        let firstNameValue = firstName;
        let lastNameValue = lastName;

        // If name is provided but firstName/lastName are not, split the name
        if (name && firstName === undefined && lastName === undefined) {
            const trimmed = (name || '').trim();
            if (trimmed.length > 0) {
                const lastSpaceIndex = trimmed.lastIndexOf(' ');
                if (lastSpaceIndex === -1) {
                    firstNameValue = trimmed;
                    lastNameValue = '';
                } else {
                    firstNameValue = trimmed.substring(0, lastSpaceIndex).trim();
                    lastNameValue = trimmed.substring(lastSpaceIndex + 1).trim();
                }
            }
        }

        const user = await userService.registerUser({
            firstName: firstNameValue,
            lastName: lastNameValue,
            email,
            password,
            photoUrl
        });
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
        const { firstName, lastName, name, email, password } = req.body;

        const updates = {};

        // Support both new format (firstName/lastName) and legacy format (name)
        if (firstName !== undefined || lastName !== undefined) {
            if (firstName !== undefined) updates.firstName = firstName;
            if (lastName !== undefined) updates.lastName = lastName;
        } else if (name !== undefined) {
            updates.name = name; // Legacy support
        }

        if (email !== undefined) updates.email = email;
        if (password !== undefined) updates.password = password;

        const updatedUser = await userService.updateProfile(req.user.id, updates);

        const token = userService.generateToken(updatedUser);

        res.json({ user: updatedUser, token });
    } catch (error) {
        const status = error.message.includes('exists') ? 409 : 400;
        res.status(status).json({ error: error.message });
    }
});

// Upload and attach profile photo
router.post('/photo', authMiddleware, upload.single('photo'), async (req, res) => {
    let tempFilePath = null;

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

        tempFilePath = req.file.path;

        // Get current user to check for existing photo
        const currentUser = await userService.findUserById(userId);
        const oldPhotoUrl = currentUser?.photoUrl;

        // Upload to Cloudinary if configured, otherwise fall back to local storage
        let photoUrl;
        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            try {
                // Upload to Cloudinary
                const uploadResult = await uploadImage(tempFilePath, 'profile_photos', `profile_${userId}`);
                photoUrl = uploadResult.url;

                // Delete old photo from Cloudinary if it exists
                if (oldPhotoUrl && oldPhotoUrl.includes('cloudinary.com')) {
                    const oldPublicId = extractPublicId(oldPhotoUrl);
                    if (oldPublicId) {
                        try {
                            await deleteImage(oldPublicId);
                            logger.info('Deleted old profile photo from Cloudinary', { userId, oldPublicId });
                        } catch (deleteError) {
                            logger.warn('Failed to delete old profile photo from Cloudinary', {
                                userId,
                                oldPublicId,
                                error: deleteError.message
                            });
                            // Don't fail the upload if deletion fails
                        }
                    }
                }
            } catch (cloudinaryError) {
                logger.error('Cloudinary upload failed, falling back to local storage', {
                    error: cloudinaryError.message,
                    userId
                });
                // Fall back to local storage
                photoUrl = `${req.protocol}://${req.get('host')}/uploads/profile_photos/${req.file.filename}`;
            }
        } else {
            // Use local storage if Cloudinary is not configured
            logger.warn('Cloudinary not configured, using local storage', { userId });
            photoUrl = `${req.protocol}://${req.get('host')}/uploads/profile_photos/${req.file.filename}`;
        }

        const updatedUser = await userService.updateProfile(userId, {
            photoUrl,
            email: req.user.email // fallback lookup by email if needed
        });

        const token = userService.generateToken(updatedUser);

        // Clean up temporary file if uploaded to Cloudinary
        if (photoUrl.includes('cloudinary.com') && tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                logger.debug('Cleaned up temporary file', { tempFilePath });
            } catch (cleanupError) {
                logger.warn('Failed to clean up temporary file', {
                    tempFilePath,
                    error: cleanupError.message
                });
            }
        }

        logger.info('Profile photo uploaded successfully', { userId, photoUrl });
        res.json({ user: updatedUser, token, photoUrl });
    } catch (error) {
        // Clean up temporary file on error
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                logger.warn('Failed to clean up temporary file on error', {
                    tempFilePath,
                    error: cleanupError.message
                });
            }
        }

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
