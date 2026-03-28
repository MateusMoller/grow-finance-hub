# Grow Finance Hub (Web)

Aplicacao web principal do Grow Finance.

## Requisitos

- Node.js 20+ (ou 18+ com npm recente)
- npm

## Variaveis de ambiente

1. Copie o exemplo:

```bash
cp .env.example .env
```

2. Preencha o `.env` com os valores reais do Supabase:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Comandos principais

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Validacao para deploy

Comando unico para validar ambiente + lint + build:

```bash
npm run verify:deploy
```

## Deploy no GitHub Pages

Ja existe script pronto para publicar na branch `gh-pages`.

```bash
npm run deploy:pages
```

O script faz automaticamente:

- Validacao de `.env`
- Build com `base` correto para GitHub Pages
- Copia de `index.html` para `404.html` (SPA fallback)
- Publicacao forcada em `gh-pages`

### Opcoes de deploy (GitHub Pages)

- `PAGES_BASE_PATH`: sobrescreve o base path (ex: `/meu-site/` ou `/`)
- `PAGES_CNAME`: gera arquivo `CNAME` (dominio customizado)

Exemplo:

```bash
PAGES_BASE_PATH=/ PAGES_CNAME=app.seudominio.com npm run deploy:pages
```

## Deploy no Netlify

Projeto ja preparado com:

- `netlify.toml`
- `public/_redirects` para fallback de rotas SPA

Build command: `npm run build`  
Publish directory: `dist`

## Deploy no Vercel

Projeto ja preparado com:

- `vercel.json` com rewrite para `index.html` (SPA fallback)

Framework preset recomendado: `Vite`  
Build command: `npm run build`  
Output directory: `dist`

## Observacao para PowerShell no Windows

Se o PowerShell bloquear scripts (`npm.ps1`/`npx.ps1`), execute via `cmd`:

```bash
cmd /c npm run verify:deploy
cmd /c npm run deploy:pages
```
