# CASAI — Integração da Lâmpada Intelbras EWS 410

> **Data:** 2026-06-19 · **Escopo:** forma REAL e melhor de integrar a EWS 410 (RGBCW, Tuya OEM) no CASAI, com preferência forte por **local-first**.
> Baseado em: 2 manuais oficiais Intelbras (02-20, 01-24/01-26), datasheet v2.0, fórum Intelbras, fórum Home Assistant Brasil, docs Tuya/tinytuya/tuyapi, e leitura do próprio código.

---

## 0. Status verificado nesta sessão (testes reais)

| Teste | Resultado |
|---|---|
| Mac na rede | `192.168.25.63` (en1), mesma sub-rede da Tapo (`.61`). ✓ |
| Broadcast Tuya UDP 6666/6667 (16s) | **0 pacotes** → lâmpada **não está nesta Wi-Fi agora**. |
| Varredura LAN 192.168.25.0/24 + porta 6668 | 31 hosts vivos, **nenhuma porta 6668** aberta, nenhum candidato Tuya/ESP. |
| Projeto Tuya Cloud (`associated-users/devices`) | **1 device — só o virtual** `vdevo178181284502596`. A EWS 410 física **NÃO entrou no projeto**. |
| Harness `spikes/ews410-bootstrap.cjs` estágio 1 | roda OK, confirma a ausência e imprime os passos de provisionamento. |

**Conclusão:** o código pra controlar **já existe** (adapter `TUYA`/`tuyapi`). O único gargalo é **provisionamento físico** (parear no SmartLife + Link App Account). Resolvido isso, o harness faz o resto automático.

### ⚠️ Correção de um "achado" do workflow (DPS 1 vs 20)
Um agente afirmou que `spikes/tuya-test.ts` **observou** o power no `DPS 1` da lâmpada real. **Falso.** Verificado no arquivo: `tuya-test.ts:11,55` apenas **assume** `DPS 1` (comentário + `set` às cegas); nunca conectou no hardware. Há, portanto, **contradição interna não-verificada** no repo:
- `tuya.adapter.ts:16` → `POWER:20, BRIGHTNESS:22, COLOR_TEMP:23, COLOR:24` (esquema **v2 / "tipo B"**)
- `tuya-test.ts` → assume `POWER:1` (esquema **v1 / legado**)

**Só o dump `device.get({schema:true})` da lâmpada física decide.** O harness faz esse dump e imprime os DPS reais.

---

## 1. TL;DR — via recomendada

**Controle 100% LOCAL na LAN via `tuyapi` (adapter `TUYA` que o CASAI já tem)** — mesma topologia do Tapo. A nuvem Tuya é usada **uma única vez** (fora de runtime) só para extrair a `local_key`, pareando a lâmpada **no SmartLife** (não Izy/Mibo) e linkando a conta ao projeto IoT `casai` (DC Western America). Em produção o Render nunca fala com a lâmpada — quem fala é o runner na LAN. `TuyaCloudAdapter` fica como **fallback** explícito.

---

## 2. Hardware (confirmado pelas fontes oficiais)

| Pergunta | Resposta | Confiança |
|---|---|---|
| **Wi-Fi ou Zigbee?** | **Wi-Fi 2,4 GHz apenas** (IEEE 802.11 b/g/n). **NÃO é Zigbee, NÃO precisa hub.** Manual 2026: *"suporta somente redes Wi-Fi na frequência de 2,4 GHz"*; suporte Intelbras: *"a EWS 410 não é compatível com 5ghz"*. | **Alta** |
| **É Tuya?** | **Sim**, módulo Tuya white-label (Izy = Tuya). Firmware OTA Izy V.1.5.21→V.1.6.3. Aparece como device Tuya no SmartLife e no HA. | **Alta** |
| **Kelvin real?** | Manual 01-24/26 = **3000–6500 K**; datasheet v2.0 = 3000–6000 K. **NÃO é 2700K.** O `/specification` dá o valor exato em runtime. | **Alta** (faixa varia por revisão) |
| **EWS 410 vs ELW 1001** | Mesma família Intelbras (página oficial agrupa as duas). Ambas RGBCW E27 Tuya Wi-Fi 2,4 GHz. Confusão do handoff **desfeita**. | **Média/Alta** |
| **Pareamento/reset** | Liga/desliga interruptor **5× (intervalo ~2s)** → pisca rápido = **EZ**; repetir → pisca lento = **AP/compatibilidade**. | **Alta** (manual 2026) |
| **Funções** | Cor (espectro RGB + saturação), Branco (intensidade), Agenda, cenas, temporizador. | **Alta** (manual 2026) |

---

## 3. Comparação das vias

| Via | Runtime | Exige | Fit local-first | Papel |
|---|---|---|---|---|
| **(b) LAN `tuyapi`** (adapter `TUYA`) | TCP local porta 6668, `device_id`+`local_key`+ip | local_key (1x da nuvem), IP, versão protocolo, runner na LAN | **ÓTIMO** | **PRIMÁRIA** |
| **(d) Re-pareio SmartLife + Link App Account** | — (provisionamento) | reset + SmartLife + QR + DC Western America | N/A | **pré-requisito** |
| **(c) HA + LocalTuya** (adapter `HOME_ASSISTANT`) | REST p/ HA na LAN | HA + HACS + LocalTuya + local_key | Bom | **plano B** (provado por usuário real) |
| **(a) Tuya Cloud** (adapter `TUYA_CLOUD`) | nuvem no caminho | conta + projeto + IoT Core | Ruim (nuvem não alcança LAN no Render) | **fallback/demo** |

> **Correção factual:** ao contrário do que dizia o handoff, `tuyapi` 7.7.x **suporta protocolo 3.4/3.5** (PR #606 merged 2022-11-13). O adapter já passa `version: ctx.protocolVersion ?? '3.3'`. Versão errada falha **silenciosamente** → capturar a `version` no scan e passar ao adapter.

---

## 4. Passo a passo REAL

### Fase A — Provisionamento (manual, no celular + uma máquina na LAN)
1. **Confirmar modelo físico** na etiqueta (EWS 410 vs ELW 1001).
2. **Reset:** remover do Izy/Mibo; liga/desliga **5× (~2s)** até piscar rápido (EZ).
3. **Parear no SmartLife** (não Izy): `+` → Add Device → Wi-Fi **2,4 GHz** + senha. Testar on/off/cor no app.
4. **Projeto Tuya `casai`:** DC **APENAS Western America** (`openapi.tuyaus.com`). Autorizar IoT Core + Smart Home Basic Service + Device Status Notification.
5. **Link App Account:** Devices → Link Tuya App Account → QR. No SmartLife: aba "Eu" → scanner (canto sup. dir.) → Confirm.
6. **VERIFICAR em Devices → All Devices** que a lâmpada aparece **Online**. Sem isso, nada foi importado.

### Fase B — Automático (o harness faz)
```bash
node spikes/ews410-bootstrap.cjs
```
Pega `device_id`+`local_key` da nuvem → lê `/specification` (v1 vs v2 + Kelvin) → descobre IP+protocolo na LAN (UDP) → conecta via `tuyapi` → **dump real de DPS** → on/off c/ readback, brilho, temp, cor → imprime as constantes reais p/ o adapter.

### Fase C — Persistir no CASAI
Cadastrar device: `protocol='TUYA'`, `externalId=device_id`, `ip`, `protocolVersion`, `localKeyEnc` (AES-256-GCM), `supportsBrightness/Color/ColorTemp=true`. Deploy local-first: runner na LAN controla; Render nunca toca a lâmpada.

---

## 5. Mudanças no código (aplicar APÓS o dump real)

**Não precisa adapter novo.** A EWS 410 cabe em `protocol='TUYA'`. Ajustes:

1. **`tuya.adapter.ts:16` — corrigir os DPS** conforme o dump real (resolver 20 vs 1). Fonte de verdade = `get({schema:true})`, não a tabela hardcoded.
2. **Escala v1 vs v2 não-hardcoded** — `setBrightness` (linha 75) e `setColorTemp` (linha 92) assumem 0–1000 (v2). Se o dump for v1 (0–255), satura. Ler o range do `/specification` e converter.
3. **Kelvin: piso 2700→3000K** (`setColorTemp` linha 91) — hardware é 3000–6500K.
4. **`work_mode` no caminho LAN** — o adapter LAN não escreve `work_mode`; o cloud sim. Se a cor não "pegar" via LAN, escrever `work_mode='colour'` (DPS 21) antes de `colour_data`.
5. **Parse defensivo de cor ao LER** — `colour_data*` às vezes vem string JSON.

---

## 6. Riscos / pegadinhas

1. **`local_key` muda a cada re-pareamento** — se resetar, re-rodar o wizard/harness.
2. **Protocolo 3.4/3.5** pós-OTA — capturar a `version` no scan (falha silenciosa se errada).
3. **DPS hardcoded ≠ hardware** — device virtual "8/8" valida só o template cloud, não a via LAN.
4. **1 conexão TCP por vez** — fechar o app SmartLife/Izy durante os testes.
5. **Render não alcança a LAN** — controle físico parte de runner na rede doméstica (arquitetura, não bug).
6. **Mesh quebra pareamento** — SSID 2,4+5GHz junto; isolar a 2,4 GHz no provisionamento.
7. **`tuyapi` sem manutenção ativa** (último 7.7.1) — risco técnico anotado.

---

## 7. Fontes

**Intelbras:** Manual EWS 410 02-20, 01-24/01-26, Datasheet v2.0, loja oficial, página EWS 410 & ELW 1001, review Tecnoblog, fórum Intelbras (pareamento EZ/AP), fórum HA Brasil (EWS 410 no Izy+Tuya Smart+HA).
**Tuya:** Link Devices (Method 3), Standard Instruction Set Light (dj), Get specifications (values=String JSON), Configuration Wizard Smart Home, OEM App Data Centers, suporte (1 device=1 conta), País→DC (BR=Western America).
**Local:** tinytuya README/PROTOCOL.md (3.1–3.5), tuyapi README/Issue #481/PR #606, @tuyapi/cli, LocalTuya (xZetsubou/rospogrigio), make-all/tuya-local.
**HA:** integração Tuya oficial, tuya/light.py (v1/v2 FallbackColorDataMode), Issue #19074 (colour_data string), threads Link account/Data Center.
**Código CASAI:** `tuya.adapter.ts`, `tuya-cloud.adapter.ts`, `home-assistant.adapter.ts`, `spikes/tuya-test.ts`, `device-adapter.factory.ts`, `device-adapter.interface.ts`.
