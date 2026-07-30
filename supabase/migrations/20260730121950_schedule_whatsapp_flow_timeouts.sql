CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE OR REPLACE FUNCTION public.invoke_whatsapp_flow_timeout_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  request_url text := 'https://vgkmcerjlwnzbiukinhd.supabase.co/functions/v1/whatsapp-webhook';
  timeout_secret text;
BEGIN
  SELECT decrypted_secret
  INTO timeout_secret
  FROM vault.decrypted_secrets
  WHERE name = 'whatsapp_flow_timeout_secret'
  LIMIT 1;

  IF timeout_secret IS NULL OR btrim(timeout_secret) = '' THEN
    RAISE NOTICE 'whatsapp_flow_timeout_secret not configured in Supabase Vault.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := request_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-grow-internal-secret', timeout_secret
    ),
    body := jsonb_build_object('action', 'process_flow_timeouts')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_whatsapp_flow_timeout_processor() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'grow-whatsapp-flow-timeouts'
  ) THEN
    PERFORM cron.unschedule('grow-whatsapp-flow-timeouts');
  END IF;
END $$;

SELECT cron.schedule(
  'grow-whatsapp-flow-timeouts',
  '* * * * *',
  $$SELECT public.invoke_whatsapp_flow_timeout_processor();$$
);
