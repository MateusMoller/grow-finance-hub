GRANT UPDATE ON public.organization_settings TO authenticated;

DROP POLICY IF EXISTS "Managers can manage organization settings" ON public.organization_settings;
CREATE POLICY "Managers can manage organization settings"
  ON public.organization_settings
  FOR ALL
  TO authenticated
  USING (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  )
  WITH CHECK (
    public.has_org_role(auth.uid(), organization_id, 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'director')
    OR public.has_org_role(auth.uid(), organization_id, 'manager')
  );
