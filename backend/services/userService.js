const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

class UserService {
    constructor() {
        this.dbClient = null;
        this.dbName = process.env.MONGODB_NAME || 'caption_generator';
        this.collectionName = 'users';
        this.jwtSecret = process.env.JWT_SECRET || process.env.AUTH_SECRET || 'local-dev-secret';
        this.connectionOptions = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        };
        this.initializing = null;
    }

    async _initializeConnection() {
        if (this.dbClient) {
            return;
        }

        if (this.initializing) {
            await this.initializing;
            return;
        }

        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not configured');
        }

        this.initializing = (async () => {
            try {
                this.dbClient = new MongoClient(process.env.MONGODB_URI, this.connectionOptions);
                await this.dbClient.connect();
                logger.info('Connected to MongoDB for user service');
                await this._setupIndexes();
            } catch (error) {
                logger.error('Failed to initialize user service MongoDB connection:', error);
                this.dbClient = null;
                throw error;
            } finally {
                this.initializing = null;
            }
        })();

        await this.initializing;
    }

    async _setupIndexes() {
        const db = this.getDb();
        await db.collection(this.collectionName).createIndex({ email: 1 }, { unique: true });
    }

    getDb() {
        if (!this.dbClient) {
            throw new Error('MongoDB client not initialized for user service');
        }
        return this.dbClient.db(this.dbName);
    }

    _sanitizeUser(user) {
        if (!user) {
            return null;
        }

        // Support both old (name) and new (firstName/lastName) formats
        const firstName = user.firstName || (user.name ? this._splitName(user.name).firstName : '');
        const lastName = user.lastName || (user.name ? this._splitName(user.name).lastName : '');
        const fullName = user.fullName || this._computeFullName(firstName, lastName) || user.name || '';

        return {
            id: user._id ? user._id.toString() : user.id,
            firstName,
            lastName,
            fullName,
            email: user.email,
            photoUrl: user.photoUrl || null,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
        };
    }

    _splitName(name) {
        if (!name || typeof name !== 'string') {
            return { firstName: '', lastName: '' };
        }

        const trimmed = name.trim();
        if (trimmed.length === 0) {
            return { firstName: '', lastName: '' };
        }

        // Split by last space
        const lastSpaceIndex = trimmed.lastIndexOf(' ');
        if (lastSpaceIndex === -1) {
            // Single word - treat as firstName
            return { firstName: trimmed, lastName: '' };
        }

        return {
            firstName: trimmed.substring(0, lastSpaceIndex).trim(),
            lastName: trimmed.substring(lastSpaceIndex + 1).trim()
        };
    }

    _computeFullName(firstName, lastName) {
        const first = (firstName || '').trim();
        const last = (lastName || '').trim();
        if (first && last) {
            return `${first} ${last}`.trim();
        }
        return first || last || '';
    }

    _validateEmail(email) {
        const normalized = (email || '').trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!normalized || !emailRegex.test(normalized)) {
            throw new Error('A valid email address is required');
        }
        return normalized;
    }

    _validatePassword(password) {
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        return password;
    }

    _validatePhotoUrl(photoUrl) {
        if (!photoUrl) return null;
        const trimmed = photoUrl.trim();
        if (trimmed.length === 0) return null;

        try {
            const url = new URL(trimmed);
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Photo URL must start with http or https');
            }
            if (trimmed.length > 1024) {
                throw new Error('Photo URL is too long');
            }
            return trimmed;
        } catch (error) {
            throw new Error('A valid photo URL is required');
        }
    }

    _hashPassword(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto
            .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
            .toString('hex');
        return `${salt}:${hash}`;
    }

    _verifyPassword(password, storedHash) {
        if (!storedHash || !storedHash.includes(':')) {
            return false;
        }

        const [salt, originalHash] = storedHash.split(':');
        const hash = crypto
            .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
            .toString('hex');

        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
    }

    _base64UrlEncode(input) {
        return Buffer.from(input)
            .toString('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');
    }

    _base64UrlDecode(input) {
        const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        return Buffer.from(padded, 'base64').toString();
    }

    _buildToken(payload, expiresInSeconds = 60 * 60 * 24 * 7) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const issuedAt = Math.floor(Date.now() / 1000);
        const tokenPayload = {
            ...payload,
            iat: issuedAt,
            exp: issuedAt + expiresInSeconds
        };

        const headerEncoded = this._base64UrlEncode(JSON.stringify(header));
        const payloadEncoded = this._base64UrlEncode(JSON.stringify(tokenPayload));

        const signature = crypto
            .createHmac('sha256', this.jwtSecret)
            .update(`${headerEncoded}.${payloadEncoded}`)
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

        return `${headerEncoded}.${payloadEncoded}.${signature}`;
    }

    _verifyTokenSignature(token) {
        const [headerEncoded, payloadEncoded, signature] = token.split('.');
        if (!headerEncoded || !payloadEncoded || !signature) {
            throw new Error('Invalid token');
        }

        const expectedSignature = crypto
            .createHmac('sha256', this.jwtSecret)
            .update(`${headerEncoded}.${payloadEncoded}`)
            .digest('base64')
            .replace(/=/g, '')
            .replace(/\+/g, '-')
            .replace(/\//g, '_');

        const expectedBuffer = Buffer.from(expectedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        const actualBuffer = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

        if (
            expectedBuffer.length !== actualBuffer.length ||
            !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
        ) {
            throw new Error('Invalid token signature');
        }

        const payloadJson = this._base64UrlDecode(payloadEncoded);
        return JSON.parse(payloadJson);
    }

    async registerUser({ firstName, lastName, email, password, photoUrl }) {
        await this._initializeConnection();
        const db = this.getDb();
        const collection = db.collection(this.collectionName);

        const sanitizedEmail = this._validateEmail(email);
        const sanitizedFirstName = (firstName || '').trim();
        const sanitizedLastName = (lastName || '').trim();
        const sanitizedPhotoUrl = this._validatePhotoUrl(photoUrl);
        this._validatePassword(password);

        const existing = await collection.findOne({ email: sanitizedEmail });
        if (existing) {
            throw new Error('An account with this email already exists');
        }

        const now = new Date();
        const fullName = this._computeFullName(sanitizedFirstName || 'New', sanitizedLastName || '');
        const user = {
            firstName: sanitizedFirstName || 'New',
            lastName: sanitizedLastName || '',
            fullName: fullName || 'New User',
            name: fullName || 'New User', // Keep name for backward compatibility
            email: sanitizedEmail,
            photoUrl: sanitizedPhotoUrl || null,
            passwordHash: this._hashPassword(password),
            createdAt: now,
            lastLoginAt: null
        };

        const result = await collection.insertOne(user);
        logger.info(`Created new user with ID ${result.insertedId.toString()}`);

        return this._sanitizeUser({ ...user, _id: result.insertedId });
    }

    async authenticateUser(email, password) {
        await this._initializeConnection();
        const db = this.getDb();
        const collection = db.collection(this.collectionName);

        const sanitizedEmail = this._validateEmail(email);
        this._validatePassword(password);

        const user = await collection.findOne({ email: sanitizedEmail });
        if (!user || !this._verifyPassword(password, user.passwordHash)) {
            return null;
        }

        return this._sanitizeUser(user);
    }

    async markLastLogin(userId) {
        await this._initializeConnection();
        const db = this.getDb();
        const collection = db.collection(this.collectionName);

        if (!ObjectId.isValid(userId)) {
            return;
        }

        await collection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { lastLoginAt: new Date() } }
        );
    }

    async findUserById(userId) {
        await this._initializeConnection();
        const db = this.getDb();
        const collection = db.collection(this.collectionName);

        if (!ObjectId.isValid(userId)) {
            return null;
        }

        const user = await collection.findOne({ _id: new ObjectId(userId) });
        return this._sanitizeUser(user);
    }

    generateToken(user) {
        const fullName = user.fullName || this._computeFullName(user.firstName || '', user.lastName || '') || user.name || '';

        return this._buildToken({
            userId: user.id,
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            fullName: fullName,
            name: fullName, // Keep for backward compatibility
            photoUrl: user.photoUrl || null
        });
    }

    async updateProfile(userId, updates = {}) {
        await this._initializeConnection();
        const db = this.getDb();
        const collection = db.collection(this.collectionName);

        const logger = require('../utils/logger');

        logger.debug('updateProfile called', {
            userId,
            userIdType: typeof userId,
            hasEmail: !!updates.email,
            updateKeys: Object.keys(updates)
        });

        // Check if userId is a valid ObjectId
        const isValidObjectId = ObjectId.isValid(userId);
        logger.debug('User ID validation', { userId, isValidObjectId });

        // First, verify the user exists before trying to update
        let existingUser = null;
        if (isValidObjectId) {
            existingUser = await collection.findOne({ _id: new ObjectId(userId) });
            logger.debug('User existence check by _id', {
                found: !!existingUser,
                userId,
                foundUserId: existingUser?._id?.toString()
            });
        }

        const updateDoc = {};

        // Handle firstName
        if (typeof updates.firstName === 'string') {
            const trimmed = updates.firstName.trim();
            updateDoc.firstName = trimmed;
            // Compute fullName
            const lastName = updates.lastName !== undefined
                ? (updates.lastName || '')
                : (existingUser?.lastName || '');
            updateDoc.fullName = this._computeFullName(trimmed, lastName);
            updateDoc.name = updateDoc.fullName; // Keep name for backward compatibility
        }

        // Handle lastName
        if (typeof updates.lastName === 'string') {
            const trimmed = updates.lastName.trim();
            updateDoc.lastName = trimmed;
            // Compute fullName
            const firstName = updates.firstName !== undefined
                ? (updates.firstName || '')
                : (existingUser?.firstName || updateDoc.firstName || '');
            updateDoc.fullName = this._computeFullName(firstName, trimmed);
            updateDoc.name = updateDoc.fullName; // Keep name for backward compatibility
        }

        // Handle legacy name field (for backward compatibility during migration)
        if (typeof updates.name === 'string' && !updates.firstName && !updates.lastName) {
            const trimmed = updates.name.trim();
            if (trimmed.length === 0) {
                throw new Error('Name cannot be empty');
            }
            const split = this._splitName(trimmed);
            updateDoc.firstName = split.firstName;
            updateDoc.lastName = split.lastName;
            updateDoc.fullName = this._computeFullName(split.firstName, split.lastName);
            updateDoc.name = trimmed;
        }

        if (typeof updates.email === 'string' && updates.email !== '') {
            updateDoc.email = this._validateEmail(updates.email);
        }

        if (typeof updates.photoUrl === 'string') {
            const sanitizedPhoto = this._validatePhotoUrl(updates.photoUrl);
            updateDoc.photoUrl = sanitizedPhoto;
        }

        if (typeof updates.password === 'string' && updates.password.length > 0) {
            this._validatePassword(updates.password);
            updateDoc.passwordHash = this._hashPassword(updates.password);
        }

        if (Object.keys(updateDoc).length === 0) {
            throw new Error('No updates provided');
        }

        // If not found by _id, try by email (case-insensitive)
        if (!existingUser && updateDoc.email) {
            existingUser = await collection.findOne({
                email: { $regex: new RegExp(`^${updateDoc.email}$`, 'i') }
            });
            logger.debug('User existence check by email', {
                found: !!existingUser,
                email: updateDoc.email,
                foundEmail: existingUser?.email,
                foundUserId: existingUser?._id?.toString()
            });
        }

        // If user still not found, throw error
        if (!existingUser) {
            // Try to find any user with similar email for debugging
            let similarUsers = [];
            if (updateDoc.email) {
                try {
                    const emailPrefix = updateDoc.email.split('@')[0];
                    similarUsers = await collection.find({
                        email: { $regex: emailPrefix, $options: 'i' }
                    }).limit(3).toArray();
                    similarUsers = similarUsers.map(u => ({
                        id: u._id.toString(),
                        email: u.email
                    }));
                } catch (debugError) {
                    // Ignore debug query errors
                }
            }

            logger.error('User not found in database', {
                userId,
                isValidObjectId,
                email: updateDoc.email,
                similarUsers
            });
            throw new Error('User not found');
        }

        // Now perform the update - use the found user's _id
        const updateFilter = { _id: existingUser._id };

        // Perform the update
        await collection.updateOne(
            updateFilter,
            { $set: updateDoc }
        );

        // Fetch the updated user
        const updatedUser = await collection.findOne({ _id: existingUser._id });

        logger.debug('Update result', {
            found: !!updatedUser,
            updatedUserId: updatedUser?._id?.toString(),
            updatedFields: updatedUser ? Object.keys(updateDoc) : []
        });

        // If update didn't return a document, something went wrong
        if (!updatedUser) {
            logger.error('Update operation failed - user not found after update', {
                userId,
                existingUserId: existingUser._id.toString(),
                updateDoc
            });
            throw new Error('Failed to update user profile');
        }

        return this._sanitizeUser(updatedUser);
    }

    async verifyToken(token) {
        const logger = require('../utils/logger');
        const payload = this._verifyTokenSignature(token);

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            throw new Error('Token has expired');
        }

        logger.debug('verifyToken - looking up user', {
            userIdFromToken: payload.userId,
            emailFromToken: payload.email
        });

        const user = await this.findUserById(payload.userId);
        if (!user) {
            logger.error('User not found in verifyToken', {
                userIdFromToken: payload.userId,
                emailFromToken: payload.email
            });
            throw new Error('User not found');
        }

        logger.debug('verifyToken - user found', {
            userId: user.id,
            email: user.email
        });

        return user;
    }
}

module.exports = new UserService();
