-- Allow internal team members to create client requests on behalf of linked portal users.
-- Keeps the existing client self-insert policy untouched.

DROP POLICY IF EXISTS "Internal can insert requests for linked portal clients" ON public.client_requests;

CREATE POLICY "Internal can insert requests for linked portal clients"
  ON public.client_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'director')
      OR has_role(auth.uid(), 'manager')
      OR has_role(auth.uid(), 'employee')
      OR has_role(auth.uid(), 'commercial')
      OR has_role(auth.uid(), 'partner')
      OR has_role(auth.uid(), 'departamento_pessoal')
      OR has_role(auth.uid(), 'fiscal')
      OR has_role(auth.uid(), 'contabil')
    )
    AND EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.portal_user_id = client_requests.user_id
    )
  );
