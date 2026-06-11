# CASAI — Deploy para a apresentação do TCC

Estratégia em **duas camadas**: a defesa ao vivo roda **local** (hardware real),
e a **URL pública** serve para a banca mexer no sistema depois (modo demo, MOCK).
Custo total: **R$ 0**.

---

## Camada 1 — Defesa ao vivo (notebook, hardware real)

1. Leve um **roteador/hotspot próprio** (não dependa do Wi-Fi da faculdade).
2. Conecte notebook + lâmpada EWS 410 + tomada P110 nessa rede.
3. No notebook:

```bash
docker compose up -d          # db + mqtt + api + web
# Web: http://localhost:3100 · API: http://localhost:4000
```

4. No **seu celular**, conectado no mesmo hotspot, acesse `http://IP-DO-NOTEBOOK:3100`,
   faça login e use o menu do navegador → **"Adicionar à tela inicial"**.
   O CASAI abre como app (PWA standalone) — a demo fica na palma da mão.
5. Ensaie o roteiro: voz → "acende a luz da sala" → lâmpada acende → mostrar
   latência em Conquistas/observabilidade.

> Dica: o IP do notebook aparece com `ipconfig` (campo IPv4 do adaptador do hotspot).

---

## Camada 2 — URL pública (banca acessa de qualquer lugar)

### a) API — Render (free)

1. Faça push do repositório para o GitHub.
2. Em [render.com](https://render.com): **New → Blueprint** → conecte o repo.
   O `render.yaml` na raiz cria a API + Postgres free.
3. Na criação, o Render pede dois valores:
   - `CASAI_ENCRYPTION_KEY`: gere com
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `WEB_ORIGIN`: a URL da web na Vercel (passo b) — pode preencher depois.
4. Com `DEMO_MODE=true` (já no blueprint), o boot semeia automaticamente:
   usuário `dev@casai.local / Senha@123`, 3 dispositivos MOCK (incl. ☕ Cafeteira),
   4 rotinas e 3 cenas. **Sem passo manual de seed.**

### b) Web — Vercel (free)

1. Em [vercel.com](https://vercel.com): **Add New → Project** → mesmo repo.
2. **Root Directory:** `apps/web` (framework Next.js detectado sozinho).
3. Environment Variables:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://casai-api.onrender.com/api` |
| `NEXT_PUBLIC_WS_URL` | `https://casai-api.onrender.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | (opcional) seu OAuth Client ID |

4. Deploy. Volte ao Render e ajuste `WEB_ORIGIN` para a URL da Vercel
   (ex.: `https://casai.vercel.app`) — é o CORS.
5. Se usar login Google: adicione a URL da Vercel nas *Authorized JavaScript
   origins* do OAuth Client.

### Limitações conhecidas do demo público (avisar a banca)

- **API dorme** após 15 min sem uso (free) — primeira requisição demora ~30-50s.
- **Voz por áudio (Whisper) fica desativada na nuvem** (o build do whisper.cpp não
  cabe no free tier) — a demo de voz é o ponto alto da defesa **local**.
- Dispositivos reais (Tuya/Tapo) não funcionam pela nuvem — o controle é
  local-first por princípio. O demo público usa os MOCK.

---

## Alternativa elegante: hardware REAL com URL pública

Durante a apresentação, um **Cloudflare Tunnel** no notebook expõe o hub local:

```bash
winget install Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3100
```

A URL `https://*.trycloudflare.com` gerada controla a lâmpada REAL da mesa —
e vira o slide "acesso remoto (fase futura) demonstrado". Custo zero.

---

## Checklist do dia da defesa

- [ ] Hotspot + notebook + lâmpada + tomada testados na véspera
- [ ] `docker compose up -d` sobe limpo
- [ ] PWA instalado no celular (tela inicial)
- [ ] Roteiro de voz ensaiado ("acende a luz da sala", "desliga a tomada")
- [ ] URL pública no slide final (QR code ajuda)
- [ ] Credencial demo no slide: `dev@casai.local / Senha@123` (ou botão 🚀)
