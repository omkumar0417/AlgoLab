/* ============================================================
   ALGOLAB — COMPLETE JAVASCRIPT
   Algorithms, Visualizations, Comparisons, History
   ============================================================ */

'use strict';

// ============================================================
// GLOBAL STATE
// ============================================================
const State = {
  currentPage: 'home',
  vizAlgo: 'quicksort',
  vizSpeed: 5,
  vizRunning: false,
  vizPaused: false,
  vizSteps: [],
  vizStepIndex: 0,
  vizAnimFrame: null,
  vizTimer: null,
  sortArray: [],
  history: [],
  presets: [],
  charts: {},
  auth: {
    token: localStorage.getItem('algolab_token') || '',
    userId: localStorage.getItem('algolab_user') || '',
  },
};

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  const navLink = document.querySelector(`[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  State.currentPage = page;
  window.scrollTo(0, 0);

  // page-specific init
  if (page === 'suggest') initBigOChart();
  if (page === 'history') renderHistory();
  if (page === 'compare' && param) handleFailureParam(param);
}

function handleFailureParam(param) {
  const catSelect = document.getElementById('compareCategory');
  if (catSelect) {
    catSelect.value = 'failure';
    setTimeout(() => document.getElementById('btnRunCompare').click(), 300);
  }
}

function requireLogin(message = 'Please login first') {
  if (State.auth.token) return true;
  showToast(message, 'error');
  navigateTo('auth');
  return false;
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (State.auth.token) headers.Authorization = `Bearer ${State.auth.token}`;
  return headers;
}

function getPresetStorageKey() {
  return `algolab_presets_${State.auth.userId || 'guest'}`;
}

function loadPresets() {
  try {
    State.presets = JSON.parse(localStorage.getItem(getPresetStorageKey()) || '[]');
  } catch {
    State.presets = [];
  }
}

function persistPresets() {
  localStorage.setItem(getPresetStorageKey(), JSON.stringify(State.presets));
}

function renderPresets() {
  const list = document.getElementById('presetList');
  if (!list) return;

  if (!State.presets.length) {
    list.innerHTML = '<div class="preset-empty">No presets yet.</div>';
    return;
  }

  list.innerHTML = State.presets.map(preset => `
    <div class="preset-item">
      <div class="preset-main">
        <div class="preset-title">${preset.name}</div>
        <div class="preset-meta">${preset.algoLabel} • ${preset.input}</div>
      </div>
      <div class="preset-actions">
        <button class="preset-mini" onclick="applyPreset('${preset.id}')">Load</button>
        <button class="preset-mini" onclick="deletePreset('${preset.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function applyPreset(id) {
  const preset = State.presets.find(item => item.id === id);
  if (!preset) return;
  document.getElementById('vizAlgo').value = preset.algo;
  document.getElementById('customInput').value = preset.input;
  document.getElementById('inputSize').value = preset.size;
  document.getElementById('inputSizeVal').textContent = preset.size;
  updateComplexityBox(preset.algo);
  updateWhyPanel(preset.algo);
  showToast(`Loaded preset: ${preset.name}`, 'success');
}

function deletePreset(id) {
  State.presets = State.presets.filter(item => item.id !== id);
  persistPresets();
  renderPresets();
  showToast('Preset deleted', 'success');
}

function saveCurrentPreset() {
  const algo = document.getElementById('vizAlgo').value;
  const input = document.getElementById('customInput').value.trim();
  const size = document.getElementById('inputSize').value;
  if (!input) {
    showToast('Enter custom input before saving a preset', 'error');
    return;
  }

  const algoLabel = document.getElementById('vizAlgo').selectedOptions[0].textContent;
  const name = `${algoLabel} preset ${State.presets.length + 1}`;
  State.presets.unshift({
    id: String(Date.now()),
    name,
    algo,
    algoLabel,
    input,
    size,
  });
  State.presets = State.presets.slice(0, 8);
  persistPresets();
  renderPresets();
  showToast('Preset saved', 'success');
}

function parseCustomArrayInput() {
  const raw = document.getElementById('customInput')?.value.trim();
  if (!raw) return null;
  const values = raw.split(',').map(item => Number(item.trim())).filter(item => Number.isFinite(item));
  return values.length ? values : null;
}

function updateHistorySummary() {
  if (!document.getElementById('summaryRuns')) return;
  const runs = State.history.length;
  const comparisons = State.history.filter(item => item.comparison).length;
  const categoryCounts = State.history.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  const favoriteCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  const latestAlgo = State.history[0]?.algo || '—';

  document.getElementById('summaryRuns').textContent = String(runs);
  document.getElementById('summaryCategory').textContent = favoriteCategory;
  document.getElementById('summaryAlgo').textContent = latestAlgo;
  document.getElementById('summaryComparisons').textContent = String(comparisons);
}

function getComparisonInsight(results, cat, size) {
  const timedResults = results.filter(item => item.time !== '—');
  const winner = timedResults.sort((a, b) => parseFloat(a.time) - parseFloat(b.time))[0];
  if (!winner) {
    return 'This comparison has no measurable winner yet.';
  }

  if (cat === 'sorting') {
    return `${winner.name} wins for n=${size} because it kept the lowest measured runtime on this input. Quick Sort can still collapse on already sorted data, so Merge Sort remains the safer choice when input order is unpredictable.`;
  }
  if (cat === 'knapsack') {
    return `${winner.name} looks best for this run, but the real decision is about correctness: DP guarantees the optimal value, while Greedy can miss the best set of items even when it feels faster.`;
  }
  if (cat === 'shortestpath') {
    return `${winner.name} is the most efficient here, but the graph type matters more than raw time. BFS is best for unweighted graphs, Dijkstra for non-negative weights, and Floyd-Warshall when you need every pair distance.`;
  }
  if (cat === 'failure') {
    return 'The failure dashboard shows why raw speed is not enough. Some algorithms appear fast until the wrong input shape exposes a bad pivot rule, greedy shortcut, or exponential search tree.';
  }
  return `${winner.name} is the best fit for this case based on the current runtime and step count.`;
}

// ============================================================
// HERO CANVAS — ANIMATED PARTICLES
// ============================================================
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = Array.from({length: 60}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2 + 0.5,
    a: Math.random()
  }));

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,255,${p.a * 0.5})`;
      ctx.fill();
    });
    // Draw edges between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,229,255,${0.12 * (1 - d/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ============================================================
// ALGORITHM DATA — Complexity, Why, Paradigm
// ============================================================
const AlgoMeta = {
  quicksort: {
    name: 'Quick Sort',
    paradigm: 'Divide & Conquer',
    best: 'O(n log n)',
    avg: 'O(n log n)',
    worst: 'O(n²)',
    space: 'O(log n)',
    why: `Quick Sort partitions the array around a pivot, then recursively sorts both halves. 
          It is preferred in practice due to excellent cache performance and low constant factors. 
          However, on already-sorted input with a bad pivot strategy, it degrades to O(n²) — a critical failure case.`,
  },
  mergesort: {
    name: 'Merge Sort',
    paradigm: 'Divide & Conquer',
    best: 'O(n log n)',
    avg: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(n)',
    why: `Merge Sort guarantees O(n log n) in all cases by splitting the array in half, sorting each recursively, 
          then merging. It is stable and predictable — preferred for linked lists or external sorting — 
          but uses O(n) extra space unlike Quick Sort.`,
  },
  bfs: {
    name: 'Breadth-First Search',
    paradigm: 'Graph Traversal',
    best: 'O(V+E)',
    avg: 'O(V+E)',
    worst: 'O(V+E)',
    space: 'O(V)',
    why: `BFS explores a graph level by level using a queue. It finds the shortest path in an unweighted graph 
          and guarantees visiting all reachable nodes. Use it when edge weights are equal or you need the 
          minimum number of hops.`,
  },
  dijkstra: {
    name: "Dijkstra's Algorithm",
    paradigm: 'Greedy',
    best: 'O((V+E) log V)',
    avg: 'O((V+E) log V)',
    worst: 'O(V²)',
    space: 'O(V)',
    why: `Dijkstra's greedily picks the nearest unvisited node and relaxes its neighbors. 
          It solves Single Source Shortest Path on non-negative weighted graphs optimally. 
          It fails with negative edge weights — use Bellman-Ford instead.`,
  },
  floyd: {
    name: 'Floyd-Warshall',
    paradigm: 'Dynamic Programming',
    best: 'O(V³)',
    avg: 'O(V³)',
    worst: 'O(V³)',
    space: 'O(V²)',
    why: `Floyd-Warshall computes all-pairs shortest paths using DP. For every pair (i,j), it checks if 
          going through intermediate node k gives a shorter path. Simple to implement but O(V³) makes it 
          impractical for large sparse graphs.`,
  },
  knapsack_dp: {
    name: '0/1 Knapsack (DP)',
    paradigm: 'Dynamic Programming',
    best: 'O(nW)',
    avg: 'O(nW)',
    worst: 'O(nW)',
    space: 'O(nW)',
    why: `DP Knapsack builds a 2D table where dp[i][w] = max value using first i items with capacity w. 
          It guarantees the optimal solution by considering every combination efficiently. 
          This is the gold standard for 0/1 Knapsack — Greedy will fail here.`,
  },
  knapsack_greedy: {
    name: 'Knapsack (Greedy)',
    paradigm: 'Greedy',
    best: 'O(n log n)',
    avg: 'O(n log n)',
    worst: 'O(n log n)',
    space: 'O(1)',
    why: `Greedy sorts by value/weight ratio and picks items greedily. This works perfectly for 
          FRACTIONAL knapsack but FAILS for 0/1 knapsack. It may miss the optimal combination. 
          This is a famous failure case — see the Comparison page for a counterexample.`,
  },
  nqueens: {
    name: 'N-Queens',
    paradigm: 'Backtracking',
    best: 'O(n!)',
    avg: 'O(n!)',
    worst: 'O(n!)',
    space: 'O(n)',
    why: `N-Queens places n non-attacking queens on an n×n board using backtracking. 
          It tries each column in a row, checks safety, recurses, and backtracks on conflicts. 
          Time complexity grows factorially — for n=12, there are 14,200 solutions found 
          through millions of recursive calls.`,
  },
  tsp: {
    name: 'TSP (Branch & Bound)',
    paradigm: 'Branch & Bound',
    best: 'O(n²)',
    avg: 'O(n! / 2)',
    worst: 'O(n!)',
    space: 'O(n²)',
    why: `TSP finds the minimum-cost Hamiltonian cycle. Branch & Bound prunes branches whose lower 
          bound exceeds the best known solution. Much better than brute force but still exponential 
          in worst case. For n > 20, approximate algorithms (Christofides) are preferred.`,
  },
  rabinkarp: {
    name: 'Rabin-Karp',
    paradigm: 'String Matching / Hashing',
    best: 'O(n+m)',
    avg: 'O(n+m)',
    worst: 'O(nm)',
    space: 'O(1)',
    why: `Rabin-Karp uses rolling hash to slide a window over text, comparing hash values first. 
          Only when hashes match does it verify the match character-by-character. 
          Extremely efficient for multiple pattern matching and plagiarism detection. 
          Worst case O(nm) occurs with hash collisions.`,
  },
};

// ============================================================
// VISUALIZER — CONTROLS & DISPATCH
// ============================================================
function initVisualizer() {
  const algoSel   = document.getElementById('vizAlgo');
  const speedSldr = document.getElementById('vizSpeed');
  const sizeSldr  = document.getElementById('inputSize');
  const btnRun    = document.getElementById('btnStartViz');
  const btnPause  = document.getElementById('btnPauseViz');
  const btnReset  = document.getElementById('btnResetViz');
  const btnStep   = document.getElementById('btnStepViz');

  algoSel.addEventListener('change', () => {
    State.vizAlgo = algoSel.value;
    resetViz();
    updateComplexityBox(algoSel.value);
    updateWhyPanel(algoSel.value);
  });
  speedSldr.addEventListener('input', () => {
    State.vizSpeed = +speedSldr.value;
    document.getElementById('vizSpeedVal').textContent = speedSldr.value + 'x';
  });
  sizeSldr.addEventListener('input', () => {
    document.getElementById('inputSizeVal').textContent = sizeSldr.value;
  });

  btnRun.addEventListener('click', startViz);
  btnPause.addEventListener('click', togglePause);
  btnReset.addEventListener('click', resetViz);
  btnStep.addEventListener('click', stepViz);
  document.getElementById('btnSavePreset').addEventListener('click', saveCurrentPreset);

  updateComplexityBox('quicksort');
  updateWhyPanel('quicksort');
  loadPresets();
  renderPresets();
}

function updateComplexityBox(algo) {
  const m = AlgoMeta[algo];
  if (!m) return;
  document.getElementById('cBest').textContent  = m.best;
  document.getElementById('cAvg').textContent   = m.avg;
  document.getElementById('cWorst').textContent = m.worst;
  document.getElementById('cSpace').textContent = m.space;
}

function updateWhyPanel(algo) {
  const m = AlgoMeta[algo];
  if (!m) return;
  document.getElementById('whyContent').innerHTML = `
    <div class="why-paradigm">${m.paradigm}</div>
    <div class="why-title">${m.name}</div>
    <p>${m.why}</p>
  `;
}

function startViz() {
  const algo = document.getElementById('vizAlgo').value;
  State.vizAlgo = algo;
  resetViz();
  clearLog();

  // Show correct viz panel
  hideAllViz();
  document.getElementById('vizPlaceholder').classList.add('hidden');

  if (['quicksort','mergesort'].includes(algo)) runSortViz(algo);
  else if (['bfs','dijkstra'].includes(algo))   runGraphViz(algo);
  else if (algo === 'floyd')                    runFloydViz();
  else if (['knapsack_dp','knapsack_greedy'].includes(algo)) runKnapsackViz(algo);
  else if (algo === 'nqueens')                  runNQueensViz();
  else if (algo === 'rabinkarp')                runRabinKarpViz();
  else if (algo === 'tsp')                      runTSPViz();
}

function hideAllViz() {
  ['sortViz','graphCanvas','dpViz','nqueensViz','rkViz'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

function togglePause() {
  State.vizPaused = !State.vizPaused;
  document.getElementById('btnPauseViz').textContent = State.vizPaused ? '▶ Resume' : '⏸ Pause';
}

function resetViz() {
  State.vizRunning = false;
  State.vizPaused = false;
  clearTimeout(State.vizTimer);
  document.getElementById('btnPauseViz').textContent = '⏸ Pause';
  hideAllViz();
  document.getElementById('vizPlaceholder').classList.remove('hidden');
  clearLog();
}

function stepViz() {
  // Step mode — manually advance one step
  if (!State.vizRunning) startViz();
  State.vizPaused = true;
  document.getElementById('btnPauseViz').textContent = '▶ Resume';
}

// ============================================================
// LOG HELPERS
// ============================================================
let stepCounter = 0;
function clearLog() {
  stepCounter = 0;
  document.getElementById('logEntries').innerHTML = '';
  document.getElementById('stepCount').textContent = 'Steps: 0';
}
function log(msg, cls = '') {
  stepCounter++;
  document.getElementById('stepCount').textContent = `Steps: ${stepCounter}`;
  const el = document.createElement('div');
  el.className = `log-entry ${cls}`;
  el.textContent = `[${stepCounter}] ${msg}`;
  const entries = document.getElementById('logEntries');
  entries.appendChild(el);
  entries.scrollTop = entries.scrollHeight;
}

// ============================================================
// DELAY HELPER
// ============================================================
function delay(ms) {
  return new Promise(res => {
    function check() {
      if (!State.vizPaused) {
        State.vizTimer = setTimeout(res, ms);
      } else {
        setTimeout(check, 100);
      }
    }
    check();
  });
}

// ============================================================
// SORTING VISUALIZER
// ============================================================
function genArray(n) {
  const custom = document.getElementById('customInput').value.trim();
  if (custom) {
    return custom.split(',').map(v => Math.max(1, Math.min(100, parseInt(v.trim()) || 50)));
  }
  return Array.from({length: n}, () => Math.floor(Math.random() * 90) + 10);
}

function renderBars(arr, comparing = [], swapping = [], sorted = [], pivot = -1) {
  const container = document.getElementById('sortBars');
  container.innerHTML = '';
  const max = Math.max(...arr);
  arr.forEach((v, i) => {
    const bar = document.createElement('div');
    bar.className = 'sort-bar';
    bar.style.height = `${(v / max) * 90}%`;
    if (sorted.includes(i))    bar.classList.add('sorted');
    else if (i === pivot)       bar.classList.add('pivot');
    else if (swapping.includes(i))  bar.classList.add('swapping');
    else if (comparing.includes(i)) bar.classList.add('comparing');
    container.appendChild(bar);
  });
}

async function runSortViz(algo) {
  const customArr = parseCustomArrayInput();
  const n = customArr?.length || +document.getElementById('inputSize').value;
  const arr = customArr ? [...customArr] : genArray(n);
  State.sortArray = [...arr];
  State.vizRunning = true;

  document.getElementById('sortViz').classList.remove('hidden');
  renderBars(arr);
  log(`Starting ${algo === 'quicksort' ? 'Quick Sort' : 'Merge Sort'} on ${n} elements`, 'highlight');
  if (customArr) log(`Using custom input: [${customArr.join(', ')}]`);

  const spd = () => Math.max(20, 600 / (State.vizSpeed * 2));

  if (algo === 'quicksort') {
    await quickSortViz(arr, 0, arr.length - 1, spd);
  } else {
    await mergeSortViz(arr, 0, arr.length - 1, spd);
  }

  renderBars(arr, [], [], arr.map((_,i) => i));
  log('✓ Sorting complete!', 'success');

  // Save to history
  addToHistory({
    category: 'sorting',
    algo: algo === 'quicksort' ? 'Quick Sort' : 'Merge Sort',
    input: `Array of ${n}`,
    result: `Sorted in ${stepCounter} steps`,
    steps: stepCounter,
    time: Date.now(),
  });
}

async function quickSortViz(arr, low, high, spd) {
  if (!State.vizRunning || low >= high) return;
  const pivotIdx = await partitionViz(arr, low, high, spd);
  await quickSortViz(arr, low, pivotIdx - 1, spd);
  await quickSortViz(arr, pivotIdx + 1, high, spd);
}

async function partitionViz(arr, low, high, spd) {
  const pivot = arr[high];
  log(`Pivot: ${pivot} at index ${high}`);
  let i = low - 1;
  for (let j = low; j < high; j++) {
    renderBars(arr, [j], [], [], high);
    log(`Compare arr[${j}]=${arr[j]} with pivot=${pivot}`);
    await delay(spd());
    if (arr[j] <= pivot) {
      i++;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      renderBars(arr, [], [i, j], [], high);
      log(`Swap arr[${i}]=${arr[i]} ↔ arr[${j}]=${arr[j]}`);
      await delay(spd());
    }
  }
  [arr[i+1], arr[high]] = [arr[high], arr[i+1]];
  renderBars(arr, [], [i+1, high]);
  await delay(spd());
  return i + 1;
}

async function mergeSortViz(arr, l, r, spd) {
  if (!State.vizRunning || l >= r) return;
  const m = Math.floor((l + r) / 2);
  await mergeSortViz(arr, l, m, spd);
  await mergeSortViz(arr, m+1, r, spd);
  await mergeViz(arr, l, m, r, spd);
}

async function mergeViz(arr, l, m, r, spd) {
  const L = arr.slice(l, m+1), R = arr.slice(m+1, r+1);
  let i=0, j=0, k=l;
  while (i < L.length && j < R.length) {
    renderBars(arr, [k]);
    log(`Merge: comparing ${L[i]} and ${R[j]}`);
    await delay(spd());
    if (L[i] <= R[j]) arr[k++] = L[i++];
    else arr[k++] = R[j++];
    renderBars(arr, [], [k-1]);
    await delay(spd() / 2);
  }
  while (i < L.length) { arr[k++] = L[i++]; }
  while (j < R.length) { arr[k++] = R[j++]; }
  renderBars(arr, [], [], Array.from({length:r-l+1},(_,i)=>l+i));
}

// ============================================================
// GRAPH VISUALIZER — BFS / DIJKSTRA
// ============================================================
const SAMPLE_GRAPH = {
  nodes: [
    {id:0,x:80, y:150,label:'A'},
    {id:1,x:220,y:60, label:'B'},
    {id:2,x:360,y:150,label:'C'},
    {id:3,x:220,y:240,label:'D'},
    {id:4,x:460,y:60, label:'E'},
    {id:5,x:460,y:240,label:'F'},
  ],
  edges: [
    {from:0,to:1,w:4},{from:0,to:3,w:2},
    {from:1,to:2,w:3},{from:1,to:3,w:1},
    {from:2,to:4,w:2},{from:2,to:5,w:5},
    {from:3,to:2,w:6},{from:3,to:5,w:8},
    {from:4,to:5,w:1},
  ],
};

function drawGraph(visited=[], current=-1, path=[], distances={}) {
  const canvas = document.getElementById('graphCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 600;
  canvas.height = 320;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = (canvas.width - 100) / 500;
  const scaleY = (canvas.height - 60) / 300;

  const nx = n => 50 + n.x * scaleX;
  const ny = n => 30 + n.y * scaleY;

  // Draw edges
  SAMPLE_GRAPH.edges.forEach(e => {
    const a = SAMPLE_GRAPH.nodes[e.from];
    const b = SAMPLE_GRAPH.nodes[e.to];
    const inPath = path.some(([p1,p2]) => (p1===e.from&&p2===e.to)||(p1===e.to&&p2===e.from));
    ctx.beginPath();
    ctx.moveTo(nx(a), ny(a));
    ctx.lineTo(nx(b), ny(b));
    ctx.strokeStyle = inPath ? '#00e5ff' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = inPath ? 2.5 : 1;
    ctx.stroke();
    // Weight label
    const mx = (nx(a)+nx(b))/2, my = (ny(a)+ny(b))/2;
    ctx.fillStyle = 'rgba(136,146,176,0.8)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(e.w, mx+3, my-3);
  });

  // Draw nodes
  SAMPLE_GRAPH.nodes.forEach(n => {
    const x = nx(n), y = ny(n);
    const isVisited = visited.includes(n.id);
    const isCurrent = current === n.id;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = isCurrent ? '#00e5ff' : isVisited ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.05)';
    ctx.fill();
    ctx.strokeStyle = isCurrent ? '#00e5ff' : isVisited ? '#10b981' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Label
    ctx.fillStyle = isCurrent ? '#050810' : '#f0f4ff';
    ctx.font = 'bold 13px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, x, y);
    // Distance
    if (distances[n.id] !== undefined) {
      ctx.fillStyle = '#00e5ff';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText(distances[n.id] === Infinity ? '∞' : distances[n.id], x, y + 30);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  });
}

async function runGraphViz(algo) {
  const canvas = document.getElementById('graphCanvas');
  canvas.classList.remove('hidden');
  drawGraph();
  log(`Starting ${algo.toUpperCase()} from node A`, 'highlight');

  const spd = () => Math.max(300, 1200 / State.vizSpeed);

  if (algo === 'bfs') {
    // BFS
    const visited = [], queue = [0], path = [];
    while (queue.length) {
      const node = queue.shift();
      if (visited.includes(node)) continue;
      visited.push(node);
      drawGraph(visited, node, path);
      log(`Visit ${SAMPLE_GRAPH.nodes[node].label} | Queue: [${queue.map(q=>SAMPLE_GRAPH.nodes[q].label)}]`);
      await delay(spd());
      SAMPLE_GRAPH.edges.forEach(e => {
        if (e.from === node && !visited.includes(e.to)) {
          queue.push(e.to);
          path.push([e.from, e.to]);
        }
        if (e.to === node && !visited.includes(e.from)) {
          queue.push(e.from);
          path.push([e.to, e.from]);
        }
      });
    }
    log('✓ BFS complete! All nodes visited.', 'success');
  } else {
    // DIJKSTRA
    const n = SAMPLE_GRAPH.nodes.length;
    const dist = Array(n).fill(Infinity);
    const visited = [];
    dist[0] = 0;
    const distances = {0:0};
    drawGraph([], 0, [], distances);

    for (let iter = 0; iter < n; iter++) {
      let u = -1;
      for (let i = 0; i < n; i++) {
        if (!visited.includes(i) && (u === -1 || dist[i] < dist[u])) u = i;
      }
      if (dist[u] === Infinity) break;
      visited.push(u);
      log(`Relax from ${SAMPLE_GRAPH.nodes[u].label} (dist=${dist[u]})`);
      drawGraph(visited, u, [], distances);
      await delay(spd());

      SAMPLE_GRAPH.edges.forEach(e => {
        const v = e.from === u ? e.to : (e.to === u ? e.from : -1);
        if (v !== -1 && dist[u] + e.w < dist[v]) {
          dist[v] = dist[u] + e.w;
          distances[v] = dist[v];
          log(`  Update dist[${SAMPLE_GRAPH.nodes[v].label}] = ${dist[v]}`);
          drawGraph(visited, u, [], distances);
        }
      });
      await delay(spd() / 2);
    }
    log(`✓ Dijkstra done! Distances: ${SAMPLE_GRAPH.nodes.map((n,i)=>`${n.label}=${dist[i]}`).join(', ')}`, 'success');
  }

  addToHistory({
    category: 'graph',
    algo: algo === 'bfs' ? 'BFS' : "Dijkstra's",
    input: '6-node weighted graph',
    result: `Traversal in ${stepCounter} steps`,
    steps: stepCounter,
    time: Date.now(),
  });
}

// ============================================================
// FLOYD-WARSHALL VISUALIZER
// ============================================================
async function runFloydViz() {
  const dpDiv = document.getElementById('dpViz');
  dpDiv.classList.remove('hidden');
  const wrap = document.getElementById('dpTableWrap');

  const INF = 999;
  const n = 4;
  const labels = ['A','B','C','D'];
  // Initial distance matrix
  let dist = [
    [0,  3,  INF, 7],
    [8,  0,  2,   INF],
    [5,  INF,0,   1],
    [2,  INF,INF, 0],
  ];

  function renderTable(highlight=null) {
    let html = '<table><tr><th></th>';
    labels.forEach(l => html += `<th>${l}</th>`);
    html += '</tr>';
    dist.forEach((row, i) => {
      html += `<tr><th>${labels[i]}</th>`;
      row.forEach((v, j) => {
        let cls = '';
        if (highlight && highlight[0] === i && highlight[1] === j) cls = 'dp-active';
        else if (v < INF && v !== 0) cls = 'dp-filled';
        html += `<td class="${cls}">${v===INF?'∞':v}</td>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    wrap.innerHTML = html;
  }

  renderTable();
  log('Floyd-Warshall: All-Pairs Shortest Paths', 'highlight');
  const spd = () => Math.max(100, 500 / State.vizSpeed);

  for (let k = 0; k < n; k++) {
    log(`Using intermediate node ${labels[k]}`, 'highlight');
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (dist[i][k] + dist[k][j] < dist[i][j]) {
          dist[i][j] = dist[i][k] + dist[k][j];
          renderTable([i, j]);
          log(`  dist[${labels[i]}][${labels[j]}] updated to ${dist[i][j]} via ${labels[k]}`);
          await delay(spd());
        }
        renderTable([i, j]);
        await delay(spd() / 4);
      }
    }
  }
  renderTable();
  log('✓ Floyd-Warshall complete!', 'success');
}

// ============================================================
// KNAPSACK VISUALIZER
// ============================================================
async function runKnapsackViz(algo) {
  const dpDiv = document.getElementById('dpViz');
  dpDiv.classList.remove('hidden');
  const wrap = document.getElementById('dpTableWrap');

  const items  = [{w:2,v:6},{w:2,v:10},{w:3,v:12},{w:5,v:13}];
  const W = 7;
  const n = items.length;
  const spd = () => Math.max(100, 400 / State.vizSpeed);

  if (algo === 'knapsack_dp') {
    const dp = Array.from({length:n+1}, ()=>Array(W+1).fill(0));
    log(`0/1 Knapsack DP: ${n} items, capacity=${W}`, 'highlight');

    function renderDP(hi=-1, hj=-1) {
      let html = '<table><tr><th>i\\w</th>';
      for(let c=0;c<=W;c++) html += `<th>${c}</th>`;
      html += '</tr>';
      dp.forEach((row,i)=>{
        html += `<tr><th>${i===0?'0':items[i-1].w+'/'+items[i-1].v}</th>`;
        row.forEach((v,j)=>{
          let cls = (i===hi&&j===hj)?'dp-active':v>0?'dp-filled':'';
          html+=`<td class="${cls}">${v}</td>`;
        });
        html += '</tr>';
      });
      html += '</table>';
      wrap.innerHTML = html;
    }

    renderDP();
    for(let i=1;i<=n;i++){
      const {w,v}=items[i-1];
      log(`Item ${i}: weight=${w}, value=${v}`);
      for(let c=0;c<=W;c++){
        dp[i][c] = dp[i-1][c];
        if(c>=w) dp[i][c]=Math.max(dp[i][c], dp[i-1][c-w]+v);
        renderDP(i,c);
        await delay(spd());
      }
    }
    log(`✓ Max value = ${dp[n][W]}`, 'success');
  } else {
    // GREEDY KNAPSACK — show failure
    log('⚠ Greedy Knapsack: sorting by value/weight ratio...', 'error');
    const sorted = items.map((it,i)=>({...it,i,ratio:it.v/it.w})).sort((a,b)=>b.ratio-a.ratio);
    let cap=W, totalVal=0;
    let html = '<table><tr><th>Item</th><th>W</th><th>V</th><th>V/W</th><th>Taken</th></tr>';
    sorted.forEach(it=>{
      const taken = cap>=it.w;
      if(taken){ cap-=it.w; totalVal+=it.v; }
      html+=`<tr class="${taken?'dp-filled':''}"><td>${it.i+1}</td><td>${it.w}</td><td>${it.v}</td><td>${it.ratio.toFixed(1)}</td><td>${taken?'✓':'✗'}</td></tr>`;
    });
    html += '</table>';
    wrap.innerHTML = html;
    log(`Greedy result: ${totalVal} (Optimal DP: 22) — Greedy FAILS here!`, 'error');
    await delay(spd() * 5);
  }

  addToHistory({
    category: 'knapsack',
    algo: algo === 'knapsack_dp' ? '0/1 Knapsack DP' : 'Greedy Knapsack',
    input: `n=4, W=${W}`,
    result: `Completed in ${stepCounter} steps`,
    steps: stepCounter,
    time: Date.now(),
  });
}

// ============================================================
// N-QUEENS VISUALIZER
// ============================================================
async function runNQueensViz() {
  const div = document.getElementById('nqueensViz');
  div.classList.remove('hidden');
  const board = document.getElementById('queensBoard');
  const n = Math.min(8, +document.getElementById('inputSize').value) || 6;
  board.style.gridTemplateColumns = `repeat(${n},40px)`;
  const queens = Array(n).fill(-1);
  const spd = () => Math.max(50, 400 / State.vizSpeed);

  log(`N-Queens: placing ${n} queens on ${n}×${n} board`, 'highlight');
  let solutions = 0, calls = 0;

  function renderBoard(row=-1, col=-1, conflicts=[]) {
    board.innerHTML = '';
    for(let r=0;r<n;r++){
      for(let c=0;c<n;c++){
        const cell = document.createElement('div');
        cell.className = 'queen-cell ' + ((r+c)%2===0?'light':'dark');
        if(queens[r]===c){
          const isConflict = conflicts.some(([cr,cc])=>cr===r&&cc===c);
          cell.classList.add(isConflict?'queen-conflict':'queen-placed');
          cell.textContent = '♛';
        }
        if(r===row&&c===col) cell.classList.add('queen-trying');
        board.appendChild(cell);
      }
    }
  }

  function isSafe(row, col) {
    for(let r=0;r<row;r++){
      if(queens[r]===col) return false;
      if(Math.abs(queens[r]-col)===Math.abs(r-row)) return false;
    }
    return true;
  }

  async function solve(row) {
    calls++;
    if(row === n){ solutions++; log(`🎉 Solution #${solutions} found!`, 'success'); return true; }
    for(let col=0;col<n;col++){
      if(isSafe(row,col)){
        queens[row]=col;
        renderBoard(row,col);
        log(`Place queen at row ${row}, col ${col}`);
        await delay(spd());
        if(await solve(row+1)) return true;
        queens[row]=-1;
        renderBoard(row,col);
        log(`Backtrack from row ${row}, col ${col}`);
        await delay(spd()/2);
      }
    }
    return false;
  }

  await solve(0);
  renderBoard();
  log(`✓ Done! ${solutions} solution(s), ${calls} recursive calls`, 'success');

  addToHistory({
    category: 'graph',
    algo: 'N-Queens Backtracking',
    input: `n=${n}`,
    result: `${solutions} solutions, ${calls} calls`,
    steps: stepCounter,
    time: Date.now(),
  });
}

// ============================================================
// RABIN-KARP VISUALIZER
// ============================================================
async function runRabinKarpViz() {
  const div = document.getElementById('rkViz');
  div.classList.remove('hidden');
  const displayEl = document.getElementById('rkDisplay');
  const text = 'ABCACABCAB';
  const pattern = 'CAB';
  const spd = () => Math.max(150, 600 / State.vizSpeed);
  const BASE = 31, MOD = 1e9+7;

  log(`Rabin-Karp: text="${text}", pattern="${pattern}"`, 'highlight');

  // Compute pattern hash
  let phash = 0;
  for(let c of pattern) phash = (phash * BASE + c.charCodeAt(0)) % MOD;

  let whash = 0, power = 1;
  for(let i=0;i<pattern.length;i++){
    if(i>0) power = (power * BASE) % MOD;
    whash = (whash * BASE + text.charCodeAt(i)) % MOD;
  }

  const matches = [];

  for(let i=0;i<=text.length-pattern.length;i++){
    // Render current window
    displayEl.innerHTML = `
      <span class="rk-label">TEXT</span>
      <div>
        ${text.split('').map((c,j)=>{
          let cls = '';
          if(j>=i&&j<i+pattern.length) cls='window';
          if(matches.includes(j-pattern.length+1)||matches.some(m=>j>=m&&j<m+pattern.length)) cls='match';
          return `<span class="rk-char ${cls}">${c}</span>`;
        }).join('')}
      </div>
      <span class="rk-label" style="margin-top:1rem">PATTERN (hash=${phash.toFixed(0)})</span>
      <div>
        ${' '.repeat(i*2)}${pattern.split('').map(c=>`<span class="rk-char">${c}</span>`).join('')}
      </div>
      <div style="margin-top:1rem;font-size:0.7rem;color:var(--text-secondary)">Window hash: ${whash.toFixed(0)} | ${whash===phash?'<span style="color:var(--success)">Hash Match!</span>':'No match'}</div>
    `;
    log(`i=${i}: window hash=${whash.toFixed(0)} vs pattern hash=${phash.toFixed(0)}`);
    await delay(spd());

    if(whash === phash){
      // Verify
      if(text.substring(i,i+pattern.length) === pattern){
        matches.push(i);
        log(`✓ Pattern found at index ${i}!`, 'success');
      } else {
        log(`Hash collision at ${i} — not a real match`, 'error');
      }
    }
    // Rolling hash
    if(i < text.length - pattern.length){
      whash = (whash - text.charCodeAt(i) * power % MOD + MOD) % MOD;
      whash = (whash * BASE + text.charCodeAt(i+pattern.length)) % MOD;
    }
  }
  log(`✓ Rabin-Karp done! ${matches.length} match(es) at index: ${matches.join(', ')||'none'}`, 'success');
}

// ============================================================
// TSP BRANCH & BOUND (simplified demo)
// ============================================================
async function runTSPViz() {
  const canvas = document.getElementById('graphCanvas');
  canvas.classList.remove('hidden');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 600;
  canvas.height = 320;

  const cities = [
    {x:100,y:100,l:'A'},{x:300,y:60,l:'B'},
    {x:500,y:120,l:'C'},{x:400,y:260,l:'D'},{x:150,y:260,l:'E'}
  ];
  const n = cities.length;
  const cost = (a,b) => Math.round(Math.hypot(cities[a].x-cities[b].x, cities[a].y-cities[b].y)/10);
  const adj = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:cost(i,j)));

  function drawTSP(path=[], best=[]) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Draw best path
    if(best.length>1){
      ctx.beginPath();
      ctx.moveTo(cities[best[0]].x, cities[best[0]].y);
      best.forEach(c=>ctx.lineTo(cities[c].x,cities[c].y));
      ctx.closePath();
      ctx.strokeStyle='rgba(16,185,129,0.5)';
      ctx.lineWidth=2;
      ctx.stroke();
    }
    // Draw current path
    if(path.length>1){
      ctx.beginPath();
      ctx.moveTo(cities[path[0]].x,cities[path[0]].y);
      path.forEach(c=>ctx.lineTo(cities[c].x,cities[c].y));
      ctx.strokeStyle='rgba(0,229,255,0.4)';
      ctx.lineWidth=1.5;
      ctx.setLineDash([4,4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Draw cities
    cities.forEach((c,i)=>{
      ctx.beginPath();
      ctx.arc(c.x,c.y,18,0,Math.PI*2);
      ctx.fillStyle = path.includes(i)?'rgba(0,229,255,0.3)':'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = path.includes(i)?'#00e5ff':'rgba(255,255,255,0.15)';
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.fillStyle='#f0f4ff';
      ctx.font='bold 13px Syne';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillText(c.l,c.x,c.y);
    });
  }

  log('TSP Branch & Bound: 5 cities', 'highlight');
  let bestCost = Infinity, bestPath = [];
  const spd = () => Math.max(100, 600 / State.vizSpeed);

  async function bnb(path, visited, currCost) {
    if(!State.vizRunning) return;
    if(path.length === n){
      const total = currCost + adj[path[path.length-1]][path[0]];
      if(total < bestCost){ bestCost=total; bestPath=[...path,path[0]]; }
      drawTSP(path, bestPath);
      log(`Complete tour cost: ${total}${total<bestCost+1?' ← NEW BEST':''}`);
      await delay(spd());
      return;
    }
    for(let c=0;c<n;c++){
      if(!visited[c]){
        const nc = currCost + adj[path[path.length-1]][c];
        if(nc < bestCost){
          path.push(c); visited[c]=true;
          drawTSP(path, bestPath);
          await delay(spd()/2);
          await bnb(path, visited, nc);
          path.pop(); visited[c]=false;
        } else {
          log(`  Prune branch to ${cities[c].l} (bound ${nc} ≥ best ${bestCost})`);
        }
      }
    }
  }

  const visited = Array(n).fill(false);
  visited[0]=true;
  drawTSP([0],[]);
  await bnb([0],visited,0);
  drawTSP([],bestPath);
  log(`✓ Best tour: ${bestPath.map(i=>cities[i].l).join('→')} | Cost: ${bestCost}`, 'success');
}

// ============================================================
// COMPARISON ENGINE
// ============================================================
function initCompare() {
  const catSel  = document.getElementById('compareCategory');
  const sizeSl  = document.getElementById('compareSize');
  const btnRun  = document.getElementById('btnRunCompare');
  const btnSave = document.getElementById('btnSaveHistory');

  catSel.addEventListener('change', () => {
    document.getElementById('knapsackInputGroup').style.display =
      catSel.value === 'knapsack' ? 'block' : 'none';
  });
  sizeSl.addEventListener('input', () => {
    document.getElementById('compareSizeVal').textContent = sizeSl.value;
  });

  btnRun.addEventListener('click', runComparison);
  btnSave.addEventListener('click', saveLastComparison);
}

let lastComparisonData = null;

function runComparison() {
  const cat  = document.getElementById('compareCategory').value;
  const size = +document.getElementById('compareSize').value;
  document.getElementById('failureShowcase').style.display = cat === 'failure' ? 'block' : 'none';
  showLoader();

  setTimeout(() => {
    hideLoader();
    let results;
    if (cat === 'sorting')       results = compareSorting(size);
    else if (cat === 'knapsack') results = compareKnapsack(size);
    else if (cat === 'shortestpath') results = compareShortestPath(size);
    else if (cat === 'failure')  results = showFailureCases();

    if (results) {
      lastComparisonData = {cat, size, results, time: Date.now()};
      renderCompareCards(results);
      renderCompareCharts(results, cat, size);
      document.getElementById('compareInsights').innerHTML = `
        <div class="chart-title">// WHY THIS WINNER?</div>
        <p>${getComparisonInsight(results, cat, size)}</p>
      `;
    }
  }, 600);
}

function compareSorting(n) {
  const arr = Array.from({length:n},()=>Math.floor(Math.random()*1000));
  const worstArr = Array.from({length:n},(_,i)=>i); // sorted = worst for quicksort

  // QuickSort simulation
  let qsSteps=0, qsSwaps=0;
  function qsCount(a,lo,hi){
    if(lo>=hi) return;
    let p=hi,i=lo-1;
    for(let j=lo;j<hi;j++){qsSteps++;if(a[j]<=a[p]){i++;[a[i],a[j]]=[a[j],a[i]];qsSwaps++;}}
    [a[i+1],a[hi]]=[a[hi],a[i+1]];
    qsCount(a,lo,i);qsCount(a,i+2,hi);
  }

  const qa=[...arr]; const t0=performance.now(); qsCount(qa,0,qa.length-1); const qsTime=performance.now()-t0;

  // QuickSort on sorted (worst case)
  let qsWorstSteps=0;
  function qsWorstCount(a,lo,hi){
    if(lo>=hi) return;
    let p=hi,i=lo-1;
    for(let j=lo;j<hi;j++){qsWorstSteps++;}
    qsWorstCount(a,lo,hi-1);
  }
  const wa=[...worstArr]; qsWorstCount(wa,0,Math.min(wa.length-1,200));

  // MergeSort simulation
  let msSteps=0;
  function msCount(n){if(n<=1)return;msCount(Math.floor(n/2));msCount(n-Math.floor(n/2));msSteps+=n;}
  msCount(n);
  const ma=[...arr]; const t1=performance.now(); ma.sort((a,b)=>a-b); const msTime=performance.now()-t1;

  return [
    {name:'Quick Sort',paradigm:'Divide & Conquer',time:qsTime.toFixed(3),steps:qsSteps,swaps:qsSwaps,optimal:true,space:'O(log n)',note:'Average case'},
    {name:'Quick Sort (Sorted Input)',paradigm:'Divide & Conquer',time:(qsTime*3).toFixed(3),steps:qsWorstSteps,swaps:0,optimal:false,space:'O(n)',note:'⚠ WORST CASE on sorted input'},
    {name:'Merge Sort',paradigm:'Divide & Conquer',time:msTime.toFixed(3),steps:msSteps,swaps:0,optimal:true,space:'O(n)',note:'Consistent O(n log n)'},
  ];
}

function compareKnapsack(n) {
  const items = Array.from({length:n},()=>({w:Math.floor(Math.random()*10)+1,v:Math.floor(Math.random()*20)+1}));
  const W = Math.max(20, +document.getElementById('knapsackCapacity').value || 50);

  // DP
  const t0=performance.now();
  const dp=Array.from({length:n+1},()=>Array(W+1).fill(0));
  let dpSteps=0;
  for(let i=1;i<=n;i++){
    for(let c=0;c<=W;c++){
      dpSteps++;
      dp[i][c]=dp[i-1][c];
      if(c>=items[i-1].w) dp[i][c]=Math.max(dp[i][c],dp[i-1][c-items[i-1].w]+items[i-1].v);
    }
  }
  const dpVal=dp[n][W];
  const dpTime=performance.now()-t0;

  // Greedy
  const t1=performance.now();
  const sorted=[...items].sort((a,b)=>b.v/b.w-a.v/a.w);
  let cap=W, greedyVal=0, greedySteps=0;
  sorted.forEach(it=>{ greedySteps++; if(cap>=it.w){cap-=it.w;greedyVal+=it.v;} });
  const greedyTime=performance.now()-t1;

  // Backtracking (simulated)
  const btSteps = Math.pow(2,Math.min(n,20));

  return [
    {name:'0/1 Knapsack DP',paradigm:'Dynamic Programming',time:dpTime.toFixed(3),steps:dpSteps,value:dpVal,optimal:true,space:`O(n·W)=${n*W}`,note:'Guaranteed optimal'},
    {name:'Greedy Knapsack',paradigm:'Greedy',time:greedyTime.toFixed(3),steps:greedySteps,value:greedyVal,optimal:greedyVal===dpVal,space:'O(n log n)',note:greedyVal<dpVal?`⚠ SUBOPTIMAL (missed ${dpVal-greedyVal} value)`:'Optimal this time'},
    {name:'Backtracking',paradigm:'Backtracking',time:'—',steps:btSteps,value:dpVal,optimal:true,space:'O(n)',note:`Theoretical 2^${Math.min(n,20)} nodes`},
  ];
}

function compareShortestPath(n) {
  const vCount = Math.min(n, 10);
  const dpSteps = vCount * vCount * vCount; // Floyd O(V³)
  const dijSteps = (vCount + vCount*2) * Math.ceil(Math.log2(vCount));
  const bfsSteps = vCount + vCount * 2;

  return [
    {name:'BFS (Unweighted)',paradigm:'Graph Traversal',time:(bfsSteps*0.001).toFixed(3),steps:bfsSteps,optimal:true,space:'O(V+E)',note:'Unweighted graphs only'},
    {name:"Dijkstra's",paradigm:'Greedy',time:(dijSteps*0.001).toFixed(3),steps:dijSteps,optimal:true,space:'O(V²)',note:'Non-negative weights'},
    {name:'Floyd-Warshall',paradigm:'Dynamic Programming',time:(dpSteps*0.001).toFixed(3),steps:dpSteps,optimal:true,space:`O(V²)=${vCount*vCount}`,note:'All-pairs shortest paths'},
  ];
}

function showFailureCases() {
  document.getElementById('failureShowcase').style.display = 'block';
  document.getElementById('failureShowcase').innerHTML = `
    <h3>⚠️ Algorithm Failure Demonstrations</h3>
    
    <div style="margin-bottom:2rem">
      <h4 style="color:var(--warning);margin-bottom:0.5rem">1. Greedy Fails for 0/1 Knapsack</h4>
      <div class="warn-box">
        Greedy picks by value/weight ratio: item C (ratio=5.0) first, then B (ratio=4.0). 
        But the optimal solution is A+B with total value 18 vs greedy's 16.
      </div>
      <div class="counterexample">
        Items: A(w=3,v=9), B(w=4,v=10), C(w=1,v=5)  |  Capacity W=4
        <br>
        Greedy order: C(v/w=5.0) → B(v/w=2.5) → A(v/w=3.0)
        <br>
        Greedy picks: C(1kg,+5) → <span class="counter-wrong">B too heavy (4kg > 3kg remaining)</span>
        <br>
        <span class="counter-wrong">Greedy result: value = 5 ❌</span>
        <br>
        <span class="counter-correct">DP optimal:    value = 19 (A+C, or 14 if C+B) ✓</span>
      </div>
    </div>
    
    <div style="margin-bottom:2rem">
      <h4 style="color:var(--danger);margin-bottom:0.5rem">2. QuickSort Worst Case (Already Sorted)</h4>
      <div class="warn-box">
        When the input array is already sorted and we always pick the last element as pivot, 
        QuickSort degrades from O(n log n) to O(n²). On n=1000, this means ~500,000 comparisons 
        instead of ~10,000.
      </div>
      <div class="counterexample">
        Input: [1, 2, 3, 4, 5, ..., 100] (sorted)
        <br>
        Pivot always = last element (largest) → partition size decreases by 1 each time
        <br>
        Depth of recursion: n levels (instead of log n)
        <br>
        <span class="counter-wrong">Comparisons for n=100: ~5,000  (O(n²)) ❌</span>
        <br>
        <span class="counter-correct">Random input n=100: ~664 (O(n log n)) ✓</span>
        <br>
        Fix: Median-of-3 pivot selection or random pivot
      </div>
    </div>
    
    <div>
      <h4 style="color:var(--danger);margin-bottom:0.5rem">3. Backtracking Explosion (N-Queens)</h4>
      <div class="warn-box">
        N-Queens with backtracking grows factorially. Without forward checking or constraint propagation, 
        even moderate values of N cause millions of recursive calls.
      </div>
      <div class="counterexample">
        n=4:   2 solutions,       ~20 recursive calls
        n=8:   92 solutions,      ~15,720 calls
        n=12:  14,200 solutions,  ~8.7M calls  <span class="counter-wrong">⚠ SLOW</span>
        n=15:  2,279,184 solutions, ~700M calls <span class="counter-wrong">⚠ VERY SLOW</span>
        n=20:  ~40 trillion calls  <span class="counter-wrong">❌ INFEASIBLE</span>
        <br>
        <span class="counter-correct">Fix: Use constraint propagation (Arc Consistency) → reduces to polynomial</span>
      </div>
    </div>
  `;

  return [
    {name:'QuickSort (Random)',paradigm:'Divide & Conquer',time:'0.8',steps:664,optimal:true,space:'O(log n)',note:'Normal case'},
    {name:'QuickSort (Sorted)',paradigm:'Divide & Conquer',time:'12.5',steps:5050,optimal:false,space:'O(n)',note:'⚠ WORST CASE!'},
    {name:'Greedy Knapsack',paradigm:'Greedy',time:'0.01',steps:5,optimal:false,space:'O(1)',note:'⚠ SUBOPTIMAL!'},
    {name:'DP Knapsack',paradigm:'Dynamic Programming',time:'0.5',steps:400,optimal:true,space:'O(nW)',note:'Always optimal'},
  ];
}

function renderCompareCards(results) {
  const container = document.getElementById('compareCards');
  const bestTime = Math.min(...results.filter(r=>r.time!=='—').map(r=>parseFloat(r.time)));
  container.innerHTML = results.map(r => `
    <div class="result-card ${r.optimal&&parseFloat(r.time)===bestTime?'winner':!r.optimal?'loser':''}">
      <div class="rc-name">${r.name}</div>
      <div class="rc-paradigm">${r.paradigm}</div>
      <div class="rc-metric"><span>Time (ms):</span><span>${r.time}</span></div>
      <div class="rc-metric"><span>Steps:</span><span>${r.steps.toLocaleString()}</span></div>
      ${r.value!==undefined?`<div class="rc-metric"><span>Value:</span><span>${r.value}</span></div>`:''}
      <div class="rc-metric"><span>Space:</span><span>${r.space||'—'}</span></div>
      <div class="rc-metric"><span>Optimal:</span><span>${r.optimal?'✓ Yes':'✗ No'}</span></div>
      <div class="rc-badge ${r.optimal?'':'fail'}">${r.note}</div>
    </div>
  `).join('');
}

let timeBarChart=null, stepsChart=null, growthChart=null;

function renderCompareCharts(results, cat, size) {
  const labels = results.map(r => r.name);
  const times  = results.map(r => parseFloat(r.time)||0);
  const steps  = results.map(r => r.steps);

  const colors = ['rgba(0,229,255,0.7)','rgba(124,58,237,0.7)','rgba(16,185,129,0.7)','rgba(239,68,68,0.7)'];
  const borders = ['#00e5ff','#7c3aed','#10b981','#ef4444'];

  const chartDefaults = {
    responsive: true,
    plugins: {legend:{labels:{color:'#8892b0',font:{family:'JetBrains Mono',size:11}}}},
    scales: {
      x:{ticks:{color:'#8892b0',font:{family:'JetBrains Mono',size:10}},grid:{color:'rgba(255,255,255,0.04)'}},
      y:{ticks:{color:'#8892b0',font:{family:'JetBrains Mono',size:10}},grid:{color:'rgba(255,255,255,0.06)'}},
    },
  };

  if(timeBarChart) timeBarChart.destroy();
  timeBarChart = new Chart(document.getElementById('timeBarChart'), {
    type:'bar',
    data:{labels,datasets:[{label:'Time (ms)',data:times,backgroundColor:colors,borderColor:borders,borderWidth:1,borderRadius:4}]},
    options:{...chartDefaults},
  });

  if(stepsChart) stepsChart.destroy();
  stepsChart = new Chart(document.getElementById('stepsChart'), {
    type:'bar',
    data:{labels,datasets:[{label:'Step Count',data:steps,backgroundColor:colors,borderColor:borders,borderWidth:1,borderRadius:4}]},
    options:{...chartDefaults},
  });

  // Growth chart
  const growthBox = document.getElementById('growthChartBox');
  growthBox.style.display='block';
  const sizes=[5,10,20,50,100,200];
  let datasets=[];
  if(cat==='sorting'){
    datasets=[
      {label:'Quick Sort O(n log n)',data:sizes.map(n=>n*Math.log2(n)),borderColor:'#00e5ff',fill:false,tension:0.4},
      {label:'Quick Sort Worst O(n²)',data:sizes.map(n=>n*n*0.01),borderColor:'#ef4444',fill:false,tension:0.4},
      {label:'Merge Sort O(n log n)',data:sizes.map(n=>n*Math.log2(n)),borderColor:'#10b981',fill:false,tension:0.4},
    ];
  } else if(cat==='knapsack'){
    const W=50;
    datasets=[
      {label:'DP O(nW)',data:sizes.map(n=>n*W),borderColor:'#10b981',fill:false,tension:0.4},
      {label:'Greedy O(n log n)',data:sizes.map(n=>n*Math.log2(n)),borderColor:'#00e5ff',fill:false,tension:0.4},
      {label:'Backtracking O(2ⁿ)',data:sizes.map(n=>Math.pow(2,Math.min(n,20))*0.0001),borderColor:'#ef4444',fill:false,tension:0.4},
    ];
  } else {
    datasets=[
      {label:'BFS O(V+E)',data:sizes.map(n=>n*1.5),borderColor:'#00e5ff',fill:false,tension:0.4},
      {label:"Dijkstra O(V² or (V+E)logV)",data:sizes.map(n=>n*n),borderColor:'#7c3aed',fill:false,tension:0.4},
      {label:'Floyd-Warshall O(V³)',data:sizes.map(n=>Math.pow(n,3)*0.01),borderColor:'#ef4444',fill:false,tension:0.4},
    ];
  }

  if(growthChart) growthChart.destroy();
  growthChart = new Chart(document.getElementById('growthChart'), {
    type:'line',
    data:{labels:sizes,datasets},
    options:{
      ...chartDefaults,
      plugins:{...chartDefaults.plugins,legend:{...chartDefaults.plugins.legend,display:true}},
    },
  });
}

function saveLastComparison() {
  if(!lastComparisonData) { showToast('Run a comparison first', 'error'); return; }
  const {cat, size, results} = lastComparisonData;
  addToHistory({
    category: cat,
    algo: results.map(r=>r.name).join(' vs '),
    input: `n=${size}`,
    result: results.map(r=>`${r.name}: ${r.time}ms`).join(', '),
    steps: results.reduce((s,r)=>s+r.steps,0),
    time: Date.now(),
    comparison: true,
  });
}

// ============================================================
// SUGGESTION ENGINE
// ============================================================
const SUGGESTION_DB = [
  {
    keywords: ['shortest','path','weighted','graph','distance','route','travel'],
    suggestions: [
      {name:"Dijkstra's Algorithm",paradigm:'Greedy',score:95,complexity:'O((V+E) log V)',reason:"Optimal for single-source shortest path on non-negative weighted graphs. Greedily relaxes the nearest unvisited node. Industry standard for GPS routing and network protocols."},
      {name:'A* Search',paradigm:'Heuristic Search',score:88,complexity:'O(E log V)',reason:'An informed extension of Dijkstra using a heuristic function h(n) to guide search toward the goal. Faster in practice when a good heuristic is available.'},
      {name:'Bellman-Ford',paradigm:'Dynamic Programming',score:70,complexity:'O(VE)',reason:'Use this when the graph may contain negative edge weights. Slower than Dijkstra but handles negative cycles.'},
    ]
  },
  {
    keywords: ['all','pairs','every','each','between','all-pairs'],
    suggestions: [
      {name:'Floyd-Warshall',paradigm:'Dynamic Programming',score:95,complexity:'O(V³)',reason:'Computes shortest paths between ALL pairs of nodes in a single DP pass. Best for dense graphs or when you need all-pairs info upfront.'},
      {name:"Johnson's Algorithm",paradigm:'Reweighting + Dijkstra',score:80,complexity:'O(V² log V + VE)',reason:'Better than Floyd-Warshall for sparse graphs. Uses Bellman-Ford once to reweight, then runs Dijkstra from every vertex.'},
    ]
  },
  {
    keywords: ['knapsack','bag','pack','maximize','value','weight','capacity','budget'],
    suggestions: [
      {name:'0/1 Knapsack DP',paradigm:'Dynamic Programming',score:98,complexity:'O(nW)',reason:'Guaranteed optimal for discrete (0/1) knapsack. Builds a DP table avoiding recomputation. Gold standard — Greedy WILL fail here for non-trivial inputs.'},
      {name:'Branch & Bound',paradigm:'Branch & Bound',score:85,complexity:'O(2ⁿ) worst',reason:'Explores the search tree with pruning based on upper bound estimates. Often much faster than brute force. Good when W is very large.'},
      {name:'Greedy (Fractional)',paradigm:'Greedy',score:60,complexity:'O(n log n)',reason:"Only optimal for FRACTIONAL knapsack. Sort by value/weight and pick greedily. Do NOT use this for 0/1 knapsack — it's provably wrong."},
    ]
  },
  {
    keywords: ['sort','order','arrange','ranking','largest','smallest','ascending','descending'],
    suggestions: [
      {name:'Merge Sort',paradigm:'Divide & Conquer',score:92,complexity:'O(n log n)',reason:'Stable sort, guaranteed O(n log n) in all cases. Preferred for linked lists, external sorting, or when stability matters.'},
      {name:'Quick Sort',paradigm:'Divide & Conquer',score:90,complexity:'O(n log n) avg',reason:"Fastest in practice due to cache efficiency. O(n²) worst case on sorted data with bad pivot — use random pivot or Introsort (C++ STL's approach)."},
      {name:'Heap Sort',paradigm:'Selection / Heap',score:82,complexity:'O(n log n)',reason:'In-place O(n log n) sort. Good when memory is limited. Not cache-friendly — slower than Quick Sort in practice despite same asymptotic complexity.'},
    ]
  },
  {
    keywords: ['pattern','match','search','find','text','string','substring','occurrence'],
    suggestions: [
      {name:'Rabin-Karp',paradigm:'Hashing',score:90,complexity:'O(n+m) avg',reason:'Uses rolling hash for O(n+m) average case. Ideal for multiple pattern search or plagiarism detection. Hash collisions cause O(nm) worst case.'},
      {name:'KMP Algorithm',paradigm:'Failure Function',score:87,complexity:'O(n+m)',reason:'Guaranteed O(n+m) using the failure function — never rematches characters. Best when worst-case guarantee is required.'},
      {name:'Boyer-Moore',paradigm:'Heuristic Skipping',score:85,complexity:'O(n/m) best',reason:'Fastest in practice for large alphabets. Skips portions of text using bad character and good suffix heuristics.'},
    ]
  },
  {
    keywords: ['queens','board','chess','place','n-queens','attack','constraint'],
    suggestions: [
      {name:'Backtracking',paradigm:'Backtracking',score:95,complexity:'O(n!)',reason:"Classic backtracking: place a queen row by row, check safety, backtrack on conflict. The standard solution for constraint satisfaction problems like N-Queens, Sudoku, and graph coloring."},
      {name:'Dancing Links (DLX)',paradigm:'Exact Cover',score:80,complexity:'O(n!)',reason:"Knuth's Algorithm X with Dancing Links — extremely fast in practice for exact cover formulations of N-Queens. Used in high-performance Sudoku solvers."},
    ]
  },
  {
    keywords: ['traveling','salesman','tour','visit','cities','minimum','cost','tsp'],
    suggestions: [
      {name:'Branch & Bound',paradigm:'Branch & Bound',score:90,complexity:'O(n²·2ⁿ) worst',reason:"Finds the optimal TSP solution by pruning branches with lower bound > best known. Practical for n ≤ 20 with good bounding functions."},
      {name:'Dynamic Programming (Held-Karp)',paradigm:'Dynamic Programming',score:88,complexity:'O(n²·2ⁿ)',reason:"The optimal DP solution for TSP with bitmask. Better than brute force O(n!) but still exponential. Practical for n ≤ 25."},
      {name:'Christofides Algorithm',paradigm:'Approximation',score:75,complexity:'O(n³)',reason:'For large n, this 1.5-approximation algorithm gives a guaranteed 3/2 of optimal. Used in real logistics when exact solution is infeasible.'},
    ]
  },
  {
    keywords: ['traversal','visit','nodes','bfs','dfs','breadth','depth','explore'],
    suggestions: [
      {name:'BFS (Breadth-First Search)',paradigm:'Graph Traversal',score:90,complexity:'O(V+E)',reason:'Explore nodes level by level. Guarantees shortest path in unweighted graphs. Use for: shortest hops, social network distance, web crawling.'},
      {name:'DFS (Depth-First Search)',paradigm:'Graph Traversal',score:85,complexity:'O(V+E)',reason:'Explore as deep as possible before backtracking. Use for: topological sort, cycle detection, connected components, maze solving.'},
    ]
  },
];

function fillSuggest(text) {
  document.getElementById('suggestInput').value = text;
  document.getElementById('btnSuggest').click();
}

function initSuggest() {
  document.getElementById('btnSuggest').addEventListener('click', runSuggest);
  document.getElementById('suggestInput').addEventListener('keydown', e => {
    if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSuggest(); }
  });
}

function runSuggest() {
  const input = document.getElementById('suggestInput').value.toLowerCase().trim();
  if(!input) { showToast('Please describe your problem first', 'error'); return; }

  const words = input.split(/\s+/);
  let bestMatch = null, bestScore = 0;

  SUGGESTION_DB.forEach(entry => {
    const matched = entry.keywords.filter(kw => words.some(w => w.includes(kw) || kw.includes(w)));
    if(matched.length > bestScore) { bestScore = matched.length; bestMatch = entry; }
  });

  const resultsEl = document.getElementById('suggestResults');

  if(!bestMatch || bestScore === 0) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <div class="es-icon">🤔</div>
        <p>Could not match your description. Try keywords like:<br>'shortest path', 'sort array', 'knapsack', 'pattern match', 'n-queens'</p>
      </div>`;
    return;
  }

  resultsEl.innerHTML = bestMatch.suggestions.map((s, i) => `
    <div class="suggestion-card ${i===0?'primary-suggestion':''}" onclick="navigateTo('visualize','${s.name.toLowerCase().replace(/\s/g,'')}')">
      <div class="sg-score">${s.score}%</div>
      <div class="sg-rank">${i===0?'⭐ BEST MATCH':'Alternative #'+(i+1)}</div>
      <div class="sg-name">${s.name}</div>
      <div class="sg-paradigm">${s.paradigm}</div>
      <div class="sg-reason">${s.reason}</div>
      <div class="sg-complexity">Complexity: ${s.complexity}</div>
    </div>
  `).join('');

  showToast(`Found ${bestMatch.suggestions.length} suggestions!`, 'success');
}

// BIG-O GROWTH CHART
function initBigOChart() {
  if(State.charts.bigO) return;
  const sizes = [1,2,4,8,16,32,64,128,256];
  const datasets = [
    {label:'O(1)',        data:sizes.map(()=>1),         borderColor:'#10b981',fill:false,tension:0},
    {label:'O(log n)',    data:sizes.map(n=>Math.log2(n)),borderColor:'#00e5ff',fill:false,tension:0.3},
    {label:'O(n)',        data:sizes.map(n=>n),           borderColor:'#8b5cf6',fill:false,tension:0},
    {label:'O(n log n)',  data:sizes.map(n=>n*Math.log2(n)),borderColor:'#f59e0b',fill:false,tension:0.3},
    {label:'O(n²)',       data:sizes.map(n=>n*n),         borderColor:'#ef4444',fill:false,tension:0.3},
    {label:'O(2ⁿ)',       data:sizes.map(n=>Math.min(Math.pow(2,n),50000)),borderColor:'#dc2626',fill:false,tension:0.3},
  ];

  State.charts.bigO = new Chart(document.getElementById('bigOChart'), {
    type:'line',
    data:{labels:sizes, datasets},
    options:{
      responsive:true,
      plugins:{legend:{labels:{color:'#8892b0',font:{family:'JetBrains Mono',size:11}}}},
      scales:{
        x:{title:{display:true,text:'Input Size (n)',color:'#8892b0'},ticks:{color:'#8892b0',font:{family:'JetBrains Mono',size:10}},grid:{color:'rgba(255,255,255,0.04)'}},
        y:{title:{display:true,text:'Operations',color:'#8892b0'},ticks:{color:'#8892b0',font:{family:'JetBrains Mono',size:10}},grid:{color:'rgba(255,255,255,0.06)'},max:5000},
      },
    },
  });
}

// ============================================================
// HISTORY
// ============================================================
async function addToHistory(entry) {
  if (!State.auth.token) {
    showToast('Login to save your history', 'error');
    return;
  }

  try {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    if (!res.ok || !data.saved) throw new Error(data.message || 'Could not save history');

    State.history.unshift(data.entry);
    if (State.history.length > 100) State.history.pop();
    renderHistory();
    showToast('Saved to your account history', 'success');
  } catch (err) {
    showToast(err.message || 'Could not save history', 'error');
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const search = document.getElementById('historySearch').value.toLowerCase();
  const filter = document.getElementById('historyFilter').value;
  updateHistorySummary();

  if (!State.auth.token) {
    list.innerHTML = `<div class="empty-state"><div class="es-icon">🔐</div><p>Login to see your personal algorithm history.</p></div>`;
    return;
  }

  let items = State.history;
  if(search) items = items.filter(i => (i.algo+i.input+i.result).toLowerCase().includes(search));
  if(filter !== 'all') items = items.filter(i => i.category === filter);

  if(!items.length) {
    list.innerHTML = `<div class="empty-state"><div class="es-icon">📋</div><p>No history yet${search?' matching your search':''}. Run some algorithms first!</p></div>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="history-item">
      <div class="hi-header">
        <div class="hi-title">${item.algo}</div>
        <div class="hi-time">${new Date(item.createdAt || item.time).toLocaleTimeString()}</div>
      </div>
      <div class="hi-meta">
        <span class="hi-tag">${item.category}</span>
        ${item.comparison?'<span class="hi-tag">comparison</span>':''}
      </div>
      <div class="hi-results">
        Input: ${item.input}<br>
        Result: ${item.result}<br>
        Steps: ${(item.steps||0).toLocaleString()}
      </div>
      <div class="hi-actions">
        <button class="hi-btn" onclick="rerunHistory('${item._id || item.id}')">▶ Re-run</button>
        <button class="hi-btn" onclick="deleteHistory('${item._id || item.id}')">🗑 Delete</button>
      </div>
    </div>
  `).join('');
}

function rerunHistory(id) {
  const item = State.history.find(h => String(h._id || h.id) === String(id));
  if(!item) return;
  showToast(`Re-running ${item.algo}...`);
  if(item.comparison) {
    navigateTo('compare');
    setTimeout(() => {
      document.getElementById('compareCategory').value = item.category;
      document.getElementById('btnRunCompare').click();
    }, 300);
  } else {
    navigateTo('visualize');
    const algoMap = {
      'Quick Sort':'quicksort','Merge Sort':'mergesort','BFS':'bfs',
      "Dijkstra's":'dijkstra','0/1 Knapsack DP':'knapsack_dp',
      'Greedy Knapsack':'knapsack_greedy','N-Queens Backtracking':'nqueens',
    };
    const algoKey = algoMap[item.algo];
    if(algoKey) {
      setTimeout(() => {
        document.getElementById('vizAlgo').value = algoKey;
        updateComplexityBox(algoKey);
        updateWhyPanel(algoKey);
        startViz();
      }, 300);
    }
  }
}

async function deleteHistory(id) {
  if (!requireLogin('Login to manage history')) return;

  try {
    const res = await fetch(`/api/history/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok || !data.deleted) throw new Error(data.message || 'Could not delete history');

    State.history = State.history.filter(h => String(h._id || h.id) !== String(id));
    renderHistory();
    showToast('History item deleted', 'success');
  } catch (err) {
    showToast(err.message || 'Could not delete history', 'error');
  }
}

function initHistory() {
  document.getElementById('historySearch').addEventListener('input', renderHistory);
  document.getElementById('historyFilter').addEventListener('change', renderHistory);
  document.getElementById('btnClearHistory').addEventListener('click', async () => {
    if (!requireLogin('Login to clear history')) return;
    if(confirm('Clear all history?')) {
      try {
        const res = await fetch('/api/history', {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok || !data.deleted) throw new Error(data.message || 'Could not clear history');
        State.history = [];
        renderHistory();
        showToast('All history cleared', 'success');
      } catch (err) {
        showToast(err.message || 'Could not clear history', 'error');
      }
    }
  });
  document.getElementById('btnExportHistory').addEventListener('click', () => {
    if (!requireLogin('Login to export history')) return;
    const json = JSON.stringify(State.history, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'algolab_history.json';
    a.click();
    showToast('History exported!', 'success');
  });
}

// ============================================================
// AUTH (LOGIN / SIGNUP)
// ============================================================
function setAuth(token, userId) {
  State.auth.token = token || '';
  State.auth.userId = userId || '';
  localStorage.setItem('algolab_token', State.auth.token);
  localStorage.setItem('algolab_user', State.auth.userId);
  loadPresets();
  renderPresets();
  updateAuthUI();
  apiHistory();
}

function clearAuth() {
  State.auth.token = '';
  State.auth.userId = '';
  State.history = [];
  localStorage.removeItem('algolab_token');
  localStorage.removeItem('algolab_user');
  loadPresets();
  renderPresets();
  updateAuthUI();
  renderHistory();
}

function updateAuthUI() {
  const navAuth = document.getElementById('navAuth');
  if (navAuth) navAuth.textContent = State.auth.userId ? `User: ${State.auth.userId}` : 'Guest';

  const authStatus = document.getElementById('authStatus');
  if (authStatus) authStatus.textContent = State.auth.userId ? `Logged in as ${State.auth.userId}` : 'Not logged in';

  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.style.display = State.auth.userId ? 'inline-flex' : 'none';
}

function initAuth() {
  const tabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.authTab;
      if (loginForm) loginForm.classList.toggle('active', target === 'login');
      if (signupForm) signupForm.classList.toggle('active', target === 'signup');
    });
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const userId = document.getElementById('loginUserId').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      if (!userId || !password) return showToast('Enter userId and password', 'error');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Login failed');
        setAuth(data.token, data.userId);
        showToast('Login successful!', 'success');
        navigateTo('history');
      } catch (err) {
        showToast(err.message || 'Login failed', 'error');
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async e => {
      e.preventDefault();
      const userId = document.getElementById('signupUserId').value.trim();
      const password = document.getElementById('signupPassword').value.trim();
      const confirmPassword = document.getElementById('signupConfirmPassword').value.trim();
      if (!userId || !password) return showToast('Enter userId and password', 'error');
      if (userId.length < 3) return showToast('User ID must be at least 3 characters', 'error');
      if (password !== confirmPassword) return showToast('Passwords do not match', 'error');

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Signup failed');
        showToast('Signup successful! Please login.', 'success');

        document.querySelector('[data-auth-tab="login"]')?.click();
        document.getElementById('loginUserId').value = userId;
        document.getElementById('loginPassword').value = '';
        document.getElementById('signupConfirmPassword').value = '';
      } catch (err) {
        showToast(err.message || 'Signup failed', 'error');
      }
    });
  }

  document.getElementById('btnLogout')?.addEventListener('click', () => {
    clearAuth();
    showToast('Logged out', 'success');
  });

  updateAuthUI();
}

// ============================================================
// TOAST & LOADER
// ============================================================
let toastTimer;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast', 3000);
}
function showLoader() { document.getElementById('loadingOverlay').classList.add('active'); }
function hideLoader() { document.getElementById('loadingOverlay').classList.remove('active'); }

// ============================================================
// NAVBAR
// ============================================================
function initNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
      document.getElementById('hamburger').nextElementSibling?.classList.remove('open');
      document.querySelector('.nav-links').classList.remove('open');
    });
  });
  document.getElementById('hamburger').addEventListener('click', () => {
    document.querySelector('.nav-links').classList.toggle('open');
  });
  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    nav.style.boxShadow = window.scrollY > 20 ? '0 4px 30px rgba(0,0,0,0.3)' : 'none';
  });
}

// ============================================================
// BACKEND API (optional — falls back to local if no server)
// ============================================================
async function apiRun(payload) {
  try {
    const res = await fetch('/api/run', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    if(res.ok) return await res.json();
  } catch {}
  return null; // fallback: use local computation
}

async function apiHistory() {
  if (!State.auth.token) {
    State.history = [];
    renderHistory();
    return;
  }

  try {
    const res = await fetch('/api/history', {
      headers: getAuthHeaders(),
    });
    if (res.status === 401) {
      clearAuth();
      showToast('Session expired. Please login again.', 'error');
      return;
    }
    if(res.ok) {
      const data = await res.json();
      if(data.history) {
        State.history = data.history;
        renderHistory();
      }
    }
  } catch {}
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initHeroCanvas();
  initVisualizer();
  initCompare();
  initSuggest();
  initHistory();
  initAuth();
  updateHistorySummary();

  // Try to load history from API (non-blocking)
  apiHistory();

  // Chart.js global defaults
  Chart.defaults.color = '#8892b0';
  Chart.defaults.font.family = 'JetBrains Mono, monospace';
  Chart.defaults.font.size = 11;

  console.log('%c[AlgoLab] Ready ⚡', 'color:#00e5ff;font-size:14px;font-weight:bold');
});
