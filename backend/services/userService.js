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

        return {
            id: user._id ? user._id.toString() : user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt
        };
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

    async registerUser({ name, email, password }) {
        await this._initializeConnection();
        const db = this.getDb();
        const collection = db.collection(this.collectionName);

        const sanitizedEmail = this._validateEmail(email);
        const sanitizedName = (name || '').trim();
        this._validatePassword(password);

        const existing = await collection.findOne({ email: sanitizedEmail });
        if (existing) {
            throw new Error('An account with this email already exists');
        }

        const now = new Date();
        const user = {
            name: sanitizedName || 'New User',
            email: sanitizedEmail,
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
        return this._buildToken({
            userId: user.id,
            email: user.email,
            name: user.name
        });
    }

    async updateProfile(userId, updates = {}) {
        await this._initializeConnection();
        const db = this.getDb();
        const collection = db.collection(this.collectionName);

        if (!ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID');
        }

        const updateDoc = {};

        if (typeof updates.name === 'string') {
            const trimmed = updates.name.trim();
            if (trimmed.length === 0) {
                throw new Error('Name cannot be empty');
            }
            updateDoc.name = trimmed;
        }

        if (typeof updates.email === 'string' && updates.email !== '') {
            updateDoc.email = this._validateEmail(updates.email);
        }

        if (typeof updates.password === 'string' && updates.password.length > 0) {
            this._validatePassword(updates.password);
            updateDoc.passwordHash = this._hashPassword(updates.password);
        }

        if (Object.keys(updateDoc).length === 0) {
            throw new Error('No updates provided');
        }

        const result = await collection.findOneAndUpdate(
            { _id: new ObjectId(userId) },
            { $set: updateDoc },
            { returnDocument: 'after' }
        );

        if (!result.value) {
            throw new Error('User not found');
        }

        return this._sanitizeUser(result.value);
    }

    async verifyToken(token) {
        const payload = this._verifyTokenSignature(token);

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            throw new Error('Token has expired');
        }

        const user = await this.findUserById(payload.userId);
        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }
}

module.exports = new UserService();
