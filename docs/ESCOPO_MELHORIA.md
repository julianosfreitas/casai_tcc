# CASAI — Escopo de Melhoria (rumo à apresentação do TCC)

> Criado em 2026-06-10. Este documento é o plano de trabalho para evoluir o CASAI
> do estado atual até a versão apresentável na defesa. Ordem de execução: Fase 0 → 7.

---

## 0. Diagnóstico do estado atual

O projeto está **muito mais maduro do que parece**. O que já existe e funciona:

| Área | Estado |
|------|--------|
| Backend NestJS (auth JWT, devices + adapters, automações cron, cenas, energia, voz pt-BR, WebSocket) | ✅ Completo, ~87% de cobertura de testes |
| Adapters Tuya / Tapo / Mock com criptografia AES-256-GCM | ✅ Completo |
| Web (Next.js 15 + PWA): login, dashboard com widgets, gráfico de energia, voz, dark/light | ✅ Funcional |
| Docker Compose (Postgres + Mosquitto + API + Web), CI no GitHub Actions | ✅ Completo |

O que **falta** (e é o foco deste escopo):

1. **UI de Automações e Cenas** — o backend tem CRUD completo, mas não existe NENHUMA tela para criar/editar automações ou cenas.
2. **UI de gerenciamento de Dispositivos e Cômodos** — não há tela para cadastrar um dispositivo (hoje só via seed/API).
3. **Navegação** — o app tem só login + dashboard; falta um shell de navegação (menu lateral / tabs).
4. **Paleta de cores fora do combinado** — hoje há um accent AMARELO (`--accent: 47 95% 53%`) e glow azul "neon" no `.glass`. A diretriz nova é monocromático azul, sem neon.
5. **Fontes** — Space Grotesk + Inter prometidas, não importadas.
6. **CLAUDE.md desatualizado** — ainda promete `apps/mobile` (Expo); a realidade decidida é `apps/web` (Next.js PWA).
7. **Swagger / testes E2E web** — qualidade/documentação.
8. **Deploy para a apresentação** — nada definido.

---

## 1. Decisão de arquitetura: a "API que integra tudo"

Pesquisa feita em 2026-06-10. Conclusões:

### 1.1 Intelbras = Tuya (não existe "API Intelbras" separada)

A linha Izy da Intelbras (incl. **EWS 410**) é **white-label da Tuya**: mesmo chip,
mesmo protocolo, mesmo app-base (Izy Smart = Tuya Smart rebrandeado). O `tuyapi`
que já usamos cobre Tuya **e** Intelbras com o mesmo código. Fontes:
fórum Home Assistant Brasil, datasheet Intelbras, docs do tinytuya/localtuya.

➡️ **Nada a fazer.** O `TuyaAdapter` atual já é a "integração Intelbras".

### 1.2 A plataforma open source que unifica tudo: Home Assistant

A que o usuário lembrava é o **Home Assistant** (home-assistant.io) — open source,
integra Tuya (via *LocalTuya*/*Tuya Local*), Tapo (via *python-kasa*, nativo) e
milhares de outros, e expõe **REST API + WebSocket API** para frontends customizados.
Alternativas: openHAB, ioBroker, Homebridge, Gladys Assistant.

### 1.3 Decisão (ADR-001): NÃO trocar o hub pelo Home Assistant

**Motivo:** o hub CASAI *é a contribuição do TCC*. Substituí-lo pelo Home Assistant
reduziria o trabalho a "um dashboard para o HA" e mataria as métricas (latência
voz→execução, custo, local-first próprio). O adapter pattern atual já faz, em escala
de TCC, o que o HA faz em escala industrial.

**O que fazer com o Home Assistant no TCC:**
- Citar como **trabalho relacionado** na monografia (comparação: HA exige hardware
  mais caro — Raspberry Pi 4+ — e curva de aprendizado; CASAI roda em qualquer
  notebook/mini-PC e é guiado em pt-BR).
- Justificar a escolha das libs por protocolo (`tuyapi`, `tp-link-tapo-connect`)
  exatamente como o HA faz internamente (localtuya, python-kasa).

---

## 2. Design System — paleta nova (DIRETRIZ FIRME)

**Monocromático azul. Sem neon, sem amarelo, sem glow.**

### Light mode — branco + azul
| Token | Valor | Uso |
|-------|-------|-----|
| `--background` | `#F7F9FC` (hsl 214 33% 98%) | fundo da página |
| `--card` | `#FFFFFF` | superfícies |
| `--foreground` | `#0F1C2E` (azul-quase-preto) | texto principal |
| `--primary` | `#1D4ED8` (azul escuro, blue-700) | botões, ações |
| `--primary-hover` | `#1E40AF` (blue-800) | hover |
| `--secondary` | `#E8EEF7` (azul 5%) | chips, fundos sutis |
| `--muted-foreground` | `#5A6B82` (azul-cinza) | texto secundário |
| `--accent` | `#3B82F6` (blue-500) | destaques, links, estados ativos |
| `--border` | `#D9E2EF` | bordas |
| `--destructive` | `#DC2626` | única cor fora do azul (erros) |

### Dark mode — preto + azul
| Token | Valor | Uso |
|-------|-------|-----|
| `--background` | `#070B12` (preto azulado) | fundo |
| `--card` | `#0E1624` | superfícies |
| `--foreground` | `#E4EAF2` | texto |
| `--primary` | `#60A5FA` (blue-400 — claro p/ contraste) | ações |
| `--secondary` | `#16213270` | fundos sutis |
| `--muted-foreground` | `#8294AB` | texto secundário |
| `--accent` | `#3B82F6` | destaques |
| `--border` | `#1C2A40` | bordas |

### Regras
- **Remover** o accent amarelo e o `box-shadow` azul-glow do `.glass` (é neon).
- Sombras: neutras e suaves (`0 1px 3px rgb(15 28 46 / 0.08)` no light; no dark,
  borda 1px em vez de sombra).
- Estados (on/off de dispositivo): tons de azul (ligado = primary, desligado = muted),
  nunca verde/amarelo.
- Fontes: **Space Grotesk** (títulos/números) + **Inter** (corpo) via `next/font/google`.
- Manter `--radius: 1.25rem` (identidade já estabelecida).

---

## 3. Fases de execução

### Fase 0 — Housekeeping (rápida)
- [ ] Atualizar `CLAUDE.md`: stack frontend = Next.js 15 PWA (`apps/web`), não Expo.
      Registrar ADR-001 (não usar Home Assistant) e a paleta da seção 2.
- [ ] Garantir repositório git limpo e commitado antes das mudanças.

### Fase 1 — Design System (base de tudo)
- [ ] Reescrever `apps/web/src/app/globals.css` com a paleta da seção 2.
- [ ] Adicionar Space Grotesk + Inter via `next/font` no `layout.tsx`.
- [ ] Substituir `.glass` por superfície sólida com borda sutil (sem blur pesado/glow).
- [ ] Revisar todos os componentes `ui/*` e widgets para remover cores hardcoded.
- **Critério de aceite:** nenhum amarelo/verde/neon em nenhuma tela; contraste AA.

### Fase 2 — Página de Login inicial (redesign)
- [ ] Tela dividida: painel de marca (logo CASAI, tagline "Sua casa, sua rede")
      + formulário. Em mobile, só o formulário com logo no topo.
- [ ] Validação client-side com mensagens em pt-BR; estados de loading e erro claros.
- [ ] Toggle entrar/criar conta já existe — polir transição.
- [ ] Botão "Entrar como demonstração" (usa o usuário do seed) — útil na defesa.
- **Critério de aceite:** login funcional, bonito nos dois temas, demo em 1 clique.

### Fase 3 — Shell de navegação
- [ ] Layout autenticado com sidebar (desktop) / bottom tabs (mobile PWA):
      **Início · Automações · Cenas · Dispositivos · Energia · Ajustes**.
- [ ] Header com nome do usuário, toggle de tema, sair.
- [ ] Voice FAB persistente em todas as telas.

### Fase 4 — Menu de Automações (o gap principal)
Backend já pronto (`/automations`, `/scenes`). Construir:
- [ ] **Lista de automações:** cards com nome, resumo do gatilho ("Todos os dias às
      19h"), switch ativar/desativar, última execução.
- [ ] **Criação/edição (wizard em 3 passos):**
      1. *Quando* — horário + dias da semana (UI de cron amigável, nunca expor cron cru);
      2. *Condições* (opcional) — faixa de horário, dia da semana;
      3. *Ações* — escolher dispositivo + comando (ligar/desligar/brilho/cor) e/ou
         ativar cena, com delay opcional entre ações.
- [ ] **Cenas:** lista + editor (nome, ícone, lista ordenada de ações) + botão
      "ativar agora" no dashboard.
- [ ] Feedback em tempo real: toast quando `automation:triggered` chegar no socket.
- **Critério de aceite:** criar "Apagar tudo às 23h" inteiro pela UI e vê-la disparar.

### Fase 5 — Gerenciamento de Dispositivos e Cômodos
- [ ] Lista de dispositivos por cômodo, com status online/offline.
- [ ] **Adicionar dispositivo (formulário guiado por protocolo):**
      - Tuya/Intelbras: nome, IP, deviceId, localKey (com link pro HARDWARE_SETUP.md);
      - Tapo: nome, IP, e-mail/senha Tapo;
      - Mock: 1 clique (para demo).
- [ ] Editar/remover dispositivo; criar/renomear cômodos.
- [ ] Tela de detalhe: estado atual, histórico de energia do aparelho.
- **Critério de aceite:** cadastrar a EWS 410 real inteiro pela UI, sem tocar no banco.

### Fase 6 — Qualidade e documentação
- [ ] Swagger (`@nestjs/swagger`) em `/docs` — vale slide na defesa.
- [ ] Testes de componentes web (Testing Library) para automações e login.
- [ ] Lighthouse PWA ≥ 90; revisar manifest/ícones.
- [ ] Atualizar README com screenshots novos.

### Fase 7 — Deploy para a apresentação
Conflito a reconhecer: o CASAI é **local-first** — controle de hardware real só
funciona na LAN. Estratégia em duas camadas:

**A. Demo ao vivo (defesa) — roda local, custo R$ 0:**
- Notebook com `docker-compose up` + roteador/hotspot próprio levado à sala
  (não dependa do Wi-Fi da faculdade). Lâmpada EWS 410 + tomada P110 na mesa.
- Ensaiar o caminho: voz → "acende a luz da sala" → lâmpada acende → latência no log.

**B. URL pública (banca/avaliadores acessarem depois) — modo MOCK, free:**
- **Web (Next.js):** Vercel — free, sem sleep.
- **API (NestJS):** Render free (dorme após 15 min — aceitável; avisar no README)
  ou Railway (~US$ 1–5 de crédito/mês). Variável `DEMO_MODE=true`: só devices MOCK,
  voz por texto (sem Whisper — pesado demais p/ free tier), seed automático.
- **Postgres:** Neon (free) ou o Postgres do Render/Railway.
- **Alternativa elegante:** Cloudflare Tunnel apontando para o hub local durante a
  apresentação — URL pública controlando hardware REAL, custo zero (citar como
  "acesso remoto" = item de fase futura demonstrado).

**Custo total do plano: R$ 0** (Render free + Vercel free + Neon free).

---

## 4. Fora de escopo (continua proibido no MVP)
Zigbee/Matter, app nativo Expo, multiusuário, TLS na LAN, rotação de refresh token,
Redis. (Ver CLAUDE.md §8–9.)

## 5. Ordem sugerida de PRs/commits
1. `docs: atualiza CLAUDE.md (web PWA, ADR-001, paleta azul)`
2. `feat(web): design system monocromático azul + fontes`
3. `feat(web): redesign da página de login`
4. `feat(web): shell de navegação autenticado`
5. `feat(web): CRUD de automações e cenas`
6. `feat(web): gerenciamento de dispositivos e cômodos`
7. `feat(api): swagger em /docs` + `test(web): cobertura de telas novas`
8. `chore: deploy demo (Vercel + Render + Neon, DEMO_MODE)`
