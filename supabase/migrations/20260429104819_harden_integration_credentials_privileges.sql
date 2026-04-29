-- Keep integration credentials private to backend-only flows.
REVOKE ALL PRIVILEGES ON TABLE public.integration_api_credentials FROM anon, authenticated;

-- Reinforce report view lockdown for client-side roles.
REVOKE ALL PRIVILEGES ON TABLE public.acessorias_report_overview FROM anon, authenticated;
