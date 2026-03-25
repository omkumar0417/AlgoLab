/**
 * POST /api/run
 * Executes an algorithm server-side and returns metrics
 * Body: { algo, input, params }
 */

const express = require('express');
const router  = express.Router();
const { connectDB } = require('../db');

// ── Algorithm implementations (server-side) ──────────────────

function quickSort(arr) {
  let steps = 0, swaps = 0;
  function qs(a, lo, hi) {
    if (lo >= hi) return;
    let pivot = a[hi], i = lo - 1;
    for (let j = lo; j < hi; j++) {
      steps++;
      if (a[j] <= pivot) { i++; [a[i], a[j]] = [a[j], a[i]]; swaps++; }
    }
    [a[i+1], a[hi]] = [a[hi], a[i+1]];
    qs(a, lo, i); qs(a, i+2, hi);
  }
  const a = [...arr];
  const t = process.hrtime.bigint();
  qs(a, 0, a.length - 1);
  const time = Number(process.hrtime.bigint() - t) / 1e6; // ms
  return { sorted: a, steps, swaps, timeMs: time.toFixed(4) };
}

function mergeSort(arr) {
  let steps = 0;
  function ms(a) {
    if (a.length <= 1) return a;
    const m = Math.floor(a.length / 2);
    const L = ms(a.slice(0, m)), R = ms(a.slice(m));
    const res = [];
    let i = 0, j = 0;
    while (i < L.length && j < R.length) {
      steps++;
      res.push(L[i] <= R[j] ? L[i++] : R[j++]);
    }
    return [...res, ...L.slice(i), ...R.slice(j)];
  }
  const t = process.hrtime.bigint();
  const sorted = ms([...arr]);
  const time = Number(process.hrtime.bigint() - t) / 1e6;
  return { sorted, steps, timeMs: time.toFixed(4) };
}

function knapsackDP(items, W) {
  const n = items.length;
  let steps = 0;
  const dp = Array.from({ length: n + 1 }, () => Array(W + 1).fill(0));
  const t = process.hrtime.bigint();
  for (let i = 1; i <= n; i++) {
    const { w, v } = items[i - 1];
    for (let c = 0; c <= W; c++) {
      steps++;
      dp[i][c] = dp[i-1][c];
      if (c >= w) dp[i][c] = Math.max(dp[i][c], dp[i-1][c-w] + v);
    }
  }
  const time = Number(process.hrtime.bigint() - t) / 1e6;
  return { maxValue: dp[n][W], steps, timeMs: time.toFixed(4) };
}

function dijkstra(adj, src, n) {
  const dist = Array(n).fill(Infinity);
  const vis  = Array(n).fill(false);
  let steps  = 0;
  dist[src] = 0;
  const t = process.hrtime.bigint();
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!vis[i] && (u === -1 || dist[i] < dist[u])) u = i;
    if (dist[u] === Infinity) break;
    vis[u] = true;
    adj[u].forEach(([v, w]) => {
      steps++;
      if (dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    });
  }
  const time = Number(process.hrtime.bigint() - t) / 1e6;
  return { distances: dist, steps, timeMs: time.toFixed(4) };
}

function binarySearch(arr, target) {
  let steps = 0;
  let lo = 0;
  let hi = arr.length - 1;
  const sorted = [...arr].sort((a, b) => a - b);
  const t = process.hrtime.bigint();
  while (lo <= hi) {
    steps++;
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] === target) {
      const time = Number(process.hrtime.bigint() - t) / 1e6;
      return { found: true, index: mid, steps, timeMs: time.toFixed(4), sorted };
    }
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  const time = Number(process.hrtime.bigint() - t) / 1e6;
  return { found: false, index: -1, steps, timeMs: time.toFixed(4), sorted };
}

// ── Route handler ─────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { algo, input = [], params = {} } = req.body;
  if (!algo) return res.status(400).json({ error: 'Missing algo field' });

  let result;
  try {
    switch (algo) {
      case 'quicksort':
        result = quickSort(input);
        break;
      case 'mergesort':
        result = mergeSort(input);
        break;
      case 'knapsack_dp':
        result = knapsackDP(params.items || [], params.W || 10);
        break;
      case 'dijkstra':
        result = dijkstra(params.adj || [], params.src || 0, params.n || 4);
        break;
      case 'binary_search':
        result = binarySearch(input, params.target);
        break;
      default:
        return res.status(400).json({ error: `Unknown algorithm: ${algo}` });
    }

    // Persist to MongoDB (non-blocking)
    connectDB().then(db => {
      if (!db) return;
      db.collection('runs').insertOne({
        algo,
        inputSize: input.length || (params.items || []).length,
        params,
        result: { steps: result.steps, timeMs: result.timeMs },
        createdAt: new Date(),
      }).catch(() => {});
    });

    res.json({ success: true, algo, result });
  } catch (err) {
    console.error('[/api/run]', err);
    res.status(500).json({ error: 'Algorithm execution failed', details: err.message });
  }
});

module.exports = router;
