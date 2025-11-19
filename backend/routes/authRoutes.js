const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const authMiddleware = require('../middleware/auth');

router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await userService.registerUser({ name, email, password });
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

module.exports = router;
