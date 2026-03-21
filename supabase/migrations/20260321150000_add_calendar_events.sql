-- Internal calendar for events and obligations
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  entry_type text NOT NULL DEFAULT 'evento',
  priority text NOT NULL DEFAULT 'media',
  sector text NOT NULL DEFAULT 'Geral',
  due_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS entry_type text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS all_day boolean,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.calendar_events
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN entry_type SET DEFAULT 'evento',
  ALTER COLUMN entry_type SET NOT NULL,
  ALTER COLUMN priority SET DEFAULT 'media',
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN sector SET DEFAULT 'Geral',
  ALTER COLUMN sector SET NOT NULL,
  ALTER COLUMN due_at SET NOT NULL,
  ALTER COLUMN all_day SET DEFAULT false,
  ALTER COLUMN all_day SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_entry_type_check'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_entry_type_check
      CHECK (entry_type IN ('evento', 'obrigacao'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_priority_check'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_priority_check
      CHECK (priority IN ('baixa', 'media', 'alta', 'urgente'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_status_check'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_status_check
      CHECK (status IN ('pending', 'completed', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_events_created_by_fkey'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS calendar_events_due_at_idx ON public.calendar_events(due_at);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view calendar events" ON public.calendar_events;
CREATE POLICY "Authenticated can view calendar events"
ON public.calendar_events
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Team can insert calendar events" ON public.calendar_events;
CREATE POLICY "Team can insert calendar events"
ON public.calendar_events
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
);

DROP POLICY IF EXISTS "Team can update calendar events" ON public.calendar_events;
CREATE POLICY "Team can update calendar events"
ON public.calendar_events
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
)
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
);

DROP POLICY IF EXISTS "Managers can delete calendar events" ON public.calendar_events;
CREATE POLICY "Managers can delete calendar events"
ON public.calendar_events
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
);

DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
