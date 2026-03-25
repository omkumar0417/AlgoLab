const express = require('express');
const { connectDB } = require('../db');
const { requireAuth, requireAdmin } = require('./middleware/auth');

const router = express.Router();

router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = await connectDB();
    if (!db) return res.status(500).json({ success: false, message: 'database not configured' });

    const [users, totalUsers, totalHistory, latestRuns] = await Promise.all([
      db.collection('users').find({}, { projection: { userId: 1, displayName: 1, lastLoginAt: 1, createdAt: 1 } }).toArray(),
      db.collection('users').countDocuments(),
      db.collection('history').countDocuments(),
      db.collection('history').find({}).sort({ createdAt: -1 }).limit(250).toArray(),
    ]);

    const algorithmCounts = {};
    const categoryCounts = {};
    const userCounts = {};
    const comparerCounts = {};
    const dailyCounts = {};
    const signupCounts = {};
    const activityMix = { comparison: 0, normal: 0 };
    const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);

    latestRuns.forEach(entry => {
      algorithmCounts[entry.algo] = (algorithmCounts[entry.algo] || 0) + 1;
      categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
      userCounts[entry.userId] = (userCounts[entry.userId] || 0) + 1;
      if (entry.comparison) {
        comparerCounts[entry.userId] = (comparerCounts[entry.userId] || 0) + 1;
        activityMix.comparison += 1;
      } else {
        activityMix.normal += 1;
      }

      const key = entry.createdAt ? new Date(entry.createdAt).toISOString().slice(0, 10) : 'unknown';
      dailyCounts[key] = (dailyCounts[key] || 0) + 1;
    });

    users.forEach(user => {
      const key = user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : 'unknown';
      signupCounts[key] = (signupCounts[key] || 0) + 1;
    });

    const userLookup = users.reduce((acc, user) => {
      acc[user.userId] = user;
      return acc;
    }, {});

    const mostRunAlgorithms = Object.entries(algorithmCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const commonProblemTypes = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => {
        const user = userLookup[userId] || {};
        return {
          userId,
          displayName: user.displayName || userId,
          count,
          lastLoginAt: user.lastLoginAt || null,
        };
      });

    const topComparers = Object.entries(comparerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => {
        const user = userLookup[userId] || {};
        return {
          userId,
          displayName: user.displayName || userId,
          count,
        };
      });

    const recentActivity = latestRuns.slice(0, 8).map(entry => ({
      userId: entry.userId || 'guest',
      displayName: (userLookup[entry.userId] || {}).displayName || entry.userId || 'guest',
      algo: entry.algo || '—',
      category: entry.category || '—',
      createdAt: entry.createdAt || null,
      comparison: !!entry.comparison,
    }));

    const recentActivityByDay = Object.entries(dailyCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, count]) => ({ date, count }));

    const recentSignups = Object.entries(signupCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, count]) => ({ date, count }));

    const activeUsers7d = users.filter(user => user.lastLoginAt && new Date(user.lastLoginAt).getTime() >= recentCutoff).length;
    const newUsers7d = users.filter(user => user.createdAt && new Date(user.createdAt).getTime() >= recentCutoff).length;
    const averageRunsPerUser = totalUsers ? (totalHistory / totalUsers).toFixed(1) : '0.0';
    const comparisonRate = totalHistory ? ((activityMix.comparison / totalHistory) * 100).toFixed(1) : '0.0';

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalRuns: totalHistory,
        totalComparisons: activityMix.comparison,
        totalNormalRuns: activityMix.normal,
        comparisonRate,
        averageRunsPerUser,
        activeUsers7d,
        newUsers7d,
        mostRunAlgorithms,
        commonProblemTypes,
        topUsers,
        topComparers,
        recentActivity,
        recentActivityByDay,
        recentSignups,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'analytics failed' });
  }
});

module.exports = router;
