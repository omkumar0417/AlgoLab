/**
 * GET  /api/history        — fetch last 50 runs
 * POST /api/history        — save a run
 * DELETE /api/history/:id  — delete a run
 */

const express = require('express');
const router  = express.Router();
const { connectDB } = require('../db');
const { ObjectId } = require('mongodb');
const { requireAuth } = require('./middleware/auth');

// GET history
router.get('/', requireAuth, async (req, res) => {
  const db = await connectDB();
  if (!db) return res.json({ history: [], source: 'none' });

  try {
    const history = await db.collection('history')
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ history, source: 'mongodb' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — save history entry
router.post('/', requireAuth, async (req, res) => {
  const db = await connectDB();
  if (!db) return res.json({ saved: false, reason: 'DB not connected' });

  try {
    const entry = {
      ...req.body,
      userId: req.user.userId,
      createdAt: new Date(),
    };
    const result = await db.collection('history').insertOne(entry);
    res.json({ saved: true, entry: { ...entry, _id: result.insertedId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — clear logged-in user's history
router.delete('/', requireAuth, async (req, res) => {
  const db = await connectDB();
  if (!db) return res.json({ deleted: false });

  try {
    await db.collection('history').deleteMany({ userId: req.user.userId });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — remove one entry
router.delete('/:id', requireAuth, async (req, res) => {
  const db = await connectDB();
  if (!db) return res.json({ deleted: false });

  try {
    await db.collection('history').deleteOne({ _id: new ObjectId(req.params.id), userId: req.user.userId });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
