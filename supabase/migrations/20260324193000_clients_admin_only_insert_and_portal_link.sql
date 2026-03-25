-- Link internal client records to portal auth users
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_portal_user_id_key
  ON public.clients (portal_user_id)
  WHERE portal_user_id IS NOT NULL;

-- Only admins can create client records
DROP POLICY IF EXISTS "Team can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;

CREATE POLICY "Admins can insert clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Restrict read access to internal roles only
DROP POLICY IF EXISTS "Authenticated can view clients" ON public.clients;
DROP POLICY IF EXISTS "Team can view clients" ON public.clients;

CREATE POLICY "Internal roles can view clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'director')
    OR has_role(auth.uid(), 'manager')
    OR has_role(auth.uid(), 'employee')
    OR has_role(auth.uid(), 'commercial')
    OR has_role(auth.uid(), 'departamento_pessoal')
    OR has_role(auth.uid(), 'fiscal')
    OR has_role(auth.uid(), 'contabil')
  );
