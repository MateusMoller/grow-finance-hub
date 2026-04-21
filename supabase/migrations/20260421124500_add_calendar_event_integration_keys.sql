-- Integration keys for calendar entries created automatically from external modules
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS integration_source text,
  ADD COLUMN IF NOT EXISTS integration_key text;

CREATE INDEX IF NOT EXISTS idx_calendar_events_integration_source
  ON public.calendar_events (integration_source);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_integration_unique
  ON public.calendar_events (integration_source, integration_key);