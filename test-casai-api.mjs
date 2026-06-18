#!/usr/bin/env node
// Smoke test ao vivo da API CASAI usando fetch nativo do Node (sem deps, sem curl).
// Login -> token JWT -> exercita cada grupo de endpoints. Placar PASS/FAIL no fim.
// Uso: node test-casai-api.mjs   (API precisa estar em http://localhost:4000)

const BASE = process.env.CASAI_API ?? 'http://localhost:4000/api';
const CRED = { email: 'dev@casai.local', password: 'Senha@123' };

let pass = 0, fail = 0;
let token = null;

function ok(name, cond, detail = '') {
  const tag = cond ? 'PASS' : 'FAIL';
  if (cond) pass++; else fail++;
  console.log(`  [${tag}] ${name}${detail ? ` -> ${detail}` : ''}`);
  return cond;
}

async function api(method, path, { body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const txt = await res.text();
  try { json = txt ? JSON.parse(txt) : null; } catch { json = txt; }
  return { status: res.status, json };
}

async function main() {
  console.log(`=== CASAI smoke test @ ${BASE} ===\n`);

  // --- AUTH ---
  console.log('--- AUTH ---');
  {
    const r = await api('POST', '/auth/sign_in', { body: CRED, auth: false });
    token = r.json?.accessToken ?? null;
    ok('POST /auth/sign_in', (r.status === 200 || r.status === 201) && !!token, `status ${r.status}`);
  }
  {
    const r = await api('GET', '/auth/me');
    ok('GET /auth/me (autenticado)', r.status === 200 && r.json?.email === CRED.email, `email=${r.json?.email}`);
  }
  {
    const saved = token; token = null;
    const r = await api('GET', '/auth/me');
    ok('GET /auth/me SEM token => 401', r.status === 401, `status ${r.status}`);
    token = saved;
  }

  // --- DEVICES ---
  console.log('\n--- DEVICES ---');
  let devices = [];
  {
    const r = await api('GET', '/devices');
    devices = Array.isArray(r.json) ? r.json : [];
    ok('GET /devices', r.status === 200 && devices.length > 0, `${devices.length} devices`);
  }
  const light = devices.find(d => d.type === 'LIGHT');
  const plug = devices.find(d => d.type === 'PLUG');
  {
    const before = light?.lastState?.on;
    const r = await api('POST', `/devices/${light.id}/command`, { body: { command: 'toggle' } });
    const after = r.json?.on;
    ok('POST /devices/:id/command toggle', (r.status === 200 || r.status === 201) && after === !before, `${before} -> ${after}`);
  }
  {
    const r = await api('POST', `/devices/${light.id}/command`, { body: { command: 'foobar' } });
    ok('comando invalido => 400/422', r.status === 400 || r.status === 422, `status ${r.status}`);
  }
  {
    const r = await api('POST', `/devices/${light.id}/command`, { body: { command: 'setBrightness', brightness: 999 } });
    ok('brightness fora de faixa => 400/422', r.status === 400 || r.status === 422, `status ${r.status}`);
  }

  // --- ENERGY ---
  console.log('\n--- ENERGY ---');
  {
    const r = await api('GET', '/energy/summary');
    ok('GET /energy/summary', r.status === 200 && typeof r.json?.totalWatts === 'number', `${r.json?.totalWatts}W kwhToday=${r.json?.kwhToday}`);
  }
  {
    const r = await api('GET', `/devices/${plug.id}/energy/history`);
    const buckets = r.json?.buckets ?? r.json;
    ok('GET /devices/:id/energy/history', r.status === 200, `${Array.isArray(buckets) ? buckets.length : '?'} buckets`);
  }

  // --- SCENES ---
  console.log('\n--- SCENES ---');
  let scenes = [];
  {
    const r = await api('GET', '/scenes');
    scenes = Array.isArray(r.json) ? r.json : [];
    ok('GET /scenes', r.status === 200 && scenes.length > 0, `${scenes.length} cenas`);
  }
  {
    const r = await api('POST', `/scenes/${scenes[0].id}/activate`);
    const results = r.json?.results ?? [];
    ok(`POST /scenes/:id/activate ('${scenes[0].name}')`, (r.status === 200 || r.status === 201) && results.every(x => x.ok), `${results.length} comandos`);
  }

  // --- AUTOMATIONS ---
  console.log('\n--- AUTOMATIONS ---');
  let autos = [];
  {
    const r = await api('GET', '/automations');
    autos = Array.isArray(r.json) ? r.json : [];
    ok('GET /automations', r.status === 200 && autos.length > 0, `${autos.length} rotinas`);
  }
  {
    const r = await api('POST', `/automations/${autos[0].id}/run`);
    ok(`POST /automations/:id/run ('${autos[0].name}')`, (r.status === 200 || r.status === 201) && r.json?.triggered === true, `triggered=${r.json?.triggered}`);
  }

  // --- VOICE ---
  console.log('\n--- VOICE ---');
  {
    const r = await api('POST', '/voice/command', { body: { text: 'acende a luz da sala' } });
    ok("POST /voice/command texto ('acende a luz da sala')", (r.status === 200 || r.status === 201) && r.json?.intent != null, `intent=${r.json?.intent} exec=${r.json?.executed} conf=${r.json?.confidence} ${r.json?.latencyMs}ms`);
  }

  // --- GAMIFICATION ---
  console.log('\n--- GAMIFICATION ---');
  {
    const r = await api('GET', '/gamification/summary');
    ok('GET /gamification/summary', r.status === 200 && r.json != null, `pts=${r.json?.points ?? r.json?.totalPoints} nivel=${r.json?.level}`);
  }

  console.log(`\n===== PLACAR: ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
