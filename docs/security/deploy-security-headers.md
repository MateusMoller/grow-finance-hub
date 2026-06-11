# Deploy Security Headers

## Target Headers

| Header | Target value |
| --- | --- |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | Restrict defaults to self, Supabase connect endpoints and explicitly required assets. |

## Target CSP

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' https://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

## Current Deploy Header Gaps

- `vercel.json` configures CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS for all paths.
- `netlify.toml` configures the same baseline headers for all paths.
- `public/_redirects` only configures SPA fallback and does not enforce headers by itself.
- GitHub Pages cannot enforce all dynamic headers directly; use static hosting config or proxy/CDN controls where required if GitHub Pages is the active host.
- CORS for backend routes must allow only known app origins.
