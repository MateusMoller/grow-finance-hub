# Grow Finance Hub (Web)

Aplicacao web principal do Grow Finance.

## Integracao com app mobile

- Deep link configuravel por `VITE_MOBILE_APP_DEEP_LINK` (padrao `growfinance://app`).
- Fallback configuravel por `VITE_MOBILE_APP_FALLBACK_URL`.
- O app mobile usa o mesmo backend Supabase para manter autenticacao e dados sincronizados.

## Variaveis de ambiente

Use `.env.example` como referencia para criar seu `.env`.
