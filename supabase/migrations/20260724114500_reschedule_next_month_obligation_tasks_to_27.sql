DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'grow-generate-next-month-obligation-tasks'
  ) THEN
    PERFORM cron.unschedule('grow-generate-next-month-obligation-tasks');
  END IF;
END $$;

SELECT cron.schedule(
  'grow-generate-next-month-obligation-tasks',
  '0 6 27 * *',
  $$SELECT public.generate_next_month_obligation_tasks(CURRENT_DATE);$$
);
