DROP POLICY IF EXISTS "Managers can manage document model validations" ON public.document_model_validation_samples;

CREATE POLICY "Managers can insert document model validations"
  ON public.document_model_validation_samples FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role((SELECT auth.uid()),organization_id,'admin')
    OR public.has_org_role((SELECT auth.uid()),organization_id,'manager')
  );

CREATE POLICY "Managers can update document model validations"
  ON public.document_model_validation_samples FOR UPDATE TO authenticated
  USING (
    public.has_org_role((SELECT auth.uid()),organization_id,'admin')
    OR public.has_org_role((SELECT auth.uid()),organization_id,'manager')
  )
  WITH CHECK (
    public.has_org_role((SELECT auth.uid()),organization_id,'admin')
    OR public.has_org_role((SELECT auth.uid()),organization_id,'manager')
  );

CREATE POLICY "Managers can delete document model validations"
  ON public.document_model_validation_samples FOR DELETE TO authenticated
  USING (
    public.has_org_role((SELECT auth.uid()),organization_id,'admin')
    OR public.has_org_role((SELECT auth.uid()),organization_id,'manager')
  );
