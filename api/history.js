/**
 * GET  /api/history        — fetch last 50 runs
 * POST /api/history        — save a run
 * DELETE /api/history/:id  — delete a run
 */

const express = require('express');
const router  = express.Router();
const { connectDB } = require('../db');
const { ObjectId } = require('mongodb');

// GET history
router.get('/', async (req, res) => {
  const db = await connectDB();
  if (!db) return res.json({ history: [], source: 'none' });

  try {
    const history = await db.collection('history')
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json({ history, source: 'mongodb' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — save history entry
router.post('/', async (req, res) => {
  const db = await connectDB();
  if (!db) return res.json({ saved: false, reason: 'DB not connected' });

  try {
    const entry = {
      ...req.body,
      createdAt: new Date(),
    };
    const result = await db.collection('history').insertOne(entry);
    res.json({ saved: true, id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — remove one entry
router.delete('/:id', async (req, res) => {
  const db = await connectDB();
  if (!db) return res.json({ deleted: false });

  try {
    await db.collection('history').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
