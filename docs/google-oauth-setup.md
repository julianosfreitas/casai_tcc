# CASAI — Configurar "Entrar com o Google" (corrige o Erro 401 invalid_client)

> **Data:** 2026-06-22 · **Sintoma:** *"Access blocked: Authorization Error — The OAuth client was not found. Error 401: invalid_client"* ao clicar em Entrar com o Google (local e deploy).
>
> **Causa:** o Client ID configurado (`317087068529-phanuc0...`) **foi deletado / não existe** na conta Google atual. O Google não reconhece o cliente → `invalid_client`. **O código do CASAI está correto** (front envia o `idToken`, backend valida `audience` + `email_verified`, cria/acha o usuário) — o que falta é **configuração no Google Cloud Console + variáveis de ambiente**, que só você consegue fazer.

---

## O que o CASAI já faz (não precisa mexer)

- **Front** (`sign-up.tsx` → `GlassGoogleButton`): renderiza o botão oficial do Google Identity Services e devolve o `credential` (ID token JWT). Falha do SDK agora é isolada em `try/catch` → **nunca derruba a tela de login** (e-mail/senha seguem funcionando).
- **Back** (`auth.service.ts` → `signInWithGoogle`): valida o ID token com `OAuth2Client.verifyIdToken({ audience: GOOGLE_CLIENT_ID })`, exige `email_verified === true`, e emite os tokens do CASAI. Rota `POST /auth/google` é pública + rate-limit 5/min.

A única coisa que precisa estar certa: **um Client ID válido, com as origens autorizadas, igual no front e no back.**

---

## Passo a passo (Google Cloud Console)

> Faça logado na conta que vai ser dona do app (ex.: `julianof29contato@gmail.com`).

### 1. Projeto + Tela de consentimento
1. https://console.cloud.google.com → crie/escolha um projeto (ex.: `casai`).
2. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Preencha App name (`CASAI`), e-mail de suporte e de contato.
   - **Test users → Add users**: adicione o(s) e-mail(s) que vão logar (enquanto o app estiver em **Testing**, só esses entram). Inclua o seu.
   - Salve.

### 2. Criar o OAuth Client ID (Web)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **Web application**. Nome: `casai-web`.
5. **Authorized JavaScript origins** (o Google Identity Services usa ORIGENS, não redirect URIs) — adicione exatamente:
   - `http://localhost:3000`
   - `https://casai-tcc.vercel.app`
   - (se a Vercel der outros domínios de preview que você usa, adicione também — origem não listada = botão não renderiza / erro)
6. **Authorized redirect URIs**: pode deixar vazio (o fluxo do botão GSI não usa redirect).
7. **Create** → copie o **Client ID** (termina em `.apps.googleusercontent.com`).

---

## Onde colar o novo Client ID (MESMO valor nos dois lados)

O backend valida que o `aud` do token é o seu Client ID. Se o valor do front ≠ o do back, dá **401 "Não foi possível validar sua conta Google"**. Use o **mesmo** Client ID em:

| Lugar | Variável | Observação |
|---|---|---|
| Web local | `apps/web/.env.local` → `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | reinicie `npm run dev` |
| Web deploy | Vercel → Settings → Environment Variables → `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **build-time → faça Redeploy depois** |
| API local | `apps/api/.env` → `GOOGLE_CLIENT_ID` | reinicie a API |
| API deploy | Render → Environment → `GOOGLE_CLIENT_ID` | redeploy/restart |

> ⚠️ `NEXT_PUBLIC_*` é embutido no bundle em **build-time**. Trocar na Vercel **exige Redeploy** — não basta salvar a variável.

---

## Verificação

- [ ] OAuth consent screen criada (External) + seu e-mail em **Test users**
- [ ] OAuth client **Web** criado; origens `http://localhost:3000` e `https://casai-tcc.vercel.app` autorizadas
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web local + Vercel) = novo Client ID
- [ ] `GOOGLE_CLIENT_ID` (API local + Render) = **mesmo** Client ID
- [ ] `WEB_ORIGIN` no Render = `https://casai-tcc.vercel.app` (CORS, senão o `POST /auth/google` é bloqueado pelo browser)
- [ ] Redeploy da web na Vercel **e** da API no Render
- [ ] Testar: clicar em Entrar com o Google → escolher conta → cai logado no `/dashboard`

## Gotchas

- **invalid_client** = Client ID não existe / projeto errado / digitado errado.
- **Botão não aparece no deploy, sem erro** = origem (`https://casai-tcc.vercel.app`) não está nas Authorized JavaScript origins.
- **401 no `/auth/google`** = `GOOGLE_CLIENT_ID` (back) ≠ `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (front), ou e-mail Google não verificado.
- **Login some após trocar a env na Vercel** = faltou Redeploy (build-time).
- App em **Testing**: só os Test users entram. Para liberar geral, publique a consent screen (**Publish app**).
