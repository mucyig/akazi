/**
 * Akazi Website Traffic Simulation & Performance Benchmark
 * 
 * Simulates real user traffic across the full web stack:
 * - Public browsing & job searching
 * - Single job detail viewing & stats
 * - Frontend Vite bundle serving
 * - Authenticated candidate & employer traffic
 * - Concurrent database connection pool load
 * - Rate limiting enforcement
 * - Malformed / invalid inputs
 */

const { performance } = require('perf_hooks');

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:5173';

function computeStats(latencies) {
  if (!latencies || latencies.length === 0) return { min: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  const p = (pct) => {
    const idx = Math.min(Math.floor((pct / 100) * sorted.length), sorted.length - 1);
    return sorted[idx];
  };
  return {
    count: sorted.length,
    min: Math.round(sorted[0] * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    p50: Math.round(p(50) * 100) / 100,
    p90: Math.round(p(90) * 100) / 100,
    p95: Math.round(p(95) * 100) / 100,
    p99: Math.round(p(99) * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
  };
}

async function runConcurrentBatch(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIdx = index++;
      const taskFn = tasks[currentIdx];
      const start = performance.now();
      try {
        const res = await taskFn();
        const duration = performance.now() - start;
        results[currentIdx] = { ok: true, status: res.status, duration, error: null };
      } catch (err) {
        const duration = performance.now() - start;
        results[currentIdx] = { ok: false, status: 0, duration, error: err.message };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function simulate() {
  console.log('====================================================');
  console.log('AKAZI TRAFFIC SIMULATION & LOAD TEST HARNESS');
  console.log('====================================================');
  console.log(`Backend Target:  ${BACKEND_URL}`);
  console.log(`Frontend Target: ${FRONTEND_URL}`);
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log('----------------------------------------------------\n');

  const overallReport = {};

  // Phase 0: Baseline Health & Connectivity
  console.log('[Phase 0] Checking Base Endpoints & Memory...');
  const memBefore = process.memoryUsage();
  const baseHealth = await fetch(`${BACKEND_URL}/api/health`).then(r => r.json()).catch(e => ({ error: e.message }));
  const baseTime = await fetch(`${BACKEND_URL}/api/time`).then(r => r.json()).catch(e => ({ error: e.message }));
  const baseFrontend = await fetch(`${FRONTEND_URL}`).then(r => ({ status: r.status })).catch(e => ({ error: e.message }));

  console.log('Health:', baseHealth);
  console.log('Server Time:', baseTime);
  console.log('Frontend Status:', baseFrontend.status);
  console.log('');

  // Authenticate candidate and employer to get JWT tokens for authenticated tests
  console.log('Authenticating Test Accounts...');
  const candLogin = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'eric.manzi@example.rw', password: 'Password123!' })
  }).then(r => r.json());
  const candidateToken = candLogin.token;

  const empLogin = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hotel@serena.rw', password: 'Password123!' })
  }).then(r => r.json());
  const employerToken = empLogin.token;
  console.log('Tokens acquired successfully.\n');

  // Phase 1: Frontend Web Traffic Simulation
  console.log('[Phase 1] Simulating Frontend User Traffic (Static Assets & Vite Proxy)...');
  const frontendUrls = [
    `${FRONTEND_URL}/`,
    `${FRONTEND_URL}/jobs`,
    `${FRONTEND_URL}/login`,
    `${FRONTEND_URL}/register`
  ];
  const feTasks = Array.from({ length: 60 }, (_, i) => {
    const url = frontendUrls[i % frontendUrls.length];
    return () => fetch(url);
  });
  const t0 = performance.now();
  const feResults = await runConcurrentBatch(feTasks, 10);
  const feTotalTime = (performance.now() - t0) / 1000;
  const feLatencies = feResults.map(r => r.duration);
  const feStats = computeStats(feLatencies);
  const feStatusCodes = feResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`Frontend 60 requests (10 concurrent): ${feStats.avg}ms avg, p95: ${feStats.p95}ms, RPS: ${(60 / feTotalTime).toFixed(1)}`);
  console.log('Status Codes:', feStatusCodes);
  console.log('');
  overallReport.frontend = { stats: feStats, totalTimeSec: feTotalTime, rps: Math.round((60 / feTotalTime) * 10) / 10, statusCodes: feStatusCodes };

  // Phase 2: Public API Browsing & Search (Candidate Traffic)
  // Low Concurrency: 5 concurrent, 100 requests
  console.log('[Phase 2A] Simulating Low Traffic (Candidate Browsing): 5 concurrent users, 100 requests...');
  const apiSearchUrls = [
    `${BACKEND_URL}/api/jobs`,
    `${BACKEND_URL}/api/jobs?q=waiter`,
    `${BACKEND_URL}/api/jobs?location=Kigali`,
    `${BACKEND_URL}/api/jobs?category=hospitality`,
    `${BACKEND_URL}/api/jobs/1`,
    `${BACKEND_URL}/api/jobs/2`,
    `${BACKEND_URL}/api/stats`
  ];

  const lowTasks = Array.from({ length: 100 }, (_, i) => {
    const url = apiSearchUrls[i % apiSearchUrls.length];
    return () => fetch(url);
  });
  const tLowStart = performance.now();
  const lowResults = await runConcurrentBatch(lowTasks, 5);
  const lowTimeSec = (performance.now() - tLowStart) / 1000;
  const lowStats = computeStats(lowResults.map(r => r.duration));
  const lowStatusCodes = lowResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`Low Load: Avg ${lowStats.avg}ms | p50 ${lowStats.p50}ms | p95 ${lowStats.p95}ms | p99 ${lowStats.p99}ms | Max ${lowStats.max}ms | RPS: ${(100 / lowTimeSec).toFixed(1)}`);
  console.log('Status Codes:', lowStatusCodes);
  console.log('');
  overallReport.lowLoad = { stats: lowStats, totalTimeSec: lowTimeSec, rps: Math.round((100 / lowTimeSec) * 10) / 10, statusCodes: lowStatusCodes };

  // Medium Concurrency: 25 concurrent, 250 requests
  console.log('[Phase 2B] Simulating Moderate Peak Traffic: 25 concurrent users, 250 requests...');
  const medTasks = Array.from({ length: 250 }, (_, i) => {
    const url = apiSearchUrls[i % apiSearchUrls.length];
    return () => fetch(url);
  });
  const tMedStart = performance.now();
  const medResults = await runConcurrentBatch(medTasks, 25);
  const medTimeSec = (performance.now() - tMedStart) / 1000;
  const medStats = computeStats(medResults.map(r => r.duration));
  const medStatusCodes = medResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`Medium Load: Avg ${medStats.avg}ms | p50 ${medStats.p50}ms | p95 ${medStats.p95}ms | p99 ${medStats.p99}ms | Max ${medStats.max}ms | RPS: ${(250 / medTimeSec).toFixed(1)}`);
  console.log('Status Codes:', medStatusCodes);
  console.log('');
  overallReport.medLoad = { stats: medStats, totalTimeSec: medTimeSec, rps: Math.round((250 / medTimeSec) * 10) / 10, statusCodes: medStatusCodes };

  // High Concurrency / Heavy Burst: 50 concurrent, 500 requests
  console.log('[Phase 2C] Simulating High Concurrency Burst: 50 concurrent users, 500 requests...');
  const highTasks = Array.from({ length: 500 }, (_, i) => {
    const url = apiSearchUrls[i % apiSearchUrls.length];
    return () => fetch(url);
  });
  const tHighStart = performance.now();
  const highResults = await runConcurrentBatch(highTasks, 50);
  const highTimeSec = (performance.now() - tHighStart) / 1000;
  const highStats = computeStats(highResults.map(r => r.duration));
  const highStatusCodes = highResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`High Load: Avg ${highStats.avg}ms | p50 ${highStats.p50}ms | p95 ${highStats.p95}ms | p99 ${highStats.p99}ms | Max ${highStats.max}ms | RPS: ${(500 / highTimeSec).toFixed(1)}`);
  console.log('Status Codes:', highStatusCodes);
  console.log('');
  overallReport.highLoad = { stats: highStats, totalTimeSec: highTimeSec, rps: Math.round((500 / highTimeSec) * 10) / 10, statusCodes: highStatusCodes };

  // Stress Test: Connection Pool Saturation Test (100 simultaneous requests)
  // PostgreSQL Pool max is 10 connections. 100 simultaneous requests force queuing.
  console.log('[Phase 2D] Stress Test: 100 Simultaneous DB Queries (Pool Max = 10)...');
  const tStressStart = performance.now();
  const stressTasks = Array.from({ length: 100 }, () => () => fetch(`${BACKEND_URL}/api/jobs`));
  const stressResults = await Promise.all(stressTasks.map(fn => {
    const s = performance.now();
    return fn().then(r => ({ ok: true, status: r.status, duration: performance.now() - s }))
               .catch(e => ({ ok: false, status: 0, duration: performance.now() - s, error: e.message }));
  }));
  const stressTimeSec = (performance.now() - tStressStart) / 1000;
  const stressStats = computeStats(stressResults.map(r => r.duration));
  const stressStatusCodes = stressResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`Pool Saturation (100 parallel): Avg ${stressStats.avg}ms | p50 ${stressStats.p50}ms | p95 ${stressStats.p95}ms | Max ${stressStats.max}ms | Time: ${stressTimeSec.toFixed(2)}s`);
  console.log('Status Codes:', stressStatusCodes);
  console.log('');
  overallReport.stressPool = { stats: stressStats, totalTimeSec: stressTimeSec, statusCodes: stressStatusCodes };

  // Phase 3: Authenticated Traffic (Candidate Applications & Employer Workspace)
  console.log('[Phase 3] Authenticated User Traffic Simulation (60 candidate & employer actions)...');
  const authTasks = [];
  for (let i = 0; i < 20; i++) {
    authTasks.push(() => fetch(`${BACKEND_URL}/api/applications/my`, {
      headers: { 'Authorization': `Bearer ${candidateToken}` }
    }));
  }
  for (let i = 0; i < 20; i++) {
    authTasks.push(() => fetch(`${BACKEND_URL}/api/employers/my-jobs`, {
      headers: { 'Authorization': `Bearer ${employerToken}` }
    }));
  }
  for (let i = 0; i < 20; i++) {
    authTasks.push(() => fetch(`${BACKEND_URL}/api/employers/dashboard`, {
      headers: { 'Authorization': `Bearer ${employerToken}` }
    }));
  }
  const tAuthStart = performance.now();
  const authResults = await runConcurrentBatch(authTasks, 10);
  const authTimeSec = (performance.now() - tAuthStart) / 1000;
  const authStats = computeStats(authResults.map(r => r.duration));
  const authStatusCodes = authResults.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  console.log(`Authenticated Load (10 concurrent): Avg ${authStats.avg}ms | p50 ${authStats.p50}ms | p95 ${authStats.p95}ms | Max ${authStats.max}ms | RPS: ${(60 / authTimeSec).toFixed(1)}`);
  console.log('Status Codes:', authStatusCodes);
  console.log('');
  overallReport.authenticated = { stats: authStats, totalTimeSec: authTimeSec, rps: Math.round((60 / authTimeSec) * 10) / 10, statusCodes: authStatusCodes };

  // Phase 4: Security & Rate Limiter Verification
  console.log('[Phase 4] Testing Rate Limiting Protections...');
  // The login limiter is 40 requests per 15 min. Let's see if it triggers after 40 attempts.
  console.log('Testing authLimiter (/api/auth/login, limit 40)...');
  let rateLimited = false;
  let triggerAttempt = 0;
  let statusCodesList = [];
  for (let i = 1; i <= 45; i++) {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test.ratelimit@example.rw', password: 'WrongPassword' })
    });
    statusCodesList.push(res.status);
    if (res.status === 429) {
      rateLimited = true;
      triggerAttempt = i;
      break;
    }
  }
  console.log(`Rate Limiting Triggered: ${rateLimited ? 'YES (at attempt ' + triggerAttempt + ')' : 'NO (all 45 accepted)'}`);
  console.log('Status observed:', statusCodesList.slice(0, 5), '...', statusCodesList.slice(-3));
  console.log('');
  overallReport.rateLimiting = {
    authLimiterActive: rateLimited,
    triggerAttempt,
    observedCodes: statusCodesList
  };

  // Phase 5: Malformed & Edge-Case Traffic Behavior
  console.log('[Phase 5] Testing Malformed & Edge Case Traffic...');
  const edgeCases = [
    { name: '404 Route', fn: () => fetch(`${BACKEND_URL}/api/non-existent-route-12345`) },
    { name: 'Malformed JSON POST', fn: () => fetch(`${BACKEND_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid-json"::}'
    })},
    { name: 'SQL Injection in Query Param', fn: () => fetch(`${BACKEND_URL}/api/jobs?q=%27%20OR%201=1%20--`) },
    { name: 'Unauthorized Protected Route', fn: () => fetch(`${BACKEND_URL}/api/admin/users`) },
    { name: 'Large Payload Buffer (>1MB)', fn: () => fetch(`${BACKEND_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'A'.repeat(1.5 * 1024 * 1024) })
    })},
  ];

  const edgeResults = [];
  for (const ec of edgeCases) {
    try {
      const res = await ec.fn();
      edgeResults.push({ name: ec.name, status: res.status, ok: res.ok });
    } catch (e) {
      edgeResults.push({ name: ec.name, status: 0, error: e.message });
    }
  }
  console.log('Edge Case Behavior:', edgeResults);
  console.log('');
  overallReport.edgeCases = edgeResults;

  // Phase 6: Server Resource Footprint After Simulation
  const memAfter = process.memoryUsage();
  console.log('[Phase 6] Memory & Resource Utilization...');
  const memDiffMb = {
    rss: Math.round((memAfter.rss - memBefore.rss) / (1024 * 1024) * 100) / 100,
    heapUsed: Math.round((memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024) * 100) / 100,
    currentHeapMb: Math.round(memAfter.heapUsed / (1024 * 1024) * 100) / 100,
  };
  console.log(`Memory Delta: RSS ${memDiffMb.rss}MB, HeapUsed ${memDiffMb.heapUsed}MB (Current Heap: ${memDiffMb.currentHeapMb}MB)`);
  overallReport.memory = memDiffMb;

  console.log('\n====================================================');
  console.log('SIMULATION COMPLETE. WRITING RESULTS...');
  console.log('====================================================');

  const fs = require('fs');
  fs.writeFileSync('server/simulation-results.json', JSON.stringify(overallReport, null, 2));
  console.log('Saved to server/simulation-results.json');
  process.exit(0);
}

simulate().catch(err => {
  console.error('Fatal Simulation Error:', err);
  process.exit(1);
});
