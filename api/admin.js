const express = require('express');
const { connectDB } = require('../db');
const { requireAuth } = require('./middleware/auth');

const router = express.Router();

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    if (!db) return res.status(500).json({ success: false, message: 'database not configured' });

    const [totalUsers, totalHistory, latestRuns] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('history').countDocuments(),
      db.collection('history').find({}).sort({ createdAt: -1 }).limit(200).toArray(),
    ]);

    const algorithmCounts = {};
    const categoryCounts = {};

    latestRuns.forEach(entry => {
      algorithmCounts[entry.algo] = (algorithmCounts[entry.algo] || 0) + 1;
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
    });

    const mostRunAlgorithms = Object.entries(algorithmCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const commonProblemTypes = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalRuns: totalHistory,
        mostRunAlgorithms,
        commonProblemTypes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'analytics failed' });
  }
});

module.exports = router;
