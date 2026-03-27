/**
 * POST /api/suggest
 * Suggests algorithms based on problem description
 * Body: { query: "find shortest path in weighted graph" }
 */

const express = require('express');
const router  = express.Router();

const ALGO_DB = [
  {
    keywords: ['shortest','path','weighted','distance','route','graph','travel','navigation'],
    results: [
      { name:"Dijkstra's Algorithm", paradigm:'Greedy', complexity:'O((V+E) log V)', score:95,
        reason:'Optimal for single-source shortest path on non-negative weighted graphs. Standard for GPS routing, network protocols.' },
      { name:'A* Search', paradigm:'Heuristic', complexity:'O(E log V)', score:88,
        reason:'Extension of Dijkstra with a heuristic h(n). Faster in practice for goal-directed search.' },
      { name:'Bellman-Ford', paradigm:'Dynamic Programming', complexity:'O(VE)', score:72,
        reason:'Handles negative edges. Use when Dijkstra is not applicable.' },
    ]
  },
  {
    keywords: ['knapsack','bag','pack','maximize','value','weight','capacity','item','budget','selection'],
    results: [
      { name:'0/1 Knapsack (DP)', paradigm:'Dynamic Programming', complexity:'O(nW)', score:98,
        reason:'Guaranteed optimal for discrete knapsack. Greedy fails here.' },
      { name:'Branch & Bound', paradigm:'Branch & Bound', complexity:'O(2ⁿ) worst', score:85,
        reason:'Optimal for large W where DP table is infeasible.' },
      { name:'Greedy (Fractional)', paradigm:'Greedy', complexity:'O(n log n)', score:60,
        reason:'Optimal ONLY for fractional knapsack. Fails for 0/1.' },
    ]
  },
  {
    keywords: ['sort','order','arrange','rank','ascending','descending','largest','smallest'],
    results: [
      { name:'Merge Sort', paradigm:'Divide & Conquer', complexity:'O(n log n)', score:92,
        reason:'Stable, guaranteed O(n log n), ideal for linked lists and external sort.' },
      { name:'Quick Sort', paradigm:'Divide & Conquer', complexity:'O(n log n) avg', score:90,
        reason:'Fastest in practice. O(n²) worst case — mitigate with random pivot.' },
    ]
  },
  {
    keywords: ['queens','chess','board','place','n-queens','constraint','attack','row','column'],
    results: [
      { name:'Backtracking', paradigm:'Backtracking', complexity:'O(n!)', score:95,
        reason:'Classic constraint satisfaction. Place queens row by row, backtrack on conflict.' },
    ]
  },
  {
    keywords: ['traveling','salesman','tour','visit','cities','minimum','cost','tsp','hamiltonian'],
    results: [
      { name:'Branch & Bound', paradigm:'Branch & Bound', complexity:'O(n²·2ⁿ)', score:90,
        reason:'Optimal TSP solver using lower bound pruning. Practical for n ≤ 20.' },
      { name:'Held-Karp DP', paradigm:'Dynamic Programming', complexity:'O(n²·2ⁿ)', score:88,
        reason:'Optimal bitmask DP. Better than brute force O(n!) for n ≤ 25.' },
      { name:'Christofides', paradigm:'Approximation', complexity:'O(n³)', score:75,
        reason:'1.5-approximation for metric TSP. For large n where exact is infeasible.' },
    ]
  },
  {
    keywords: ['traverse','visit','explore','bfs','dfs','breadth','depth','level','component'],
    results: [
      { name:'BFS', paradigm:'Graph Traversal', complexity:'O(V+E)', score:90,
        reason:'Level-order traversal. Finds shortest path (hops) in unweighted graphs.' },
      { name:'DFS', paradigm:'Graph Traversal', complexity:'O(V+E)', score:88,
        reason:'Deep exploration. Used for topological sort, cycle detection, SCCs.' },
    ]
  },
];

function suggest(query) {
  const words = query.toLowerCase().split(/\W+/).filter(Boolean);
  let bestMatch = null, bestScore = 0;

  ALGO_DB.forEach(entry => {
    const score = entry.keywords.reduce((acc, kw) =>
      acc + words.filter(w => w.includes(kw) || kw.includes(w)).length, 0);
    if (score > bestScore) { bestScore = score; bestMatch = entry; }
  });

  if (!bestMatch || bestScore === 0) return [];
  return bestMatch.results;
}

router.post('/', (req, res) => {
  const { query = '' } = req.body;
  if (!query.trim()) return res.status(400).json({ error: 'Missing query' });
  const suggestions = suggest(query);
  res.json({ query, suggestions, count: suggestions.length });
});

module.exports = router;
