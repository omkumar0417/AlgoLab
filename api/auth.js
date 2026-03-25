/**
 * Simple Auth Routes (Login + Signup)
 * Stores users in MongoDB Atlas: { userId, passwordHash, createdAt }
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB } = require('../db');
const { requireAuth, isAdminUser } = require('./middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function normalizeUserId(userId) {
  return String(userId || '').trim();
}

function getExpiryDate(token) {
  const decoded = jwt.decode(token);
  return decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;
}

router.post('/signup', async (req, res) => {
  try {
    const userId = normalizeUserId(req.body?.userId);
    const password = String(req.body?.password || '').trim();

    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'userId and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'password must be at least 6 characters' });
    }

    const db = await connectDB();
    if (!db) return res.status(500).json({ success: false, message: 'database not configured' });

    const users = db.collection('users');
    const existing = await users.findOne({ userId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'userId already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await users.insertOne({ userId, passwordHash, createdAt: new Date() });

    return res.json({ success: true, message: 'signup successful' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const userId = normalizeUserId(req.body?.userId);
    const password = String(req.body?.password || '').trim();

    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'userId and password are required' });
    }

    const db = await connectDB();
    if (!db) return res.status(500).json({ success: false, message: 'database not configured' });

    const users = db.collection('users');
    const user = await users.findOne({ userId });
    if (!user) {
      return res.status(401).json({ success: false, message: 'invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'invalid credentials' });
    }

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    await users.updateOne(
      { userId },
      { $set: { lastLoginAt: new Date() } }
    );
    return res.json({ success: true, token, userId, expiresAt: getExpiryDate(token), isAdmin: isAdminUser(userId) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'login failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const userId = normalizeUserId(req.body?.userId);
    const password = String(req.body?.password || '').trim();

    if (!userId || !password) {
      return res.status(400).json({ success: false, message: 'userId and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'password must be at least 6 characters' });
    }

    const db = await connectDB();
    if (!db) return res.status(500).json({ success: false, message: 'database not configured' });

    const users = db.collection('users');
    const existing = await users.findOne({ userId });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'user not found' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await users.updateOne(
      { userId },
      { $set: { passwordHash, passwordResetAt: new Date() } }
    );

    return res.json({ success: true, message: 'password reset successful' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'password reset failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    if (!db) return res.status(500).json({ success: false, message: 'database not configured' });

    const user = await db.collection('users').findOne(
      { userId: req.user.userId },
      { projection: { passwordHash: 0 } }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'user not found' });
    }

    return res.json({ success: true, user: { ...user, isAdmin: isAdminUser(user.userId) } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'session check failed' });
  }
});

module.exports = router;
