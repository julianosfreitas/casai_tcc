/*
 * spike: ews410-bootstrap — "põe a EWS 410 pra funcionar" de ponta a ponta.
 *
 * Roda com Node puro (zero setup): `node spikes/ews410-bootstrap.js`
 * Lê apps/api/.env (TUYA_CLOUD_*) e usa as libs já instaladas em apps/api/node_modules.
 *
 * O QUE FAZ (em estágios, cada um isolado em try/catch):
 *   1. CLOUD  — lista os devices do projeto Tuya (Link App Account) e acha a EWS 410 física
 *               (category 'dj' e id que NÃO começa com 'vdevo'). Pega device_id + local_key.
 *   2. SPEC   — GET /specification → resolve v1 vs v2 e a faixa REAL de Kelvin/escala.
 *   3. LAN    — descobre IP + versão de protocolo via broadcast UDP 6666/6667.
 *   4. LOCAL  — conecta via tuyapi e faz o DUMP REAL de DPS (resolve DPS 1 vs 20),
 *               depois on/off com readback, brilho, temperatura e cor.
 *   5. RESUMO — imprime os valores de DPS reais + as constantes recomendadas pro adapter.
 *
 * PRÉ-REQUISITO (manual, no celular — só você consegue):
 *   - Lâmpada resetada e pareada no app SmartLife (Tuya) na Wi-Fi 2,4 GHz da casa.
 *   - Projeto Tuya 'casai' (Western America) com "Link Tuya App Account" feito (QR).
 *   - FECHE o app SmartLife/Izy no celular antes de rodar (a lâmpada aceita 1 conexão local).
 *
 * Se a lâmpada ainda não está no projeto, o estágio 1 avisa e para — sem erro feio.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dgram = require('dgram');

const REPO = path.resolve(__dirname, '..');
const API = path.join(REPO, 'apps', 'api');
const ENV_PATH = path.join(API, '.env');

// ---------- util ----------
function loadEnv(p) {
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}
const mask = (s) => (s ? s.slice(0, 3) + '…(' + s.length + ')' : '(vazio)');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function header(t) { console.log('\n' + '='.repeat(60) + '\n' + t + '\n' + '='.repeat(60)); }

const env = loadEnv(ENV_PATH);
const BASE = env.TUYA_CLOUD_BASE_URL || 'https://openapi.tuyaus.com';
const ACCESS_ID = env.TUYA_CLOUD_ACCESS_ID;
const ACCESS_SECRET = env.TUYA_CLOUD_ACCESS_SECRET;

let TuyaContext, TuyAPI;
try { ({ TuyaContext } = require(path.join(API, 'node_modules', '@tuya', 'tuya-connector-nodejs'))); }
catch (e) { console.error('✗ Falta @tuya/tuya-connector-nodejs em apps/api/node_modules:', e.message); }
try { TuyAPI = require(path.join(API, 'node_modules', 'tuyapi')); }
catch (e) { console.error('✗ Falta tuyapi em apps/api/node_modules:', e.message); }

// ---------- estágio 3: descoberta LAN (UDP) ----------
const UDP_KEY = crypto.createHash('md5').update('yGAdlopoPVldABfn', 'utf8').digest();
function jsonFromBuf(buf) {
  const s = buf.toString('latin1');
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch (_) {} }
  return null;
}
function decryptUdp(buf) {
  for (const [a, b] of [[20, 8], [20, 12], [16, 8]]) {
    if (buf.length <= a + b) continue;
    const body = buf.slice(a, buf.length - b);
    if (body.length % 16 !== 0) continue;
    try {
      const dc = crypto.createDecipheriv('aes-128-ecb', UDP_KEY, null);
      dc.setAutoPadding(false);
      const out = Buffer.concat([dc.update(body), dc.final()]);
      const j = jsonFromBuf(out);
      if (j) return j;
    } catch (_) {}
  }
  return null;
}
function discoverLan(targetId, ms = 12000) {
  return new Promise((resolve) => {
    const map = new Map();
    const socks = [];
    const onMsg = (msg, rinfo) => {
      const j = jsonFromBuf(msg) || decryptUdp(msg);
      if (!j) return;
      const id = j.gwId || j.devId || j.id;
      if (!id) return;
      map.set(id, { id, ip: j.ip || rinfo.address, version: j.version, productKey: j.productKey });
    };
    for (const port of [6666, 6667]) {
      try {
        const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        s.on('error', () => {});
        s.on('message', onMsg);
        s.bind(port, () => { try { s.setBroadcast(true); } catch (_) {} });
        socks.push(s);
      } catch (_) {}
    }
    const finish = () => { for (const s of socks) { try { s.close(); } catch (_) {} } resolve(map); };
    const iv = setInterval(() => { if (targetId && map.has(targetId)) { clearInterval(iv); finish(); } }, 500);
    setTimeout(() => { clearInterval(iv); finish(); }, ms);
  });
}

// ---------- main ----------
(async () => {
  header('CASAI · EWS 410 BOOTSTRAP');
  console.log('BASE_URL :', BASE);
  console.log('ACCESS_ID:', mask(ACCESS_ID));
  console.log('SECRET   :', ACCESS_SECRET ? 'set(' + ACCESS_SECRET.length + ')' : 'AUSENTE');
  if (!TuyaContext || !ACCESS_SECRET) { console.error('\n✗ Sem libs/credenciais. Abortando.'); process.exit(1); }

  const ctx = new TuyaContext({ baseUrl: BASE, accessKey: ACCESS_ID, secretKey: ACCESS_SECRET });
  const call = async (method, p, body) => {
    try { return await ctx.request({ method, path: p, body }); }
    catch (e) { return { success: false, msg: e.message }; }
  };

  // === 1. CLOUD: achar a lâmpada física ===
  header('1) CLOUD — devices no projeto');
  let devices = [];
  let r = await call('GET', '/v1.0/iot-01/associated-users/devices');
  if (r && r.success && r.result) devices = r.result.devices || r.result || [];
  if (!devices.length) {
    const r2 = await call('GET', '/v1.3/iot-03/devices');
    if (r2 && r2.success && r2.result) devices = r2.result.list || r2.result.devices || [];
  }
  console.log('Total devices:', devices.length);
  for (const d of devices) {
    console.log(`  · ${d.id}  [${d.category}]  "${d.name}"  online=${d.online}  key=${d.local_key ? 'sim' : 'não'}`);
  }
  const isVirtual = (id) => String(id).startsWith('vdevo');
  let lamp = devices.find((d) => d.category === 'dj' && !isVirtual(d.id))
        || devices.find((d) => !isVirtual(d.id) && /ews|l[âa]mpada|bulb|rgb/i.test(JSON.stringify(d)));

  if (!lamp) {
    header('PARADO — lâmpada física ainda NÃO está no projeto');
    console.log([
      'Só há device(s) virtual(is) ou nenhum device "dj" físico.',
      '',
      'FAÇA NO CELULAR (uma vez):',
      '  1. App SmartLife (NÃO Izy/Mibo). Remova a lâmpada do Izy se estiver lá.',
      '  2. Reset: liga/desliga o interruptor 5x (intervalo ~2s) → lâmpada pisca RÁPIDO (modo EZ).',
      '  3. SmartLife → + → Add Device → escolha a Wi-Fi 2,4 GHz da casa + senha → conclua.',
      '  4. Confirme que liga/desliga e cor funcionam DENTRO do SmartLife.',
      '  5. iot.tuya.com → projeto casai (Western America) → Devices → Link Tuya App Account',
      '     → Add App Account → QR. No SmartLife: aba "Eu" → ícone scanner (canto sup. dir.) → Confirm.',
      '  6. Devices → All Devices: a lâmpada DEVE aparecer Online (senão, DC errado ou conta errada).',
      '',
      'Depois rode de novo:  node spikes/ews410-bootstrap.js',
    ].join('\n'));
    process.exit(0);
  }

  console.log('\n✓ LÂMPADA FÍSICA ENCONTRADA:');
  console.log('  id        :', lamp.id);
  console.log('  nome      :', lamp.name);
  console.log('  product   :', lamp.product_name, '| model:', lamp.model);
  console.log('  online    :', lamp.online);
  console.log('  local_key :', mask(lamp.local_key));
  const DEV_ID = lamp.id;
  const LOCAL_KEY = lamp.local_key;

  // === 2. SPEC: v1 vs v2 + Kelvin real ===
  header('2) SPEC — /specification (v1 vs v2, Kelvin, DP codes)');
  let spec = await call('GET', `/v1.0/devices/${DEV_ID}/specification`);
  if (!spec.success) spec = await call('GET', `/v1.2/iot-03/devices/${DEV_ID}/specification`);
  if (spec && spec.success && spec.result) {
    const fns = spec.result.functions || [];
    const status = spec.result.status || [];
    const codes = [...new Set([...fns, ...status].map((f) => f.code))];
    console.log('codes:', codes.join(', '));
    const parseVals = (f) => { try { return typeof f.values === 'string' ? JSON.parse(f.values) : f.values; } catch (_) { return f.values; } };
    for (const f of fns) console.log(`  fn  ${f.code} (${f.type}) ${JSON.stringify(parseVals(f))}`);
    const hasV2 = codes.some((c) => /_v2$/.test(c));
    const bright = fns.find((f) => /^bright_value/.test(f.code));
    const temp = fns.find((f) => /^temp_value/.test(f.code));
    console.log('\n  → esquema:', hasV2 ? 'v2 (escala ~0–1000)' : 'v1 (escala ~0–255)');
    if (bright) console.log('  → brilho range:', JSON.stringify(parseVals(bright)));
    if (temp) console.log('  → temp range  :', JSON.stringify(parseVals(temp)), '(0=quente, max=frio — confirmar visual)');
  } else {
    console.log('✗ specification falhou:', spec && spec.msg, '— seguindo (o dump LAN dá a verdade dos DPS).');
  }

  // status atual via cloud (cross-check)
  const st = await call('GET', `/v1.0/devices/${DEV_ID}/status`);
  if (st && st.success) console.log('\n  status cloud:', JSON.stringify(st.result));

  // === 3. LAN: IP + versão ===
  header('3) LAN — descoberta UDP (12s)');
  console.log('Ouvindo broadcast Tuya 6666/6667... (lâmpada precisa estar ligada nesta Wi-Fi)');
  const found = await discoverLan(DEV_ID, 12000);
  let lanInfo = found.get(DEV_ID);
  if (lanInfo) {
    console.log('✓ encontrada na LAN:', JSON.stringify(lanInfo));
  } else {
    console.log('✗ não apareceu no broadcast. Outros Tuya vistos:', JSON.stringify([...found.values()]));
    console.log('  Dica: lâmpada na mesma sub-rede? ligada? Defina TUYA_EWS410_IP no .env p/ forçar.');
  }
  const LAN_IP = (lanInfo && lanInfo.ip) || env.TUYA_EWS410_IP;
  const VERSIONS = lanInfo && lanInfo.version
    ? [String(lanInfo.version)]
    : (env.TUYA_PROTOCOL_VERSION ? [env.TUYA_PROTOCOL_VERSION, '3.3', '3.4', '3.5'] : ['3.3', '3.4', '3.5', '3.1']);

  if (!LAN_IP) { console.log('\n✗ Sem IP local — pulo o controle LAN. (lâmpada offline na LAN)'); process.exit(0); }
  if (!LOCAL_KEY) { console.log('\n✗ Sem local_key — pulo o controle LAN.'); process.exit(0); }
  if (!TuyAPI) { console.log('\n✗ Sem tuyapi — pulo o controle LAN.'); process.exit(0); }

  // === 4. LOCAL: dump + controle real ===
  header('4) LOCAL — controle via tuyapi');
  console.log('IMPORTANTE: feche o app SmartLife/Izy no celular (1 conexão local por vez).');

  let device = null, usedVersion = null;
  for (const v of VERSIONS) {
    try {
      console.log(`→ tentando conectar ip=${LAN_IP} protocolo=${v}...`);
      const d = new TuyAPI({ id: DEV_ID, key: LOCAL_KEY, ip: LAN_IP, version: v, issueGetOnConnect: false });
      d.on('error', (e) => console.log('  (evento error)', e.message));
      await Promise.race([d.connect(), sleep(6000).then(() => { throw new Error('timeout connect'); })]);
      device = d; usedVersion = v; break;
    } catch (e) { console.log(`  ✗ protocolo ${v} falhou: ${e.message}`); }
  }
  if (!device) { console.log('\n✗ Não conectou em nenhum protocolo. (local_key desatualizada? app aberto?)'); process.exit(0); }
  console.log(`✓ conectado (protocolo ${usedVersion})`);

  const get = async () => { try { return await device.get({ schema: true }); } catch (e) { return { erro: e.message }; } };
  const dump = await get();
  console.log('\n*** DUMP REAL DE DPS ***');
  console.log(JSON.stringify(dump));
  const dps = (dump && dump.dps) || {};
  const keys = Object.keys(dps);
  console.log('DPS keys:', keys.join(', '));

  // heurística: power = primeiro DPS booleano; brilho = maior numérico plausível
  const boolKey = keys.find((k) => typeof dps[k] === 'boolean');
  const numKeys = keys.filter((k) => typeof dps[k] === 'number');
  const POWER = boolKey || (keys.includes('20') ? '20' : (keys.includes('1') ? '1' : keys[0]));
  console.log(`\n→ DPS de power detectado: ${POWER} (valor atual=${dps[POWER]})`);

  const setDps = async (k, val, label) => {
    try { console.log(`→ set dps ${k} = ${val}  (${label})`); await device.set({ dps: Number(k), set: val }); await sleep(1500); const a = await get(); console.log('  readback:', JSON.stringify(a.dps || a)); }
    catch (e) { console.log(`  ✗ falhou: ${e.message}`); }
  };

  await setDps(POWER, true, 'LIGAR');
  await setDps(POWER, false, 'DESLIGAR');
  await setDps(POWER, true, 'LIGAR de novo p/ testar cor/brilho');

  // brilho/temp/cor: tenta tanto esquema v2 (22/23/24) quanto v1 (2/3/5) conforme existir
  const has = (k) => keys.includes(String(k));
  if (has(22)) await setDps(22, 500, 'brilho ~50% (v2 esperado 10–1000)');
  else if (has(3)) await setDps(3, 500, 'brilho (v1?)');
  if (has(23)) await setDps(23, 500, 'temp meio (v2)');
  else if (has(4)) await setDps(4, 128, 'temp (v1?)');
  if (has(21)) await setDps(21, 'colour', 'work_mode=colour');
  else if (has(2)) await setDps(2, 'colour', 'mode (v1?)');
  if (has(24)) await setDps(24, '0000ffff03e803e8', 'cor azul HSV (v2)');
  else if (has(5)) await setDps(5, 'ff0000', 'cor (v1?)');

  await setDps(POWER, false, 'DESLIGAR (fim)');
  try { device.disconnect(); } catch (_) {}

  // === 5. RESUMO ===
  header('5) RESUMO — constantes reais p/ o adapter');
  console.log('device_id          :', DEV_ID);
  console.log('ip LAN             :', LAN_IP);
  console.log('protocolo que pegou:', usedVersion);
  console.log('DPS observados     :', JSON.stringify(dps));
  console.log('POWER DPS          :', POWER);
  console.log('\nAÇÃO: ajustar apps/api/src/devices/adapters/tuya.adapter.ts:16 com os DPS REAIS acima,');
  console.log('e calibrar escala/Kelvin conforme o /specification (estágio 2). Cadastrar device no CASAI:');
  console.log(JSON.stringify({ protocol: 'TUYA', externalId: DEV_ID, ip: LAN_IP, protocolVersion: usedVersion,
    localKey: '(cifrar AES-256-GCM)', supportsBrightness: true, supportsColor: true, supportsColorTemp: true }, null, 2));
  console.log('\n✓ Se a lâmpada acendeu/apagou/mudou de cor, o CONTROLE LOCAL FUNCIONA.');
})().catch((e) => { console.error('\n✗ ERRO FATAL:', e); process.exit(1); });
