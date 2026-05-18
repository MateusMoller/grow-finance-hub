-- Client-scoped portal requests/documents.
-- Keeps user_id compatibility while allowing one portal user to operate more than one client safely.

ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_requests_client_id
  ON public.client_requests (client_id);

CREATE INDEX IF NOT EXISTS idx_client_requests_org_client
  ON public.client_requests (organization_id, client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_documents_client_id
  ON public.client_documents (client_id);

CREATE INDEX IF NOT EXISTS idx_client_documents_org_client
  ON public.client_documents (organization_id, client_id, created_at DESC);

WITH primary_links AS (
  SELECT DISTINCT ON (cu.user_id, cu.organization_id)
    cu.user_id,
    cu.organization_id,
    cu.client_id
  FROM public.client_users cu
  WHERE cu.status = 'active'
  ORDER BY cu.user_id, cu.organization_id, cu.created_at DESC
)
UPDATE public.client_requests cr
SET client_id = primary_links.client_id
FROM primary_links
WHERE cr.client_id IS NULL
  AND cr.user_id = primary_links.user_id
  AND cr.organization_id = primary_links.organization_id;

UPDATE public.client_requests cr
SET client_id = c.id
FROM public.clients c
WHERE cr.client_id IS NULL
  AND cr.user_id = c.portal_user_id
  AND cr.organization_id = c.organization_id;

UPDATE public.client_documents cd
SET client_id = cr.client_id
FROM public.client_requests cr
WHERE cd.client_id IS NULL
  AND cd.request_id = cr.id
  AND cd.organization_id = cr.organization_id
  AND cr.client_id IS NOT NULL;

WITH primary_links AS (
  SELECT DISTINCT ON (cu.user_id, cu.organization_id)
    cu.user_id,
    cu.organization_id,
    cu.client_id
  FROM public.client_users cu
  WHERE cu.status = 'active'
  ORDER BY cu.user_id, cu.organization_id, cu.created_at DESC
)
UPDATE public.client_documents cd
SET client_id = primary_links.client_id
FROM primary_links
WHERE cd.client_id IS NULL
  AND cd.user_id = primary_links.user_id
  AND cd.organization_id = primary_links.organization_id;

CREATE OR REPLACE FUNCTION public.set_client_document_client_id_from_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.request_id IS NOT NULL THEN
    SELECT cr.client_id
    INTO NEW.client_id
    FROM public.client_requests cr
    WHERE cr.id = NEW.request_id
      AND cr.organization_id = NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_document_client_id_from_request ON public.client_documents;
CREATE TRIGGER set_client_document_client_id_from_request
  BEFORE INSERT OR UPDATE OF request_id, organization_id ON public.client_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_document_client_id_from_request();

DROP POLICY IF EXISTS "Tenant can view client requests" ON public.client_requests;
CREATE POLICY "Tenant can view client requests"
  ON public.client_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (client_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant clients and internal can insert client requests" ON public.client_requests;
CREATE POLICY "Tenant clients and internal can insert client requests"
  ON public.client_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_internal_user(auth.uid(), organization_id)
    OR (
      user_id = auth.uid()
      AND client_id IS NOT NULL
      AND public.can_access_client(auth.uid(), client_id)
    )
    OR (
      user_id = auth.uid()
      AND client_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Tenant internal can update client requests" ON public.client_requests;
CREATE POLICY "Tenant internal can update client requests"
  ON public.client_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
  )
  WITH CHECK (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
  );

DROP POLICY IF EXISTS "Tenant can view client documents" ON public.client_documents;
CREATE POLICY "Tenant can view client documents"
  ON public.client_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (client_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant clients can insert own documents" ON public.client_documents;
CREATE POLICY "Tenant clients can insert own documents"
  ON public.client_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
      OR client_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Tenant can delete client documents" ON public.client_documents;
CREATE POLICY "Tenant can delete client documents"
  ON public.client_documents
  FOR DELETE
  TO authenticated
  USING (
    public.is_internal_user(auth.uid(), organization_id)
    OR (client_id IS NOT NULL AND public.can_access_client(auth.uid(), client_id))
    OR (client_id IS NULL AND user_id = auth.uid())
  );

GRANT EXECUTE ON FUNCTION public.set_client_document_client_id_from_request() TO authenticated;
