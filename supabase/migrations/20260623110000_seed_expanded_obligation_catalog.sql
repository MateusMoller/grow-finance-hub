-- Expand governed obligation catalog with separate master obligations per routine.

INSERT INTO public.obligation_templates (
  organization_id,
  code,
  name,
  sector,
  periodicity,
  competence_reference,
  technical_due_month_reference,
  due_day,
  priority,
  expected_documents,
  is_active,
  generates_calendar,
  generates_kanban,
  requires_document,
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
  'anterior',
  'vigente',
  seed.due_day,
  'media',
  '[]'::jsonb,
  true,
  true,
  true,
  true,
  'seed',
  'approved',
  lower(regexp_replace(unaccent(seed.name), '[^a-zA-Z0-9]+', ' ', 'g'))
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('fgts', 'FGTS', 'Departamento Pessoal', 'monthly', 20),
    ('esocial', 'eSocial', 'Departamento Pessoal', 'monthly', 15),
    ('dctfweb_mit', 'DCTFWeb/MIT', 'Fiscal', 'monthly', 25),
    ('efd_reinf', 'EFD-Reinf', 'Fiscal', 'monthly', 15),
    ('payroll_closing', 'Fechamento de folha e holerites', 'Departamento Pessoal', 'monthly', 25),
    ('inss_contribution_review', 'Revisao de INSS e terceiros', 'Departamento Pessoal', 'monthly', 20),
    ('iss_municipal', 'ISS Municipal', 'Fiscal', 'monthly', 10),
    ('icms_state_routine', 'Rotina estadual ICMS', 'Fiscal', 'monthly', 20),
    ('tax_regularidade_review', 'Revisao de certidoes e regularidade fiscal', 'Fiscal', 'monthly', 25),
    ('client_document_checklist', 'Checklist de documentos do cliente', 'Contabil', 'monthly', 5),
    ('accounting_monthly_closing', 'Fechamento contabil mensal', 'Contabil', 'monthly', 20),
    ('annual_cadastral_fiscal_review', 'Revisao cadastral e fiscal anual', 'Fiscal', 'yearly', 31),
    ('pgdas_d', 'PGDAS-D', 'Fiscal', 'monthly', 20),
    ('defis', 'DEFIS', 'Fiscal', 'yearly', 31),
    ('das_complementar_review', 'Revisao de DAS complementar e ajustes', 'Fiscal', 'monthly', 20),
    ('simples_option_status_review', 'Revisao anual da opcao pelo Simples Nacional', 'Fiscal', 'yearly', 31),
    ('dasn_simei', 'DASN-SIMEI', 'Fiscal', 'yearly', 31),
    ('pgmei', 'PGMEI/DAS MEI', 'Fiscal', 'monthly', 20),
    ('mei_revenue_support', 'Controle de receita bruta MEI', 'Fiscal', 'monthly', 20),
    ('mei_status_limit_review', 'Revisao anual de limite e status MEI', 'Fiscal', 'yearly', 31),
    ('mei_migration_alert', 'Alerta de desenquadramento MEI', 'Fiscal', 'monthly', 20),
    ('irpj_csll_presumido', 'IRPJ/CSLL Lucro Presumido', 'Fiscal', 'quarterly', 31),
    ('pis_cofins_cumulativo', 'PIS/COFINS cumulativo', 'Fiscal', 'monthly', 25),
    ('dctf_mensal', 'DCTF Mensal', 'Fiscal', 'monthly', 15),
    ('efd_contribuicoes', 'EFD-Contribuicoes', 'Fiscal', 'monthly', 15),
    ('efd_icms_ipi', 'EFD ICMS/IPI', 'Fiscal', 'monthly', 20),
    ('ecd', 'ECD', 'Contabil', 'yearly', 31),
    ('ecf', 'ECF', 'Contabil', 'yearly', 31),
    ('tax_withholding_review', 'Revisao de retencoes IRRF/CSRF/INSS/ISS', 'Fiscal', 'monthly', 20),
    ('irpj_csll_lucro_real', 'IRPJ/CSLL Lucro Real', 'Fiscal', 'monthly', 31),
    ('pis_cofins_nao_cumulativo', 'PIS/COFINS nao cumulativo', 'Fiscal', 'monthly', 25),
    ('lalur_lacs_review', 'Revisao Lalur/Lacs e ajustes fiscais', 'Contabil', 'monthly', 31)
) AS seed(code, name, sector, periodicity, due_day)
ON CONFLICT (organization_id, code) DO UPDATE
SET name = EXCLUDED.name,
    sector = EXCLUDED.sector,
    periodicity = EXCLUDED.periodicity,
    competence_reference = EXCLUDED.competence_reference,
    technical_due_month_reference = EXCLUDED.technical_due_month_reference,
    due_day = EXCLUDED.due_day,
    priority = EXCLUDED.priority,
    requires_document = EXCLUDED.requires_document,
    baseline_source = 'seed',
    catalog_review_status = 'approved',
    normalized_name = EXCLUDED.normalized_name;

INSERT INTO public.obligation_regime_loads (organization_id, tax_regime_code, name, status, version, owner_sector)
SELECT org.id, seed.tax_regime_code, seed.name, 'active', 1, 'Fiscal'
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('simples_nacional', 'Simples Nacional - Carga Padrao'),
    ('lucro_presumido', 'Lucro Presumido - Carga Padrao'),
    ('lucro_real', 'Lucro Real - Carga Padrao'),
    ('mei', 'MEI - Carga Padrao')
) AS seed(tax_regime_code, name)
ON CONFLICT DO NOTHING;

WITH load_items(tax_regime_code, template_code, applicability, condition_key, sort_order) AS (
  VALUES
    ('simples_nacional', 'pgdas_d', 'required', NULL, 10),
    ('simples_nacional', 'defis', 'required', NULL, 20),
    ('simples_nacional', 'das_complementar_review', 'conditional', 'service_provider', 30),
    ('simples_nacional', 'iss_municipal', 'conditional', 'iss_applicable', 40),
    ('simples_nacional', 'icms_state_routine', 'conditional', 'icms_taxpayer', 50),
    ('simples_nacional', 'fgts', 'conditional', 'has_employees', 60),
    ('simples_nacional', 'esocial', 'conditional', 'has_employees', 70),
    ('simples_nacional', 'dctfweb_mit', 'conditional', 'has_employees', 80),
    ('simples_nacional', 'payroll_closing', 'conditional', 'has_employees', 90),
    ('simples_nacional', 'efd_reinf', 'conditional', 'service_provider', 100),
    ('simples_nacional', 'accounting_monthly_closing', 'conditional', 'accounting_contracted', 110),
    ('simples_nacional', 'tax_regularidade_review', 'required', NULL, 120),
    ('simples_nacional', 'client_document_checklist', 'required', NULL, 130),
    ('simples_nacional', 'annual_cadastral_fiscal_review', 'required', NULL, 140),
    ('simples_nacional', 'simples_option_status_review', 'required', NULL, 150),
    ('lucro_presumido', 'irpj_csll_presumido', 'required', NULL, 10),
    ('lucro_presumido', 'pis_cofins_cumulativo', 'required', NULL, 20),
    ('lucro_presumido', 'dctfweb_mit', 'required', NULL, 30),
    ('lucro_presumido', 'dctf_mensal', 'required', NULL, 40),
    ('lucro_presumido', 'efd_reinf', 'conditional', 'service_provider', 50),
    ('lucro_presumido', 'ecf', 'required', NULL, 60),
    ('lucro_presumido', 'ecd', 'conditional', 'accounting_contracted', 70),
    ('lucro_presumido', 'efd_contribuicoes', 'conditional', 'service_provider', 80),
    ('lucro_presumido', 'efd_icms_ipi', 'conditional', 'icms_taxpayer', 90),
    ('lucro_presumido', 'iss_municipal', 'conditional', 'iss_applicable', 100),
    ('lucro_presumido', 'fgts', 'conditional', 'has_employees', 110),
    ('lucro_presumido', 'esocial', 'conditional', 'has_employees', 120),
    ('lucro_presumido', 'payroll_closing', 'conditional', 'has_employees', 130),
    ('lucro_presumido', 'inss_contribution_review', 'conditional', 'has_employees', 140),
    ('lucro_presumido', 'tax_withholding_review', 'conditional', 'service_provider', 150),
    ('lucro_presumido', 'tax_regularidade_review', 'required', NULL, 160),
    ('lucro_presumido', 'client_document_checklist', 'required', NULL, 170),
    ('lucro_presumido', 'accounting_monthly_closing', 'required', NULL, 180),
    ('lucro_presumido', 'annual_cadastral_fiscal_review', 'required', NULL, 190),
    ('lucro_real', 'irpj_csll_lucro_real', 'required', NULL, 10),
    ('lucro_real', 'pis_cofins_nao_cumulativo', 'required', NULL, 20),
    ('lucro_real', 'dctfweb_mit', 'required', NULL, 30),
    ('lucro_real', 'dctf_mensal', 'required', NULL, 40),
    ('lucro_real', 'efd_contribuicoes', 'required', NULL, 50),
    ('lucro_real', 'ecd', 'required', NULL, 60),
    ('lucro_real', 'ecf', 'required', NULL, 70),
    ('lucro_real', 'efd_reinf', 'conditional', 'service_provider', 80),
    ('lucro_real', 'efd_icms_ipi', 'conditional', 'icms_taxpayer', 90),
    ('lucro_real', 'iss_municipal', 'conditional', 'iss_applicable', 100),
    ('lucro_real', 'fgts', 'conditional', 'has_employees', 110),
    ('lucro_real', 'esocial', 'conditional', 'has_employees', 120),
    ('lucro_real', 'payroll_closing', 'conditional', 'has_employees', 130),
    ('lucro_real', 'inss_contribution_review', 'conditional', 'has_employees', 140),
    ('lucro_real', 'tax_withholding_review', 'conditional', 'service_provider', 150),
    ('lucro_real', 'lalur_lacs_review', 'required', NULL, 160),
    ('lucro_real', 'tax_regularidade_review', 'required', NULL, 170),
    ('lucro_real', 'client_document_checklist', 'required', NULL, 180),
    ('lucro_real', 'accounting_monthly_closing', 'required', NULL, 190),
    ('lucro_real', 'annual_cadastral_fiscal_review', 'required', NULL, 200),
    ('mei', 'pgmei', 'required', NULL, 10),
    ('mei', 'dasn_simei', 'required', NULL, 20),
    ('mei', 'mei_revenue_support', 'required', NULL, 30),
    ('mei', 'iss_municipal', 'conditional', 'iss_applicable', 40),
    ('mei', 'mei_status_limit_review', 'required', NULL, 50),
    ('mei', 'fgts', 'conditional', 'has_employees', 60),
    ('mei', 'esocial', 'conditional', 'has_employees', 70),
    ('mei', 'payroll_closing', 'conditional', 'has_employees', 80),
    ('mei', 'mei_migration_alert', 'optional', NULL, 90),
    ('mei', 'client_document_checklist', 'required', NULL, 100),
    ('mei', 'annual_cadastral_fiscal_review', 'required', NULL, 110)
)
INSERT INTO public.obligation_regime_load_items (
  organization_id,
  load_id,
  template_id,
  applicability,
  condition_key,
  default_start_policy,
  sort_order
)
SELECT
  loads.organization_id,
  loads.id,
  templates.id,
  load_items.applicability,
  load_items.condition_key,
  'client_created_at',
  load_items.sort_order
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
    is_active = true;
