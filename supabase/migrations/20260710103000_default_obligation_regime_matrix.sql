-- Define the generic default obligation matrix by tax regime.
-- Rollback: inactivate records where baseline_source = 'default_regime_matrix_20260710'
-- and remove/inactivate the matching obligation_regime_load_items memberships.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

ALTER TABLE public.client_obligation_profiles
  ADD COLUMN IF NOT EXISTS conditional_skip_reason text;

ALTER TABLE public.obligation_load_application_reviews
  ADD COLUMN IF NOT EXISTS auto_applied boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obligation_regime_load_items_condition_check'
      AND conrelid = 'public.obligation_regime_load_items'::regclass
  ) THEN
    ALTER TABLE public.obligation_regime_load_items
      DROP CONSTRAINT obligation_regime_load_items_condition_check;
  END IF;

  ALTER TABLE public.obligation_regime_load_items
    ADD CONSTRAINT obligation_regime_load_items_condition_check
    CHECK (
      (applicability <> 'conditional' AND condition_key IS NULL)
      OR (applicability = 'conditional' AND condition_key IN (
        'has_employees',
        'iss_applicable',
        'icms_taxpayer',
        'service_provider',
        'accounting_contracted',
        'municipal_service_declaration_required',
        'state_registration',
        'state_registration_or_required',
        'icms_ipi_taxpayer',
        'icms_st_difal_anticipation',
        'retentions_or_services',
        'has_employees_or_retentions',
        'ecd_applicable',
        'efd_contribuicoes_applicable',
        'tax_benefit_or_incentive_usage'
      ))
    );
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obligation_load_application_reviews_decision_check'
      AND conrelid = 'public.obligation_load_application_reviews'::regclass
  ) THEN
    ALTER TABLE public.obligation_load_application_reviews
      DROP CONSTRAINT obligation_load_application_reviews_decision_check;
  END IF;

  ALTER TABLE public.obligation_load_application_reviews
    ADD CONSTRAINT obligation_load_application_reviews_decision_check
    CHECK (decision_type IN (
      'add',
      'keep',
      'reactivate',
      'suggest_inactivate',
      'auto_inactivate_prior_regime',
      'inactivate_prior_regime',
      'skip',
      'duplicate_risk',
      'blocked'
    ));
END $$;

CREATE INDEX IF NOT EXISTS idx_client_obligation_profiles_org_regime_source
  ON public.client_obligation_profiles (organization_id, client_id, applied_regime, source_kind, is_active);

CREATE INDEX IF NOT EXISTS idx_obligation_load_application_reviews_org_client_created
  ON public.obligation_load_application_reviews (organization_id, client_id, created_at DESC);

WITH template_seed(code, name, sector, periodicity, due_day, yearly_due_month, priority, notes) AS (
  VALUES
    ('pgmei', 'PGMEI/DAS MEI', 'Fiscal', 'monthly', 20, NULL::integer, 'media', 'Controle mensal de apuracao/emissao do DAS MEI.'),
    ('dasn_simei', 'DASN-SIMEI', 'Fiscal', 'yearly', 31, 5, 'alta', 'Declaracao anual do MEI.'),
    ('pgdas_d', 'PGDAS-D', 'Fiscal', 'monthly', 20, NULL::integer, 'alta', 'Apuracao mensal do Simples Nacional.'),
    ('defis', 'DEFIS', 'Fiscal', 'yearly', 31, 3, 'alta', 'Declaracao anual do Simples Nacional.'),
    ('dctfweb_mit', 'DCTFWeb/MIT', 'Fiscal', 'monthly', 31, NULL::integer, 'alta', 'Declaracao/confissao federal mensal quando aplicavel.'),
    ('esocial', 'eSocial', 'Departamento Pessoal', 'monthly', 15, NULL::integer, 'media', 'Eventos trabalhistas/previdenciarios quando houver empregados.'),
    ('fgts', 'FGTS', 'Departamento Pessoal', 'monthly', 20, NULL::integer, 'media', 'Recolhimento/controle de FGTS quando houver empregados.'),
    ('efd_reinf', 'EFD-Reinf', 'Fiscal', 'monthly', 15, NULL::integer, 'media', 'Escrituracao de retencoes e eventos fiscais relacionados.'),
    ('iss_municipal', 'ISS Municipal', 'Fiscal', 'monthly', 10, NULL::integer, 'media', 'Obrigacao principal municipal para prestadores de servico.'),
    ('municipal_service_tax_return', 'Declaracao municipal de servicos', 'Fiscal', 'monthly', 10, NULL::integer, 'media', 'Obrigacao acessoria municipal quando exigida pelo municipio.'),
    ('nfse_municipal', 'NFS-e / emissao fiscal municipal', 'Fiscal', 'monthly', 10, NULL::integer, 'media', 'Emissao ou controle fiscal municipal para prestacao de servicos.'),
    ('generic_state_obligations', 'Obrigacoes estaduais genericas por UF', 'Fiscal', 'monthly', 20, NULL::integer, 'media', 'Controle generico de obrigacoes estaduais conforme UF.'),
    ('generic_municipal_obligations', 'Obrigacoes municipais genericas por municipio', 'Fiscal', 'monthly', 10, NULL::integer, 'media', 'Controle generico de obrigacoes municipais conforme municipio.'),
    ('efd_icms_ipi', 'EFD ICMS/IPI', 'Fiscal', 'monthly', 20, NULL::integer, 'alta', 'Escrituracao estadual/federal para contribuintes ICMS/IPI.'),
    ('destda', 'DeSTDA', 'Fiscal', 'monthly', 28, NULL::integer, 'media', 'Declaracao estadual quando houver ST/DIFAL/antecipacao ou exigencia estadual.'),
    ('das_complementar_review', 'Revisao de DAS complementar e ajustes', 'Fiscal', 'monthly', 20, NULL::integer, 'media', 'Controle de ajustes do Simples Nacional quando aplicavel.'),
    ('simples_option_status_review', 'Revisao anual da opcao pelo Simples Nacional', 'Fiscal', 'yearly', 31, 1, 'media', 'Revisao anual de permanencia/opcao no Simples Nacional.'),
    ('mei_revenue_support', 'Controle de receita bruta MEI', 'Fiscal', 'monthly', 20, NULL::integer, 'media', 'Controle generico de receita bruta do MEI.'),
    ('mei_status_limit_review', 'Revisao anual de limite e status MEI', 'Fiscal', 'yearly', 31, 1, 'media', 'Revisao de limite e permanencia no SIMEI.'),
    ('irpj_csll_presumido', 'IRPJ/CSLL Lucro Presumido', 'Fiscal', 'quarterly', 31, NULL::integer, 'alta', 'Apuracao trimestral de IRPJ/CSLL no Lucro Presumido.'),
    ('pis_cofins_cumulativo', 'PIS/COFINS cumulativo', 'Fiscal', 'monthly', 25, NULL::integer, 'alta', 'Apuracao mensal cumulativa.'),
    ('efd_contribuicoes', 'EFD-Contribuicoes', 'Fiscal', 'monthly', 15, NULL::integer, 'alta', 'Escrituracao das contribuicoes quando aplicavel ou obrigatoria.'),
    ('ecd', 'ECD', 'Contabil', 'yearly', 30, 6, 'alta', 'Escrituracao contabil digital.'),
    ('ecf', 'ECF', 'Contabil', 'yearly', 31, 7, 'alta', 'Escrituracao contabil fiscal.'),
    ('dirbi', 'DIRBI', 'Fiscal', 'monthly', 20, NULL::integer, 'media', 'Declaracao de beneficios fiscais quando houver incentivo/beneficio.'),
    ('irpj_csll_lucro_real', 'IRPJ/CSLL Lucro Real', 'Fiscal', 'monthly', 31, NULL::integer, 'alta', 'Apuracao de IRPJ/CSLL no Lucro Real.'),
    ('pis_cofins_nao_cumulativo', 'PIS/COFINS nao cumulativo', 'Fiscal', 'monthly', 25, NULL::integer, 'alta', 'Apuracao mensal nao cumulativa.')
)
INSERT INTO public.obligation_templates (
  organization_id,
  code,
  name,
  sector,
  periodicity,
  competence_reference,
  technical_due_month_reference,
  due_day,
  yearly_due_month,
  priority,
  expected_documents,
  is_active,
  generates_calendar,
  generates_kanban,
  requires_document,
  operational_notes,
  baseline_source,
  catalog_review_status,
  normalized_name
)
SELECT
  org.id,
  seed.code,
  seed.name,
  seed.sector,
  seed.periodicity,
  CASE WHEN seed.periodicity = 'yearly' THEN 'vigente' ELSE 'anterior' END,
  'vigente',
  seed.due_day,
  seed.yearly_due_month,
  seed.priority,
  '[]'::jsonb,
  true,
  true,
  true,
  true,
  seed.notes,
  'default_regime_matrix_20260710',
  'approved',
  lower(trim(regexp_replace(public.unaccent(seed.name), '[^a-zA-Z0-9]+', ' ', 'g')))
FROM public.organizations org
CROSS JOIN template_seed seed
ON CONFLICT (organization_id, code) DO UPDATE
SET name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    periodicity = EXCLUDED.periodicity,
    competence_reference = EXCLUDED.competence_reference,
    technical_due_month_reference = EXCLUDED.technical_due_month_reference,
    due_day = EXCLUDED.due_day,
    yearly_due_month = EXCLUDED.yearly_due_month,
    priority = EXCLUDED.priority,
    operational_notes = EXCLUDED.operational_notes,
    is_active = true,
    baseline_source = EXCLUDED.baseline_source,
    catalog_review_status = 'approved',
    normalized_name = EXCLUDED.normalized_name,
    updated_at = now();

INSERT INTO public.obligation_regime_loads (organization_id, tax_regime_code, name, status, version, description, owner_sector, review_notes)
SELECT org.id, seed.tax_regime_code, seed.name, 'active', 3, 'Carga padrao generica por regime tributario.', 'Fiscal', 'Atualizada em 2026-07-10 para obrigações genericas e condicionais por evidencia positiva.'
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('mei', 'MEI - Carga Padrao'),
    ('simples_nacional', 'Simples Nacional - Carga Padrao'),
    ('lucro_presumido', 'Lucro Presumido - Carga Padrao'),
    ('lucro_real', 'Lucro Real - Carga Padrao')
) AS seed(tax_regime_code, name)
ON CONFLICT DO NOTHING;

UPDATE public.obligation_regime_loads
SET version = GREATEST(version, 3),
    description = 'Carga padrao generica por regime tributario.',
    review_notes = 'Atualizada em 2026-07-10 para obrigacoes genericas e condicionais por evidencia positiva.',
    updated_at = now()
WHERE status = 'active'
  AND tax_regime_code IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real');

UPDATE public.obligation_regime_load_items
SET is_active = false,
    notes = concat_ws(E'\n\n', notes, 'Inativado pela matriz generica 2026-07-10.'),
    updated_at = now()
WHERE is_active = true
  AND organization_id IN (SELECT id FROM public.organizations);

WITH load_items(tax_regime_code, template_code, applicability, condition_key, sort_order) AS (
  VALUES
    ('mei', 'pgmei', 'required', NULL, 10),
    ('mei', 'dasn_simei', 'required', NULL, 20),
    ('mei', 'esocial', 'conditional', 'has_employees', 30),
    ('mei', 'fgts', 'conditional', 'has_employees', 40),
    ('mei', 'dctfweb_mit', 'conditional', 'has_employees_or_retentions', 50),
    ('mei', 'iss_municipal', 'conditional', 'service_provider', 60),
    ('mei', 'municipal_service_tax_return', 'conditional', 'municipal_service_declaration_required', 70),
    ('mei', 'nfse_municipal', 'conditional', 'service_provider', 80),
    ('mei', 'mei_revenue_support', 'required', NULL, 90),
    ('mei', 'mei_status_limit_review', 'required', NULL, 100),
    ('mei', 'destda', 'conditional', 'state_registration_or_required', 110),
    ('simples_nacional', 'pgdas_d', 'required', NULL, 10),
    ('simples_nacional', 'defis', 'required', NULL, 20),
    ('simples_nacional', 'dctfweb_mit', 'conditional', 'has_employees_or_retentions', 30),
    ('simples_nacional', 'esocial', 'conditional', 'has_employees', 40),
    ('simples_nacional', 'fgts', 'conditional', 'has_employees', 50),
    ('simples_nacional', 'efd_reinf', 'conditional', 'retentions_or_services', 60),
    ('simples_nacional', 'iss_municipal', 'conditional', 'service_provider', 70),
    ('simples_nacional', 'municipal_service_tax_return', 'conditional', 'municipal_service_declaration_required', 80),
    ('simples_nacional', 'nfse_municipal', 'conditional', 'service_provider', 90),
    ('simples_nacional', 'efd_icms_ipi', 'conditional', 'icms_ipi_taxpayer', 100),
    ('simples_nacional', 'destda', 'conditional', 'icms_st_difal_anticipation', 110),
    ('simples_nacional', 'das_complementar_review', 'conditional', 'tax_benefit_or_incentive_usage', 120),
    ('simples_nacional', 'simples_option_status_review', 'required', NULL, 130),
    ('simples_nacional', 'generic_state_obligations', 'conditional', 'state_registration', 140),
    ('simples_nacional', 'generic_municipal_obligations', 'conditional', 'municipal_service_declaration_required', 150),
    ('lucro_presumido', 'dctfweb_mit', 'required', NULL, 10),
    ('lucro_presumido', 'efd_reinf', 'required', NULL, 20),
    ('lucro_presumido', 'esocial', 'conditional', 'has_employees', 30),
    ('lucro_presumido', 'fgts', 'conditional', 'has_employees', 40),
    ('lucro_presumido', 'efd_contribuicoes', 'conditional', 'efd_contribuicoes_applicable', 50),
    ('lucro_presumido', 'efd_icms_ipi', 'conditional', 'icms_ipi_taxpayer', 60),
    ('lucro_presumido', 'iss_municipal', 'conditional', 'service_provider', 70),
    ('lucro_presumido', 'municipal_service_tax_return', 'conditional', 'municipal_service_declaration_required', 80),
    ('lucro_presumido', 'ecd', 'conditional', 'ecd_applicable', 90),
    ('lucro_presumido', 'ecf', 'required', NULL, 100),
    ('lucro_presumido', 'irpj_csll_presumido', 'required', NULL, 110),
    ('lucro_presumido', 'pis_cofins_cumulativo', 'required', NULL, 120),
    ('lucro_presumido', 'dirbi', 'conditional', 'tax_benefit_or_incentive_usage', 130),
    ('lucro_presumido', 'generic_state_obligations', 'conditional', 'state_registration', 140),
    ('lucro_presumido', 'generic_municipal_obligations', 'conditional', 'municipal_service_declaration_required', 150),
    ('lucro_real', 'dctfweb_mit', 'required', NULL, 10),
    ('lucro_real', 'efd_reinf', 'required', NULL, 20),
    ('lucro_real', 'esocial', 'conditional', 'has_employees', 30),
    ('lucro_real', 'fgts', 'conditional', 'has_employees', 40),
    ('lucro_real', 'efd_contribuicoes', 'required', NULL, 50),
    ('lucro_real', 'efd_icms_ipi', 'conditional', 'icms_ipi_taxpayer', 60),
    ('lucro_real', 'iss_municipal', 'conditional', 'service_provider', 70),
    ('lucro_real', 'municipal_service_tax_return', 'conditional', 'municipal_service_declaration_required', 80),
    ('lucro_real', 'ecd', 'required', NULL, 90),
    ('lucro_real', 'ecf', 'required', NULL, 100),
    ('lucro_real', 'irpj_csll_lucro_real', 'required', NULL, 110),
    ('lucro_real', 'pis_cofins_nao_cumulativo', 'required', NULL, 120),
    ('lucro_real', 'dirbi', 'conditional', 'tax_benefit_or_incentive_usage', 130),
    ('lucro_real', 'generic_state_obligations', 'conditional', 'state_registration', 140),
    ('lucro_real', 'generic_municipal_obligations', 'conditional', 'municipal_service_declaration_required', 150)
)
INSERT INTO public.obligation_regime_load_items (
  organization_id,
  load_id,
  template_id,
  applicability,
  condition_key,
  default_start_policy,
  sort_order,
  notes,
  is_active
)
SELECT
  loads.organization_id,
  loads.id,
  templates.id,
  load_items.applicability,
  load_items.condition_key,
  'client_created_at',
  load_items.sort_order,
  templates.operational_notes,
  true
FROM load_items
JOIN public.obligation_regime_loads loads
  ON loads.tax_regime_code = load_items.tax_regime_code
 AND loads.status = 'active'
JOIN public.obligation_templates templates
  ON templates.organization_id = loads.organization_id
 AND templates.code = load_items.template_code
ON CONFLICT (organization_id, load_id, template_id) WHERE is_active = true DO UPDATE
SET applicability = EXCLUDED.applicability,
    condition_key = EXCLUDED.condition_key,
    default_start_policy = EXCLUDED.default_start_policy,
    sort_order = EXCLUDED.sort_order,
    notes = EXCLUDED.notes,
    is_active = true,
    updated_at = now();
