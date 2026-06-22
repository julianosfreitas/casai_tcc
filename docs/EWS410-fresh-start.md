# CASAI — EWS 410: recomeço eficiente (conta Tuya nova)

> **Data:** 2026-06-22 · Gerado por análise multi-agente (regra real do limite Tuya + gap do MVP + métodos de extração de `local_key`).
> **Em uma linha:** o limite "upper limit of 2" é da conta **SmartLife** (login do celular que escaneia o QR), **não** da conta dev `iot.tuya.com`. Criar conta dev nova **não** zera nada. Pareie o hardware **antes** de linkar a nuvem.

---

## TL;DR

- **O limite NÃO é da conta DEV iot.tuya.com** — é da conta **SmartLife** (o login do celular). Cada conta SmartLife pode estar linkada a no máximo **2 cloud projects ao mesmo tempo**. A sua conta SmartLife antiga já estava 2/2.
- **Criar conta DEV nova NÃO resolve nada.** Quem precisa ser nova (ou ter um slot liberado via unlink) é a conta **SmartLife**. Se você re-escanear o QR com a mesma conta SmartLife antiga, o erro volta.
- **O device virtual `vdevo...` deu falso progresso**: validava só o template da nuvem, sem hardware atrás. "8/8 verde" mas nada controlava a lâmpada real.
- **O que de fato falta**: parear a EWS 410 **física** no SmartLife (nunca foi feito), extrair `device_id`+`local_key` reais, e calibrar o `tuya.adapter.ts` pelo DUMP real de DPS (a contradição POWER:20 vs POWER:1 só o hardware resolve).
- **Regra de ouro desta vez**: parear a lâmpada física PRIMEIRO → 1 projeto, 1 data center (Western America), 1 Link App Account → rodar o bootstrap → calibrar. **Não queime os 2 slots antes de existir hardware real no app.**

## Post-mortem: o que estourou o limite dos 2 projetos

**A mecânica real (conta-app vs conta-dev):**

O texto oficial da Tuya (doc "Link a Tuya app account") é literal: *"Each app account can be linked with two projects at most."* O contador de 2 vive do lado da **conta de aplicativo SmartLife** (a credencial escaneada no QR), **não** do lado da conta DEV nem do projeto.

- Um mesmo **cloud project** pode conter **várias** contas de app linkadas — sem limite.
- Sua **conta DEV** pode criar **quantos** projetos quiser — sem limite.
- Mas cada **conta SmartLife** só pode estar linkada a **2 projetos simultâneos**. É esse o slot que estourou.

**O que queimou os slots na prática:** cada vez que você fez `Devices > Link Tuya App Account > Add App Account` e escaneou o QR confirmando o login, aquela conta SmartLife passou a ocupar 1 dos seus 2 slots **naquele projeto**. Duas tentativas anteriores (ex.: um projeto de teste antigo + o projeto atual do `vdevo`) = **2/2 = limite atingido**.

Importante: **o device virtual `vdevo...` por si só NÃO queimou slot.** Ele foi adicionado dentro do projeto pelo Device Simulator, não via Link App Account. O que gastou os 2 slots foram as **tentativas de linkar a conta SmartLife** a projetos.

**A conta nova realmente zera? E QUAL conta precisa ser nova?**

- Conta **DEV iot.tuya.com nova → NÃO zera nada** (o limite não é dela).
- Conta **SmartLife nova (email/celular diferente) → zera (0/2)** e pode linkar imediatamente.

Atenção: você confirmou que criou uma **conta DEV nova**. Mas se for re-escanear o QR com a **mesma conta SmartLife antiga (2/2)**, o erro volta. **A ação que zera é parear a EWS 410 numa conta SmartLife NOVA no celular e escanear o QR com ela.**

**Cuidado clássico (erro "Data Center" / 2406):** o data center do cloud project precisa servir a **região da conta SmartLife**. Antes de escanear, confira em `Me > Settings > Account and Security > Region` e garanta que bate com o DC do projeto (Western America). Slot livre + região errada = ainda dá erro.

**Como liberar o slot na conta antiga (unlink), se quiser reaproveitar a conta SmartLife antiga:**

1. Entre em https://platform.tuya.com/ (ou iot.tuya.com) com a conta DEV que detém o projeto linkado.
2. `Cloud > Development > My Cloud Projects` → abra o projeto que segura o slot.
3. Abra a aba **Devices**.
4. Clique em **Link Tuya App Account** (ou **Link My App**, conforme foi linkado).
5. Na lista de contas de app linkadas, coluna **Operation**, clique em **Unlink**. Confirme.
6. Isso libera 1 dos 2 slots. Repita no outro projeto para voltar a 0/2.

> Se você **não tem mais acesso** ao(s) projeto(s) antigo(s), não dá pra unlinkar por lá — nesse caso o caminho prático é **conta SmartLife NOVA** (slot 0/2). Deletar projeto não é o caminho garantido; o documentado é Unlink.

## O que erramos (review de eficiência)

1. **(MAIOR ERRO) Linkamos a nuvem antes de existir hardware real.** Gastamos os 2 slots de Link App Account num projeto que só tinha `vdevo...`, sem nunca ter pareado a lâmpada física no SmartLife. Resultado: 2 slots queimados validando template, zero controle de hardware, e o erro "upper limit of 2" forçando recomeçar. O recurso limitado e irreversível (sem unlink) foi consumido por nada.
2. **Confiamos no device virtual `vdevo...`.** Ele responde a `/specification` e a status na nuvem, então o `TuyaCloudAdapter` e os spikes de nuvem "passavam" — dashboards verdes, falsa sensação de 8/8 funcional. Mas `vdevo` só valida o **template** da categoria `dj`: sem IP na LAN, sem `local_key` real de um módulo Wi-Fi físico. Nada controlava a lâmpada.
3. **Iteramos em código/nuvem antes de parear a lâmpada.** Toda calibração do adapter ficou no chute porque nunca houve hardware na LAN.
4. **Deixamos a contradição de DPS sem resolver.** `tuya.adapter.ts:16` assume v2 (POWER:20…) e `spikes/tuya-test.ts` assume v1 (POWER:1). Sem dump físico, ninguém sabe qual está certo — e se for v1, todo comando do adapter falha silenciosamente.

## O que de fato falta no projeto

**MVP — status:**

| Feature | Status | Observação |
|---|---|---|
| Auth JWT | done | `apps/api/src/auth/*` + spec; escopa por userId |
| Modo MOCK | done | `mock.adapter.ts` + spec; seed popula MOCK |
| Voz pt-BR (Whisper STT + parser) | done | `apps/api/src/voice/*` |
| Dashboard + widgets | done | `apps/web/src/app/dashboard/` |
| Automações por horário | done | `automations.service.ts`, `actions-runner.ts`, `conditions.ts` |
| Cenas (scenes) | done | `apps/api/src/scenes/*` |
| Dashboard de energia | done | `energy.service.ts`; mas `readEnergy` real depende do Tapo real (hoje MOCK) |
| WebSocket tempo real | done | `casai.gateway.ts`, `device-events.ts` |
| Tema claro/escuro | done | `globals.css` + `layout.tsx` |
| Gamification | done | extra, fora do corte MVP |
| Controle local Tuya (LAN) | **partial** | adapter wired, mas DPS são chute, sem work_mode, nenhum device TUYA real cadastrado |
| Controle local Tapo (P110) | **done (provado 2026-06-22)** | conecta e controla de verdade (ver "Testes de conexão"). Frágil: creds só no banco, `.env` vazio, `seed.ts:52` força MOCK → reseed perde a tomada real |
| Descoberta na LAN | **partial** | `network-scanner.service.ts` funcional, nunca validado contra a EWS 410 |
| Adapter Tuya Cloud | **partial** | só exercido contra `vdevo`; manter só como fallback |

**EWS 410 — passos concretos restantes:**

1. **NO CELULAR (nunca foi feito):** remover a lâmpada do app Izy/Mibo se estiver lá; resetar (liga/desliga interruptor 5x ~2s até piscar **rápido** = modo EZ); parear no **SmartLife** (não Izy) na Wi-Fi **2,4 GHz**; confirmar liga/desliga e cor **dentro do SmartLife**.
2. **NA NUVEM (uma vez):** projeto `casai` (Western America / `openapi.tuyaus.com`) → Devices → Link Tuya App Account → QR → escanear no SmartLife. Confirmar a lâmpada **Online** em All Devices antes de qualquer código.
3. Rodar `node spikes/ews410-bootstrap.cjs`. Estágio 1 confirma device físico (`category 'dj'`, id **não-`vdevo`**) e extrai `device_id` + `local_key` reais. Se só achar `vdevo`, ele **para** — passo 1/2 não completou.
4. Ler estágio 2 (`/specification`): decidir **v1** (escala 0-255, DPS 2/3/4/5) vs **v2** (escala 10-1000, DPS 20/22/23/24) e a faixa **real** de Kelvin (~3000-6500K).
5. Ler o **DUMP REAL de DPS** (estágio 4): único árbitro de POWER:20 vs POWER:1. Anotar quais DPS existem.
6. Descobrir IP + versão de protocolo (3.3/3.4/3.5) via broadcast LAN (estágio 3), com o **SmartLife FECHADO** (a lâmpada aceita 1 conexão local por vez).
7. Cadastrar device real no CASAI via `POST /devices`: `{ protocol:'TUYA', externalId:device_id, ip, protocolVersion, localKey (cifrado AES-256-GCM), supportsBrightness/Color/ColorTemp:true }`.
8. Validar ponta-a-ponta pelo PWA: on/off, brilho, temperatura, cor batendo no hardware, e estado real voltando pelo WebSocket. Só então deixa de ser "partial".

**Problemas de código a corrigir APÓS o dump real:**

| Arquivo | Problema | Fix |
|---|---|---|
| `tuya.adapter.ts:16` | DPS hardcoded v2 (POWER:20/22/23/24) vs `spikes/tuya-test.ts` v1 (POWER:1). Se for v1, tudo falha em silêncio. | Substituir constantes pelos DPS observados; idealmente derivar do `/specification` ou guardar mapa por device no banco. |
| `tuya.adapter.ts:74-77` | Escala de brilho v2 hardcoded 10-1000 (`10 + value/100*990`). Se for v1 (0-255), brilho fica errado. | Ler `bright_value` min/max do `/specification`, parametrizar por device. |
| `tuya.adapter.ts:90-93` | Kelvin piso hardcoded 2700K, mas EWS 410 ~3000-6500K — interpolação desloca todos os valores. | Trocar 2700 por 3000 (ou faixa real `temp_value`); adicionar `minKelvin/maxKelvin` por device ao `schema.prisma`. |
| `tuya.adapter.ts` (setColor/setColorTemp) | Nenhum set de **work_mode** no caminho LAN. RGBCW ignora cor se estiver em 'white' e ignora temp se estiver em 'colour'. | `setColor()` → `work_mode='colour'` antes de DPS COLOR; `setColorTemp()/setBrightness()` → `work_mode='white'` antes. Confirmar DPS de work_mode (provável 21 no v2) pelo dump. |
| `prisma/seed.ts:52` | Força `Protocol.MOCK` para TODOS os devices — Tapo não está como TAPO ONLINE real, e não há device TUYA. | Respeitar `d.protocol`; registro separado p/ Tapo real e p/ a EWS 410. |
| `tuya-cloud.adapter.ts` | Só validado contra `vdevo` (mascarou a falta de hardware). | Manter TUYA_CLOUD estritamente como fallback; caminho primário da EWS 410 é TUYA (LAN). |

## Testes de conexão executados (2026-06-22)

Bateria de testes reais rodada com a stack local no ar (API :4000 → adapters → LAN). Resumo:

**Tomada TP-Link Tapo P110 — ✅ CONECTA E CONTROLA (ponta-a-ponta, hardware real):**

| Teste | Resultado |
|---|---|
| `ping 192.168.25.61` | ✓ responde, 0% perda |
| Creds | reais **no banco** (`Device.tapoEmail` 27 chars + `tapoPassEnc` cifrado 84 chars), **não no `.env`** (TAPO_* vazias) |
| `GET /devices/:id/state` | **200** `{on:false}` (52 ms — sessão em cache) |
| `POST /command {turnOn}` | **200** `{on:true}` — tomada **ligou** |
| `POST /command {turnOff}` | **200** `{on:false}` — tomada **desligou** (restaurado) |
| Prova de que não é fallback | `handleControlError` **lança** 503/422 em falha; recebemos **200** → conexão real (sem mock silencioso) |
| Energia | `energy/summary` = 0 W, `energy/history` = 0 pontos → poller ainda não acumulou (ou tomada sem carga = 0 W real). **A verificar.** |

> Pegadinha: o `status=ONLINE` do seed é cravado na mão (`seed.ts:53`) — não confunda com prova. A prova é o **200 do `/command`** (que falharia 503/422 se o hardware não respondesse).

**Lâmpada Intelbras EWS 410 — ❌ AUSENTE (esperado):**

| Teste | Resultado |
|---|---|
| Tuya LAN discovery (UDP 6666+6667, 15 s) | **0 devices** → lâmpada não está broadcastando (não pareada nesta Wi-Fi / offline) |
| Creds `.env` (`TUYA_EWS410_ID/KEY/IP`) | **vazias** (len 0) — nunca pareada |
| `TUYA_CLOUD_*` | preenchidas, mas são da **conta velha** (a do limite 2) |

**O que falta, por dispositivo:**
- **Tapo:** nada funcional **agora** (funciona). Falta robustez: persistir as creds de forma reproduzível (corrigir `seed.ts` p/ respeitar `d.protocol` e re-cadastrar a tomada, ou documentar o re-cadastro pelo app) + confirmar a telemetria de energia (poller).
- **EWS 410:** tudo do runbook abaixo — parear no SmartLife (conta de app nova) → 1 link → extrair `local_key` → cadastrar como `protocol:TUYA`.

## Runbook fresh-start (a prova de slot)

**Ordem certa, eficiente:**

1. **Parear a lâmpada FÍSICA no SmartLife PRIMEIRO.** No celular: use uma **conta SmartLife NOVA dedicada ao TCC** (slot 0/2). Confira `Me > Settings > Account and Security > Region` = bater com **Western America**. Resete a EWS 410 (interruptor 5x ~2s até piscar **rápido** = EZ), pareie na Wi-Fi **2,4 GHz**, e **teste no próprio app**: liga/desliga, brilho, cor. Só avance quando funcionar dentro do SmartLife.
2. **UM projeto, UM data center.** Em iot.tuya.com com a conta DEV: crie **1** projeto `casai`, Data Center = **Western America** (`openapi.tuyaus.com`). Anote Access ID/Client ID e Access Secret no Overview.
3. **UM Link App Account.** `Cloud > projeto > Devices > Link Tuya App Account > Add App Account` → `Automatic` + `Read Only Status` → gera QR. No SmartLife: aba **Me** → ícone QR (canto sup. dir.) → escanear. Isso consome **1 dos 2 slots** (sobra 1 de folga). Confirme a lâmpada **Online** em All Devices.
4. **Extrair `device_id` + `local_key`.** Caminho recomendado — **tinytuya wizard** (gasta o MESMO slot, não consome a mais):
   ```
   pip install tinytuya
   python -m tinytuya wizard      # informe API ID, API Secret, Region = us
   ```
   Gera `devices.json`/`snapshot.json` com `local_key`, `id`, `version` (3.3/3.4/3.5), `ip` de todas as devices de uma vez. `python -m tinytuya scan` acha IP+protocolo na LAN.
   Em seguida rode `node spikes/ews410-bootstrap.cjs` (já usa tuyapi LAN) com o `device_id`+`local_key`. Estágio 1 para se só achar `vdevo`.
5. **Cadastrar o device no CASAI** via `POST /devices` (ver bloco EWS 410 acima). Hoje não há nenhum device TUYA no banco — o seed só cria MOCK.
6. **Calibrar o adapter pelo dump.** Resolva v1-vs-v2 (DPS), escala de brilho, faixa de Kelvin e work_mode conforme o `/specification` + dump real. Aplique os fixes da tabela de código.

**O que NÃO fazer:**

- **NÃO** criar vários projetos descartáveis nem re-escanear o QR repetidamente com a mesma conta — cada link consome slot e não se libera sozinho.
- **NÃO** linkar a mesma conta SmartLife em vários data centers achando que separa o contador — o limite é por identidade da conta de app, independente do DC.
- **NÃO** confiar no device virtual `vdevo` como prova de integração — ele não controla hardware.
- **NÃO** mexer em `tuya.adapter.ts:16` (DPS) antes de ter o dump físico em mãos.
- **NÃO** escanear nenhum QR antes de conferir que a Region da conta SmartLife bate com o DC do projeto.
- **NÃO** rodar o broadcast/controle LAN com o SmartLife aberto (a lâmpada aceita 1 conexão local por vez).

## Checklist de uma olhada

- [ ] Conta SmartLife NOVA criada (ou slot liberado via Unlink na antiga) — slot 0/2 ou 1/2
- [ ] Region da conta SmartLife = Western America (Me > Settings > Account and Security > Region)
- [ ] EWS 410 resetada (5x interruptor, pisca rápido = EZ) e pareada no SmartLife na Wi-Fi 2,4 GHz
- [ ] Liga/desliga, brilho e cor testados DENTRO do app SmartLife
- [ ] 1 projeto `casai` criado em iot.tuya.com, Data Center = Western America (openapi.tuyaus.com)
- [ ] Access ID + Access Secret anotados (Overview)
- [ ] Link Tuya App Account feito UMA vez (QR escaneado) — lâmpada Online em All Devices
- [ ] `tinytuya wizard` rodado → `device_id` + `local_key` + version reais obtidos
- [ ] `node spikes/ews410-bootstrap.cjs` rodado (passou do estágio 1: id NÃO-`vdevo`)
- [ ] DPS real anotado do dump → contradição POWER:20 vs POWER:1 resolvida
- [ ] IP + versão de protocolo (3.3/3.4/3.5) descobertos na LAN (SmartLife fechado)
- [ ] Device real cadastrado no CASAI via POST /devices (protocol: TUYA)
- [ ] `tuya.adapter.ts` calibrado (DPS, escala de brilho, Kelvin 3000-6500, work_mode)
- [ ] `seed.ts:52` corrigido (respeitar d.protocol; Tapo real como TAPO)
- [ ] Validação ponta-a-ponta no PWA: on/off, brilho, temp, cor + estado via WebSocket
