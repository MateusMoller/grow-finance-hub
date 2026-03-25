-- Allow any authenticated user to read clients.
-- Keep create/update/delete restrictions unchanged.
DROP POLICY IF EXISTS "Team can view clients" ON public.clients;

CREATE POLICY "Authenticated can view clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (true);
