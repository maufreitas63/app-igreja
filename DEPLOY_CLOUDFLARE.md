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

| Etapa | Quem executa | Tempo típico |
|-------|----------------|--------------|
| Push → fila no Cloudflare | Automático | ~30 s |
| `npm install` + `npm run build:web` | Cloudflare | **3–10 min** |
| Propagação do deploy | Cloudflare | ~30 s |
| Navegador buscar HTML novo | Usuário (revalidação) | Imediato após deploy* |

\* O `public/_headers` manda o HTML a **revalidar sempre**; os JS/CSS com hash continuam em cache. Sem hard refresh, alguns navegadores/PWA instalados ainda podem demorar um pouco — veja seção abaixo.

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

Após o deploy aparecer **Success** (não basta o `git push` — aguarde o build):

1. Abra a URL em aba anônima **ou** use **Ctrl+Shift+R** (hard refresh)
2. Confira no DevTools → **Network** → documento HTML: cabeçalho `cache-control: public, max-age=0, must-revalidate`
3. Teste login, dashboard e a tela que você alterou
4. Se o app está **instalado como PWA**: feche todas as janelas, reabra; em último caso, limpe dados do site no navegador

### Formulário público de cadastro familiar (fora do app)

O `npm run build:web` gera **dois** artefatos na pasta `dist/`:

| Caminho | Conteúdo |
|---------|----------|
| `/` | PWA da igreja (login, dashboard, etc.) |
| `/cadastro-familia/` | Formulário standalone — **sem** AppShell, tabs nem login |

**Link para enviar aos usuários:**

```
https://{seu-dominio}/cadastro-familia/
```

Exemplo: `https://app-igreja.pages.dev/cadastro-familia/`

Desenvolvimento local do formulário (sem Expo):

```powershell
npm run dev:family-form
```

> **Por que parece “demorar”?** O código só entra em produção depois do build no Cloudflare (vários minutos). O push no Git é só o gatilho — não é publicação instantânea.

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
| PWA antigo após deploy | Aguardar deploy **Success**; hard refresh (Ctrl+Shift+R); PWA: fechar e reabrir. Headers em `public/_headers` evitam cache longo do HTML |
| Alteração no ar mas tela antiga | Build ainda em andamento na aba **Deployments**, ou cache local — aba anônima para testar |
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
| `package.json` | `build:web` → `build:family-form` (Vite) + `expo export -p web` |
| `standalone/cadastro-familia/` | Formulário público independente do PWA |
| `app.json` | Web: `bundler: metro`, `output: static` |
| `public/_headers` | Cache: HTML revalida sempre; `/_expo/static` e `/assets` com cache longo |
| `.nvmrc` | Node 20 |
| `.env.example` | Variáveis opcionais do Expo |
| `ARQUITETURA_BLUEPRINT_PWA.md` | Arquitetura do PWA |

---

*App IBN · Deploy Cloudflare Pages · atualizado em 22/05/2026*

```powershell
git push origin main
```
