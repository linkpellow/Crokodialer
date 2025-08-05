"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '24h' });
};
// Register
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const exists = await User_1.default.findOne({ email });
        if (exists) {
            return res.status(409).json({ error: 'User already exists' });
        }
        const user = new User_1.default({ email, password });
        await user.save();
        const token = generateToken({ userId: user._id.toString(), email: user.email });
        return res.status(201).json({ token, user: { id: user._id, email: user.email } });
    }
    catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Registration failed' });
    }
});
// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const user = await User_1.default.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = generateToken({ userId: user._id.toString(), email: user.email });
        return res.json({ token, user: { id: user._id, email: user.email } });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
});
// Validate token
router.get('/validate', auth_1.authenticate, async (req, res) => {
    try {
        const user = await User_1.default.findById(req.user.userId).select('-password').lean();
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        return res.json({ user });
    }
    catch (error) {
        console.error('Token validation error:', error);
        return res.status(500).json({ error: 'Token validation failed' });
    }
});
exports.default = router;
