# Security Baseline Sources

The baseline uses these primary references:

- Supabase Data API security: https://supabase.com/docs/guides/api/securing-your-api
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Auth sessions: https://supabase.com/docs/guides/auth/sessions
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase Auth redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- OWASP API Security Top 10: https://owasp.org/API-Security/
- OWASP Content Security Policy guidance: https://owasp.org/www-community/controls/Content_Security_Policy
- OWASP CSRF prevention guidance: https://owasp.org/www-community/attacks/csrf

Local project evidence:

- `src/App.tsx`
- `src/components/app/ProtectedRoute.tsx`
- `src/hooks/useAuth.tsx`
- `src/lib/accessControl.ts`
- `src/lib/fileUploadSecurity.ts`
- `supabase/config.toml`
- `supabase/functions/`
- `supabase/migrations/`
