/**
 * POST /api/compare
 * Compare multiple algorithms on the same input
 * Body: { category, size, params }
 */

const express = require('express');
const router  = express.Router();
const { connectDB } = require('../db');

router.post('/', async (req, res) => {
  const { category = 'sorting', size = 20, params = {} } = req.body;

  const results = [];
  const t0 = Date.now();

  try {
    if (category === 'sorting') {
      const arr = Array.from({ length: size }, () => Math.floor(Math.random() * 1000));

      // Quick Sort
      let qsSteps = 0;
      function qs(a, lo, hi) {
        if (lo >= hi) return;
        let p = a[hi], i = lo - 1;
        for (let j = lo; j < hi; j++) { qsSteps++; if (a[j] <= p) { i++; [a[i],a[j]]=[a[j],a[i]]; } }
        [a[i+1],a[hi]]=[a[hi],a[i+1]];
        qs(a, lo, i); qs(a, i+2, hi);
      }
      const qa = [...arr]; const qt = process.hrtime.bigint();
      qs(qa, 0, qa.length-1);
      const qTime = Number(process.hrtime.bigint()-qt)/1e6;
      results.push({ name:'Quick Sort', paradigm:'Divide & Conquer', steps:qsSteps, timeMs:qTime.toFixed(4), optimal:true });

      // Merge Sort
      let msSteps = 0;
      function ms(a){
        if(a.length<=1) return a;
        const m=Math.floor(a.length/2);
        const L=ms(a.slice(0,m)),R=ms(a.slice(m));
        const r=[];let i=0,j=0;
        while(i<L.length&&j<R.length){msSteps++;r.push(L[i]<=R[j]?L[i++]:R[j++]);}
        return [...r,...L.slice(i),...R.slice(j)];
      }
      const mt = process.hrtime.bigint();
      ms([...arr]);
      const mTime = Number(process.hrtime.bigint()-mt)/1e6;
      results.push({ name:'Merge Sort', paradigm:'Divide & Conquer', steps:msSteps, timeMs:mTime.toFixed(4), optimal:true });

    } else if (category === 'knapsack') {
      const n = Math.min(size, 30);
      const W = params.capacity || 50;
      const items = Array.from({length:n},()=>({w:Math.floor(Math.random()*10)+1,v:Math.floor(Math.random()*20)+1}));

      // DP
      let dpSteps=0;
      const dp=Array.from({length:n+1},()=>Array(W+1).fill(0));
      const dt=process.hrtime.bigint();
      for(let i=1;i<=n;i++){const{w,v}=items[i-1];for(let c=0;c<=W;c++){dpSteps++;dp[i][c]=dp[i-1][c];if(c>=w)dp[i][c]=Math.max(dp[i][c],dp[i-1][c-w]+v);}}
      const dTime=Number(process.hrtime.bigint()-dt)/1e6;
      results.push({name:'DP Knapsack',paradigm:'Dynamic Programming',steps:dpSteps,timeMs:dTime.toFixed(4),optimal:true,value:dp[n][W]});

      // Greedy
      const sorted=[...items].sort((a,b)=>b.v/b.w-a.v/a.w);
      let cap=W,gVal=0,gSteps=0;
      const gt=process.hrtime.bigint();
      sorted.forEach(it=>{gSteps++;if(cap>=it.w){cap-=it.w;gVal+=it.v;}});
      const gTime=Number(process.hrtime.bigint()-gt)/1e6;
      results.push({name:'Greedy Knapsack',paradigm:'Greedy',steps:gSteps,timeMs:gTime.toFixed(4),optimal:gVal===dp[n][W],value:gVal});
    }

    // Save comparison to MongoDB
    connectDB().then(db => {
      if (!db) return;
      db.collection('comparisons').insertOne({
        category, size, results,
        totalTime: Date.now() - t0,
        createdAt: new Date(),
      }).catch(() => {});
    });

    res.json({ success: true, category, size, results });
  } catch (err) {
    console.error('[/api/compare]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
