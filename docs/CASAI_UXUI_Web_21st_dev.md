# CASAI — UX/UI Web com 21st.dev + shadcn/ui

> Seção complementar ao PRD. Define a interface como um **dashboard web** baseado
> em componentes do **21st.dev** (registro comunitário shadcn/ui), pensado para
> rodar como container Docker no **CasaOS**, ao lado do Home Assistant.

---

## 1. Decisão de arquitetura: por que web em vez de React Native

O 21st.dev é um registro de componentes **shadcn/ui** — React web + Tailwind + Radix UI,
instaláveis com `npx shadcn add`. Não rodam em React Native. Adotá-lo implica construir
a interface como um dashboard web.

No contexto de um homelab (DietPi + CasaOS + Docker), isso é uma vantagem, não uma
limitação:

| Critério | App React Native | Dashboard Web (escolhido) |
|----------|------------------|---------------------------|
| Componentes 21st.dev/shadcn | Não compatível | Compatível |
| Deploy no CasaOS | Não se aplica | Container Docker (igual aos outros serviços) |
| Acesso multi-device | App store (iOS/Android) | Qualquer navegador + PWA |
| Coerência com o homelab | Baixa | Alta (igual Grafana, Immich, Jellyfin) |
| Integração com Home Assistant | Via API | Via API ou iframe no dashboard |
| Voz no navegador | Nativo | Web Audio API + Whisper no hub |

**Recomendação:** dashboard web PWA. Mantém a filosofia de autonomia e controle local
do homelab, instala como app no celular (PWA), e libera todo o ecossistema shadcn/21st.dev.

---

## 2. Stack da interface web

- **Framework:** Next.js 15 (App Router) ou Vite + React 19 — Next recomendado pelo PWA e SSR
- **Linguagem:** TypeScript
- **Estilo:** Tailwind CSS v4
- **Componentes base:** shadcn/ui (primitivos Radix)
- **Componentes/blocos prontos:** 21st.dev (registro comunitário)
- **Gráficos:** Recharts (via shadcn Chart) — você já domina do Tuttor Fiscal
- **Estado:** TanStack Query (server state) + Zustand (UI state)
- **Tempo real:** Socket.IO client
- **PWA:** next-pwa (instalável no celular, ícone na tela inicial)
- **Tema:** next-themes (claro/escuro/sistema via CSS variables do shadcn)

Instalação de componentes do 21st.dev:
```bash
npx shadcn@latest add "https://21st.dev/r/<autor>/<componente>"
# Ex (primitivo oficial): npx shadcn@latest add "https://21st.dev/r/shadcn/card"
```

---

## 3. Mapa de componentes — CASAI → 21st.dev / shadcn

Para cada elemento da interface, o componente-base recomendado. Os primitivos
`shadcn/*` são oficiais e estáveis; os blocos comunitários você escolhe navegando
no 21st.dev por categoria (dashboard, sidebar, card, chart, background).

| Elemento CASAI | Componente base (shadcn) | Bloco 21st.dev a buscar |
|----------------|--------------------------|--------------------------|
| Layout geral / navegação | `sidebar`, `breadcrumb` | "dashboard sidebar", "app shell" |
| Card de dispositivo (widget) | `card` + `switch` | "stats card", "metric card", "bento grid" |
| Toggle on/off | `switch`, `toggle` | "animated toggle" |
| Controle de brilho | `slider` | "slider with value" |
| Seletor de cor RGB | `popover` + custom | "color picker" |
| Dashboard de energia | `card` + `chart` (Recharts) | "analytics dashboard", "area chart" |
| Métrica em destaque (W, kWh) | `card` | "stats with trend" |
| Agenda de automação (Mon/Tue) | `checkbox`, `calendar` | "schedule", "weekday picker" |
| Cena (botão de ação) | `button`, `card` | "action card" |
| Comando de voz (modal/FAB) | `dialog`, `command` | "command palette", "voice input" |
| Lista de dispositivos | `table`, `data-table` | "data table", "device list" |
| Adicionar dispositivo (wizard) | `dialog`, `form`, `stepper` | "multi-step form", "onboarding" |
| Configurações | `tabs`, `form`, `switch` | "settings page" |
| Notificações / alertas | `sonner` (toast), `alert` | "toast", "notification" |
| Tema claro/escuro | `dropdown-menu` + next-themes | "theme switcher", "mode toggle" |
| Estados vazios | `card` | "empty state" |
| Loading | `skeleton` | "skeleton loader" |
| Fundo do dashboard | — | "animated background", "grid background" |

> Dica: o 21st.dev tem coleções de "bento grid" e "dashboard" que reproduzem
> exatamente o visual de cards de smart home (estilo Aqara) que você referenciou.

---

## 4. Sistema de tema (dark-first glassmorphism)

O shadcn/ui usa CSS variables para temas, o que casa com a direção de arte
"Calm Tech, Bold Accent" do PRD. Configure em `globals.css`:

```css
@layer base {
  :root {
    --background: 210 40% 98%;       /* light: quase branco */
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --primary: 217 91% 64%;          /* azul elétrico #4F8EF7 */
    --accent: 47 95% 53%;            /* amarelo de ação */
    --radius: 1.25rem;               /* cantos generosos (20px) */
  }
  .dark {
    --background: 222 47% 6%;        /* dark: #0A0E1A */
    --foreground: 210 40% 96%;
    --card: 217 33% 12%;             /* superfície glass */
    --primary: 217 91% 70%;          /* azul mais claro no dark */
    --accent: 47 95% 53%;
    --border: 217 33% 20%;
  }
}
```

Glassmorphism nos cards (Tailwind):
```tsx
<Card className="bg-card/60 backdrop-blur-xl border-white/10
                 shadow-[0_0_24px_rgba(79,142,247,0.15)]">
```

Troca de tema com `next-themes` + um `mode-toggle` do 21st.dev — transição suave,
persistência automática, respeita a preferência do sistema.

---

## 5. Deploy como container no CasaOS

O CASAI entra no homelab como mais um serviço Docker, gerenciado pela App Store
do CasaOS / Portainer, exatamente como os outros 28 contêineres.

```yaml
# docker-compose.yml — adicionar ao stack do homelab
services:
  casai-web:
    build: ./apps/web
    container_name: casai-web
    ports: ["3100:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://casai-api:4000
    restart: unless-stopped

  casai-api:
    build: ./apps/api
    container_name: casai-api
    ports: ["4000:4000"]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@casai-db:5432/casai
    depends_on: [casai-db]
    restart: unless-stopped

  casai-db:
    image: postgres:16-alpine
    container_name: casai-db
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=casai
    volumes: ["casai_pgdata:/var/lib/postgresql/data"]
    restart: unless-stopped

volumes:
  casai_pgdata:
```

No CasaOS, o CASAI aparece como um app com ícone próprio no dashboard, monitorável
pelo Uptime Kuma (alerta no Telegram se cair) e com métricas no Grafana — reaproveitando
toda a infraestrutura de observabilidade que você já tem.

---

## 6. Integração com o Home Assistant (opcional, mas poderosa)

Como você já roda Home Assistant no homelab, há duas estratégias de integração:

**Estratégia A — CASAI complementa o HA.** O CASAI foca no que faz bem (voz pt-BR,
UX simples para leigos, controle local de Tuya/Tapo) e o Home Assistant cuida do resto.
O CASAI consome a REST API do HA (`/api/states`, `/api/services`) para refletir e
controlar dispositivos que já estão no HA.

**Estratégia B — CASAI embute o HA.** O dashboard do CASAI inclui um card que abre
o controle visual 3D do Home Assistant via iframe, unificando tudo numa interface só.

Para o TCC, a Estratégia A é mais defensável: mostra que o CASAI é um sistema autônomo
que pode coexistir e interoperar com soluções consolidadas — exatamente o argumento de
interoperabilidade do trabalho.

---

## 7. Voz no navegador (sem React Native)

A captura de áudio usa a Web Audio API / MediaRecorder do navegador, e o áudio é
enviado ao Whisper rodando no hub:

```tsx
async function gravarComando() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => chunks.push(e.data)
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' })
    const form = new FormData()
    form.append('audio', blob)
    const { transcript, intent, deviceId } =
      await api.post('/voice/transcribe', form)
    // executa o comando...
  }
  recorder.start()
  setTimeout(() => recorder.stop(), 3000)  // 3s de captura
}
```

O FAB de microfone usa um componente de "voice input" do 21st.dev com animação de
onda durante a captura.

---

## 8. Impacto no Playbook do Claude Code

Se adotar o dashboard web, o **Prompt 9** do playbook muda de "App React Native" para:

```
Crie o dashboard web em apps/web com Next.js 15 + TypeScript + Tailwind + shadcn/ui.

Configure shadcn (npx shadcn init) com tema dark-first e CSS variables do CASAI.
Instale os componentes-base do registro shadcn e busque blocos no 21st.dev para:
dashboard sidebar, bento grid de cards, stats card, area chart, command palette,
mode toggle, multi-step form.

Conecte na API via TanStack Query + Socket.IO. Implemente:
- Tema claro/escuro com next-themes
- Componente <DeviceWidget /> usando Card + Switch com glassmorphism
- Dashboard com bento grid de widgets
- Dashboard de energia com Recharts (area chart)
- FAB de microfone com Web Audio API → POST /voice/transcribe
- PWA com next-pwa (instalável no celular)

Antes de instalar cada bloco do 21st.dev, abra a página do componente e confirme
as dependências (peer deps Radix) e a compatibilidade com Tailwind v4.
```

O resto do playbook (backend NestJS, Prisma, adapters, voz no hub) permanece igual —
só a camada de apresentação muda de nativa para web.
