# Deploy do PWA no Cloudflare Pages

Guia rápido para publicar o **app-igreja** via `git push` no GitHub. O Cloudflare Pages faz o build automaticamente a cada push na branch `main`.

**Repositório:** https://github.com/maufreitas63/app-igreja

---

## Visão geral

```mermaid
flowchart LR
  A[Alterações locais] --> B[git commit]
  B --> C[git push origin main]
  C --> D[GitHub]
  D --> E[Cloudflare Pages — build]
  E --> F[PWA publicado em HTTPS]
```

| Etapa | Quem executa |
|-------|----------------|
| Build | Cloudflare (`npm run build:web`) |
| Publicação | Cloudflare (pasta `dist/`) |
| Gatilho | Push na branch `main` |

---

## Configuração do projeto no Cloudflare (uma vez)

No painel [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**:

| Campo | Valor |
|-------|--------|
| Repositório | `maufreitas63/app-igreja` |
| Branch de produção | `main` |
| Framework preset | **None** (ou Expo, se disponível — o comando abaixo é o que importa) |
| Build command | `npm run build:web` |
| Build output directory | `dist` |
| Root directory | *(vazio — raiz do repositório)* |

### Variáveis de ambiente (Build)

Em **Settings → Environment variables** do projeto Pages, configure:

| Variável | Valor | Obrigatória |
|----------|--------|-------------|
| `NODE_VERSION` | `20` | Sim |
| `NODE_OPTIONS` | `--max-old-space-size=6144` | Recomendado |
| `PUPPETEER_SKIP_DOWNLOAD` | `true` | Recomendado |

Variáveis opcionais do app (só se precisar no build/runtime):

| Variável | Uso |
|----------|-----|
| `EXPO_PUBLIC_GOOGLE_MAPS_GEOCODING_API_KEY` | Geocodificação Google (senão usa ViaCEP + OSM) |
| `EXPO_PUBLIC_ACL_STRICT` | `true` para negar acesso quando RPC de ACL estiver ausente |

> O Supabase usa valores padrão em `lib/supabaseConfig.ts`. Para outro projeto/ambiente, defina `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no Cloudflare.

---

## Fluxo diário: git push

### 1. Conferir o que será enviado

```powershell
cd c:\Users\maufr\.cursor\MProj\ecossistema\app-igreja
git status
git diff
```

### 2. Commitar (se ainda não commitou)

```powershell
git add .
git commit -m "descreva aqui a alteração"
```

### 3. Enviar para o GitHub

```powershell
git push origin main
```

Pronto. O Cloudflare detecta o push e inicia um novo deploy em alguns segundos.

### 4. Acompanhar o build

1. Cloudflare Dashboard → seu projeto Pages → aba **Deployments**
2. Aguarde status **Success** (build costuma levar 2–8 minutos)
3. Abra a URL do projeto (ex.: `https://app-igreja.pages.dev` ou domínio customizado)

### 5. Validar no navegador

Após o deploy:

- Use **Ctrl+Shift+R** (hard refresh) para evitar cache antigo do PWA
- Teste login, dashboard e o atalho que você alterou
- Se instalou como PWA, feche e reabra o app ou limpe o cache do site

---

## Testar o build localmente (antes do push)

Evita falhas no Cloudflare:

```powershell
cd c:\Users\maufr\.cursor\MProj\ecossistema\app-igreja
npm install
npm run build:web
```

Se terminar sem erro, a pasta `dist/` foi gerada. Opcional: servir localmente:

```powershell
npx serve dist
```

Requisito de Node: **≥ 20.19.4** (ver `package.json` e `.nvmrc`).

---

## Solução de problemas

| Sintoma | O que verificar |
|---------|------------------|
| Build falha com erro de memória | `NODE_OPTIONS=--max-old-space-size=6144` no Cloudflare |
| `git` não encontrado no build | Não afeta o deploy atual; build usa `npm run build:web` |
| Node 18 / erro Metro | `NODE_VERSION=20` nas variáveis do Cloudflare |
| PWA antigo após deploy | Hard refresh (Ctrl+Shift+R) ou limpar dados do site |
| Ícones aparecem como `?` ou quadrado | Fontes em `assets/fonts/` + `public/_headers`; confira no DevTools → Network se os `.ttf` retornam 200 (não 404) |
| Push rejeitado | `git pull origin main` antes de novo push |
| Deploy não dispara | Branch do push deve ser `main` (branch de produção no Pages) |

Logs completos do build: Cloudflare → **Deployments** → clique no deploy → **View build log**.

---

## Checklist rápido

- [ ] Alterações testadas localmente (`npm run web` ou `npm run build:web`)
- [ ] Commit criado com mensagem clara
- [ ] `git push origin main` concluído
- [ ] Deploy **Success** no Cloudflare
- [ ] PWA validado no navegador com hard refresh

---

## Referências no repositório

| Arquivo | Conteúdo |
|---------|----------|
| `package.json` | Script `build:web` → `expo export -p web` |
| `app.json` | Web: `bundler: metro`, `output: static` |
| `.nvmrc` | Node 20 |
| `.env.example` | Variáveis opcionais do Expo |
| `ARQUITETURA_BLUEPRINT_PWA.md` | Arquitetura do PWA |

---

*App IBN · Deploy Cloudflare Pages · atualizado em 22/05/2026*
