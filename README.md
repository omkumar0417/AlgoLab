# 🧠 AlgoLab — Algorithm Strategy Lab

> A production-ready, visually stunning web application for visualizing, comparing, and understanding algorithm paradigms. Built as a final-year DAA project.

---

## 🌐 Live Demo
Deploy to Vercel in 5 minutes (see deployment section below).

---

## 📁 Project Structure

```
algo-lab/
│
├── public/                  # Frontend (static files)
│   ├── index.html           # SPA with all 5 pages
│   ├── styles.css           # Dark glassmorphism theme
│   └── script.js            # All algorithms + visualizations
│
├── api/                     # Express API routes
│   ├── run.js               # POST /api/run
│   ├── compare.js           # POST /api/compare
│   ├── history.js           # GET/POST/DELETE /api/history
│   └── suggest.js           # POST /api/suggest
│
├── server.js                # Express entry point
├── db.js                    # MongoDB Atlas connection
├── package.json
├── vercel.json              # Vercel deployment config
├── .env.example             # Environment variable template
└── README.md
```

---

## ✅ Features Implemented

### 1. Multi-Algorithm Problem Solver
- Sorting: Quick Sort, Merge Sort
- Knapsack: Greedy, DP, Backtracking (simulated)
- Shortest Path: BFS, Dijkstra, Bellman-Ford
- N-Queens: Backtracking
- TSP: Branch & Bound

### 2. Comparison Dashboard
- Side-by-side result cards (winner/loser highlighted)
- Bar chart: Time comparison
- Bar chart: Step count comparison

### 3. Step-by-Step Animated Visualizer
- Sorting: animated bar chart with color states
- Graph: animated BFS/Dijkstra on canvas
- DP: animated table filling
- N-Queens: animated board with backtracking
- Speed control slider (1x–10x)
- Pause/Resume/Step controls

### 4. "Why This Algorithm?" Panel
- Paradigm label for each algorithm
- Plain-English explanation
- Complexity metrics

### 5. Failure Case Demonstrations
- Greedy Knapsack counterexample with exact numbers
- QuickSort O(n²) on sorted input
- Backtracking explosion (N-Queens step count table)

### 6. Complexity Analyzer
- Best/Average/Worst case per algorithm
- Big-O growth comparison chart (all 6 complexities)

### 7. History + MongoDB
- Saves every run to localStorage + MongoDB Atlas
- Filter, search, re-run, delete, export as JSON

### 8. Algorithm Suggestion Engine
- Keyword-based matching from problem description
- Returns ranked suggestions with explanation
- 8 problem categories covered

---

## 🛠 Local Setup

### Prerequisites
- Node.js >= 18
- MongoDB Atlas free tier account

### Steps

```bash
# 1. Clone / unzip the project
cd algo-lab

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your MongoDB Atlas URI

# 4. Start development server
npm run dev
# OR for production:
npm start

# 5. Open browser
open http://localhost:3000
```

---

## 🗄 MongoDB Atlas Setup (Step-by-Step)

1. Go to https://cloud.mongodb.com → Create a free account
2. Create a **Free Cluster** (M0 Sandbox)
3. In Database Access → Add a new user with password
4. In Network Access → Add IP `0.0.0.0/0` (allow all, for Vercel)
5. Click **Connect** → **Connect your application**
6. Copy the connection string:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
   ```
7. Append database name: `algolab?retryWrites=true&w=majority`
8. Paste full URI into your `.env` as `MONGODB_URI`

> **Note:** The app works fully without MongoDB — history is stored in localStorage as a fallback.

---

## 🚀 Vercel Deployment

### Option A: CLI Deployment

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Set environment variable
vercel env add MONGODB_URI
# Paste your MongoDB Atlas connection string

# 5. Redeploy with env
vercel --prod
```

### Option B: GitHub + Vercel Dashboard

1. Push this project to GitHub
2. Go to https://vercel.com → New Project → Import from GitHub
3. Select your repository
4. In **Environment Variables** add:
   - `MONGODB_URI` = your MongoDB Atlas URI
5. Click **Deploy**

### How API Routes Work on Vercel
Vercel reads `vercel.json`:
- `/api/*` requests → routed to `server.js` (Node.js serverless function)
- All other requests → served from `/public/` (static files)

---

## 📡 API Reference

### POST `/api/run`
Execute an algorithm and get metrics.

```json
// Request
{ "algo": "quicksort", "input": [5, 3, 8, 1, 9, 2] }

// Response
{ "success": true, "algo": "quicksort", "result": { "sorted": [...], "steps": 12, "timeMs": "0.0123" } }
```

Supported `algo` values: `quicksort`, `mergesort`, `knapsack_dp`, `dijkstra`

### POST `/api/compare`
Compare algorithms in a category.

```json
// Request
{ "category": "sorting", "size": 50 }

// Response
{ "results": [{ "name": "Quick Sort", "steps": 289, "timeMs": "0.045", "optimal": true }, ...] }
```

### GET `/api/history`
Fetch last 50 saved runs from MongoDB.

### POST `/api/history`
Save a run to MongoDB.

### DELETE `/api/history/:id`
Delete a history entry.

### POST `/api/suggest`
Get algorithm suggestions from a problem description.

```json
// Request  
{ "query": "find shortest path in weighted graph" }

// Response
{ "suggestions": [{ "name": "Dijkstra's", "score": 95, "reason": "..." }, ...] }
```

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Background | `#050810` |
| Glass BG | `rgba(255,255,255,0.04)` |
| Accent (Cyan) | `#00e5ff` |
| Accent (Purple) | `#7c3aed` |
| Success | `#22c55e` |
| Danger | `#ef4444` |
| Font Display | Syne |
| Font Mono | JetBrains Mono |
| Font UI | Space Mono |

---

## 🧪 Algorithm Coverage

| Algorithm | Paradigm | Time | Space | Visualized |
|-----------|----------|------|-------|-----------|
| Quick Sort | D&C | O(n log n) | O(log n) | ✅ Bars |
| Merge Sort | D&C | O(n log n) | O(n) | ✅ Bars |
| BFS | Graph | O(V+E) | O(V) | ✅ Canvas |
| Dijkstra | Greedy | O((V+E)logV) | O(V) | ✅ Canvas |
| Bellman-Ford | DP | O(VE) | O(V) | ✅ Canvas |
| 0/1 Knapsack | DP | O(nW) | O(nW) | ✅ Table |
| Greedy Knapsack | Greedy | O(n log n) | O(1) | ✅ Table |
| N-Queens | Backtracking | O(n!) | O(n) | ✅ Board |
| TSP | Branch & Bound | O(n²·2ⁿ) | O(n²) | ✅ Canvas |
| Huffman Coding | Greedy | O(n log n) | O(n) | ✅ Table |

---

## 📱 Responsive Breakpoints

- Desktop: Full grid layouts
- Tablet (< 900px): Single column, stacked panels
- Mobile (< 600px): Hamburger nav, simplified controls

---

## 🔧 Troubleshooting

**MongoDB connection fails:**
- Check that your IP is whitelisted in Atlas Network Access
- Verify the connection string format
- App degrades gracefully — history saved to localStorage only

**Charts not rendering:**
- Ensure Chart.js CDN is accessible
- Check browser console for errors

**Algorithms running slowly:**
- Reduce input size with the slider
- Increase speed slider to 10x

---

## 📝 License
MIT — Free for educational use.
