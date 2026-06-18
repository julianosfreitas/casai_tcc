#!/usr/bin/env node
// Teste de tempo real (WebSocket/Socket.IO) da API CASAI.
// Conecta autenticado com JWT, inscreve nos eventos, dispara um toggle via fetch,
// e confirma que device:status_changed chega em <=3s. PASS/FAIL.
// socket.io-client e resolvido a partir de apps/api/node_modules (onde ja existe).
// Uso: node test-casai-ws.mjs

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, 'apps', 'api') + '/');
const { io } = require('socket.io-client');

const WS = process.env.CASAI_WS ?? 'http://localhost:4000';
const API = process.env.CASAI_API ?? 'http://localhost:4000/api';
const CRED = { email: 'dev@casai.local', password: 'Senha@123' };

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` -> ${detail}` : ''}`);
  cond ? pass++ : fail++;
};

async function login() {
  const res = await fetch(`${API}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CRED),
  });
  const j = await res.json();
  return j.accessToken;
}

async function getLightId(token) {
  const res = await fetch(`${API}/devices`, { headers: { Authorization: `Bearer ${token}` } });
  const devs = await res.json();
  return devs.find(d => d.type === 'LIGHT').id;
}

async function toggle(token, id) {
  const res = await fetch(`${API}/devices/${id}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ command: 'toggle' }),
  });
  return res.status;
}

async function main() {
  console.log(`=== CASAI WebSocket test @ ${WS} ===\n`);
  const token = await login();
  ok('login (token JWT)', !!token, token ? token.slice(0, 20) + '...' : 'sem token');
  const lightId = await getLightId(token);

  const socket = io(WS, { auth: { token }, transports: ['websocket'], reconnection: false });

  const connected = await new Promise((resolve) => {
    socket.on('connect', () => resolve(true));
    socket.on('connect_error', (e) => { console.log('  connect_error:', e.message); resolve(false); });
    setTimeout(() => resolve(false), 5000);
  });
  ok('conecta autenticado (WebSocket)', connected, `id=${socket.id}`);
  if (!connected) { finish(); return; }

  // Inscreve nos eventos
  let energyReading = null;
  socket.on('energy:reading', (p) => { energyReading = p; });

  const statusEvent = new Promise((resolve) => {
    socket.on('device:status_changed', (p) => resolve(p));
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve('TIMEOUT'), 3000));

  // Dispara mudanca de estado
  const st = await toggle(token, lightId);
  ok('POST toggle (gatilho)', st === 200 || st === 201, `status ${st}`);

  const result = await Promise.race([statusEvent, timeout]);
  ok('device:status_changed chega em <=3s', result !== 'TIMEOUT',
     result !== 'TIMEOUT' ? `payload=${JSON.stringify(result)}` : 'nao chegou em 3s');

  // Bonus: energy:reading (polling 5s) — aguarda ate 6s
  if (!energyReading) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  ok('energy:reading recebido (bonus, polling)', energyReading != null,
     energyReading ? `watts=${energyReading.watts ?? JSON.stringify(energyReading).slice(0,60)}` : 'nenhum em ~6s');

  finish();

  function finish() {
    socket.disconnect();
    console.log(`\n===== PLACAR WS: ${pass} PASS / ${fail} FAIL =====`);
    process.exit(fail === 0 ? 0 : 1);
  }
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
