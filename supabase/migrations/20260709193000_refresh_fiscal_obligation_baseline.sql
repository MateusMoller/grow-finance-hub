-- Refresh fiscal obligation baseline with 2026 statutory due-date assumptions.
-- Federal source checks were performed against Receita/Gov.br pages on 2026-07-09.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

ALTER TABLE public.obligation_templates
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  ADD COLUMN IF NOT EXISTS competence_reference text NOT NULL DEFAULT 'vigente',
  ADD COLUMN IF NOT EXISTS technical_due_month_reference text NOT NULL DEFAULT 'vigente',
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS duplicate_group_key text,
  ADD COLUMN IF NOT EXISTS baseline_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS catalog_review_status text NOT NULL DEFAULT 'approved';

UPDATE public.obligation_templates
SET organization_id = public.default_organization_id()
WHERE organization_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_templates_code_key'
      AND conrelid = 'public.obligation_templates'::regclass
  ) THEN
    ALTER TABLE public.obligation_templates
      DROP CONSTRAINT obligation_templates_code_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'obligation_templates_organization_code_key'
      AND conrelid = 'public.obligation_templates'::regclass
  ) THEN
    ALTER TABLE public.obligation_templates
      ADD CONSTRAINT obligation_templates_organization_code_key UNIQUE (organization_id, code);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.obligation_regime_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  tax_regime_code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_review',
  version integer NOT NULL DEFAULT 1,
  description text,
  owner_sector text,
  review_notes text,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS obligation_regime_loads_one_active_per_regime
  ON public.obligation_regime_loads (organization_id, tax_regime_code)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.obligation_regime_load_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT public.default_organization_id(),
  load_id uuid NOT NULL REFERENCES public.obligation_regime_loads(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.obligation_templates(id) ON DELETE RESTRICT,
  applicability text NOT NULL DEFAULT 'required',
  condition_key text,
  default_start_policy text NOT NULL DEFAULT 'client_created_at',
  default_due_day_override integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS obligation_regime_load_items_unique_active_template
  ON public.obligation_regime_load_items (organization_id, load_id, template_id)
  WHERE is_active = true;

WITH template_seed(
  code,
  name,
  sector,
  periodicity,
  competence_reference,
  technical_due_month_reference,
  due_day,
  yearly_due_month,
  priority,
  requires_document,
  operational_notes
) AS (
  VALUES
    ('fgts', 'FGTS', 'Departamento Pessoal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle operacional mensal de guia/trabalhista; prazo sujeito a regra bancária e calendário do FGTS Digital.'),
    ('esocial', 'eSocial', 'Departamento Pessoal', 'monthly', 'anterior', 'vigente', 15, NULL::integer, 'media', true, 'Eventos periódicos mensais; regra operacional padrão até dia 15 do mês seguinte.'),
    ('dctfweb_mit', 'DCTFWeb/MIT', 'Fiscal', 'monthly', 'anterior', 'vigente', 31, NULL::integer, 'alta', true, 'Prazo legal: último dia útil do mês seguinte ao fato gerador. O sistema usa dia 31 e limita ao fim do mês.'),
    ('efd_reinf', 'EFD-Reinf', 'Fiscal', 'monthly', 'anterior', 'vigente', 15, NULL::integer, 'media', true, 'Prazo mensal: dia 15 do mês seguinte, conforme agenda tributária da Receita.'),
    ('payroll_closing', 'Fechamento de folha e holerites', 'Departamento Pessoal', 'monthly', 'anterior', 'vigente', 25, NULL::integer, 'media', true, 'Controle interno vinculado a empregados e fechamento mensal de folha.'),
    ('inss_contribution_review', 'Revisao de INSS e terceiros', 'Departamento Pessoal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle interno de revisão previdenciária antes de vencimentos e confissões.'),
    ('iss_municipal', 'ISS Municipal', 'Fiscal', 'monthly', 'anterior', 'vigente', 10, NULL::integer, 'media', true, 'Prazo municipal varia por prefeitura; dia 10 é prazo operacional padrão e deve ser revisado por município.'),
    ('municipal_service_tax_return', 'Declaracao municipal de servicos', 'Fiscal', 'monthly', 'anterior', 'vigente', 10, NULL::integer, 'media', true, 'Obrigação acessória municipal de serviços/NFS-e; prazo varia por prefeitura e deve ser parametrizado por cliente.'),
    ('icms_state_routine', 'Rotina estadual ICMS', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle estadual de ICMS; prazo varia por UF, inscrição estadual e enquadramento.'),
    ('destda', 'DeSTDA', 'Fiscal', 'monthly', 'anterior', 'vigente', 28, NULL::integer, 'media', true, 'Obrigação estadual para contribuintes do Simples com substituição tributária/diferencial/antecipação, conforme UF.'),
    ('tax_regularidade_review', 'Revisao de certidoes e regularidade fiscal', 'Fiscal', 'monthly', 'anterior', 'vigente', 25, NULL::integer, 'baixa', true, 'Controle interno de regularidade.'),
    ('client_document_checklist', 'Checklist de documentos do cliente', 'Contabil', 'monthly', 'anterior', 'vigente', 5, NULL::integer, 'media', true, 'Controle interno de entrada de documentos mensais.'),
    ('accounting_monthly_closing', 'Fechamento contabil mensal', 'Contabil', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle interno de fechamento contábil mensal.'),
    ('annual_cadastral_fiscal_review', 'Revisao cadastral e fiscal anual', 'Fiscal', 'yearly', 'vigente', 'vigente', 31, 1, 'baixa', true, 'Controle interno anual de dados cadastrais, CNAE, enquadramento e obrigações aplicáveis.'),
    ('pgdas_d', 'PGDAS-D', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'alta', true, 'Prazo mensal: dia 20 do mês seguinte ao período de apuração.'),
    ('defis', 'DEFIS', 'Fiscal', 'yearly', 'vigente', 'vigente', 31, 3, 'alta', true, 'Prazo anual: 31 de março do ano-calendário subsequente.'),
    ('das_complementar_review', 'Revisao de DAS complementar e ajustes', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle operacional de ajustes do Simples Nacional quando aplicável.'),
    ('simples_option_status_review', 'Revisao anual da opcao pelo Simples Nacional', 'Fiscal', 'yearly', 'vigente', 'vigente', 31, 1, 'media', true, 'Controle interno da opção/enquadramento no Simples Nacional em janeiro.'),
    ('dasn_simei', 'DASN-SIMEI', 'Fiscal', 'yearly', 'vigente', 'vigente', 31, 5, 'alta', true, 'Prazo anual: 31 de maio de cada ano, relativa ao ano anterior.'),
    ('pgmei', 'PGMEI/DAS MEI', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle mensal de apuração/emissão do DAS MEI.'),
    ('mei_revenue_support', 'Controle de receita bruta MEI', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle interno de receita bruta e limite do MEI.'),
    ('mei_status_limit_review', 'Revisao anual de limite e status MEI', 'Fiscal', 'yearly', 'vigente', 'vigente', 31, 1, 'media', true, 'Controle interno anual de limite, atividade e permanência no SIMEI.'),
    ('mei_migration_alert', 'Alerta de desenquadramento MEI', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle opcional de risco de desenquadramento do MEI.'),
    ('irpj_csll_presumido', 'IRPJ/CSLL Lucro Presumido', 'Fiscal', 'quarterly', 'anterior', 'vigente', 31, NULL::integer, 'alta', true, 'Controle fiscal trimestral de apuração e documentação de IRPJ/CSLL.'),
    ('pis_cofins_cumulativo', 'PIS/COFINS cumulativo', 'Fiscal', 'monthly', 'anterior', 'vigente', 25, NULL::integer, 'alta', true, 'Controle mensal de apuração cumulativa e conferência antes da DCTFWeb/MIT.'),
    ('efd_contribuicoes', 'EFD-Contribuicoes', 'Fiscal', 'monthly', 'anterior', 'vigente', 15, NULL::integer, 'alta', true, 'Prazo na agenda da Receita: dia 15; referência pode ser o segundo mês subsequente, revisar calendário da competência.'),
    ('efd_icms_ipi', 'EFD ICMS/IPI', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'alta', true, 'Prazo definido pela legislação de cada UF; dia 20 é padrão operacional revisável por UF.'),
    ('ecd', 'ECD', 'Contabil', 'yearly', 'vigente', 'vigente', 30, 6, 'alta', true, 'Prazo anual: último dia útil de junho do ano subsequente. O sistema usa dia 30.'),
    ('ecf', 'ECF', 'Contabil', 'yearly', 'vigente', 'vigente', 31, 7, 'alta', true, 'Prazo anual: último dia útil de julho do ano subsequente. O sistema usa dia 31.'),
    ('tax_withholding_review', 'Revisao de retencoes IRRF/CSRF/INSS/ISS', 'Fiscal', 'monthly', 'anterior', 'vigente', 20, NULL::integer, 'media', true, 'Controle interno de retenções em serviços tomados/prestados.'),
    ('irpj_csll_lucro_real', 'IRPJ/CSLL Lucro Real', 'Fiscal', 'monthly', 'anterior', 'vigente', 31, NULL::integer, 'alta', true, 'Controle mensal por estimativa/suspensão/redução ou apuração aplicável.'),
    ('pis_cofins_nao_cumulativo', 'PIS/COFINS nao cumulativo', 'Fiscal', 'monthly', 'anterior', 'vigente', 25, NULL::integer, 'alta', true, 'Controle mensal de apuração não cumulativa e conferência antes da DCTFWeb/MIT.'),
    ('lalur_lacs_review', 'Revisao Lalur/Lacs e ajustes fiscais', 'Contabil', 'monthly', 'anterior', 'vigente', 31, NULL::integer, 'media', true, 'Controle interno de ajustes fiscais do Lucro Real.')
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
  seed.competence_reference,
  seed.technical_due_month_reference,
  seed.due_day,
  seed.yearly_due_month,
  seed.priority,
  '[]'::jsonb,
  true,
  true,
  true,
  seed.requires_document,
  seed.operational_notes,
  'seed',
  CASE
    WHEN seed.code IN ('iss_municipal', 'municipal_service_tax_return', 'icms_state_routine', 'destda', 'efd_icms_ipi', 'efd_contribuicoes')
      THEN 'approved'
    ELSE 'approved'
  END,
  lower(regexp_replace(public.unaccent(seed.name), '[^a-zA-Z0-9]+', ' ', 'g'))
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
    requires_document = EXCLUDED.requires_document,
    operational_notes = EXCLUDED.operational_notes,
    is_active = true,
    baseline_source = 'seed',
    catalog_review_status = EXCLUDED.catalog_review_status,
    normalized_name = EXCLUDED.normalized_name;

UPDATE public.obligation_templates
SET name = 'DCTF Mensal (PGD) - Legado ate 12/2024',
    is_active = false,
    operational_notes = 'Obrigação legada: a partir de 01/01/2025, a Receita passou os débitos da DCTF PGD para DCTFWeb/MIT.',
    catalog_review_status = 'approved',
    updated_at = now()
WHERE code = 'dctf_mensal';

INSERT INTO public.obligation_regime_loads (organization_id, tax_regime_code, name, status, version, owner_sector, review_notes)
SELECT org.id, seed.tax_regime_code, seed.name, 'active', 2, 'Fiscal', 'Carga padrao fiscal revisada em 2026-07-09; prazos estaduais/municipais permanecem condicionais por UF/municipio.'
FROM public.organizations org
CROSS JOIN (
  VALUES
    ('simples_nacional', 'Simples Nacional - Carga Padrao'),
    ('lucro_presumido', 'Lucro Presumido - Carga Padrao'),
    ('lucro_real', 'Lucro Real - Carga Padrao'),
    ('mei', 'MEI - Carga Padrao')
) AS seed(tax_regime_code, name)
ON CONFLICT DO NOTHING;

UPDATE public.obligation_regime_loads
SET version = GREATEST(version, 2),
    review_notes = 'Carga padrao fiscal revisada em 2026-07-09; prazos estaduais/municipais permanecem condicionais por UF/municipio.',
    updated_at = now()
WHERE status = 'active'
  AND tax_regime_code IN ('simples_nacional', 'lucro_presumido', 'lucro_real', 'mei');

WITH load_items(tax_regime_code, template_code, applicability, condition_key, sort_order) AS (
  VALUES
    ('simples_nacional', 'pgdas_d', 'required', NULL, 10),
    ('simples_nacional', 'defis', 'required', NULL, 20),
    ('simples_nacional', 'das_complementar_review', 'conditional', 'service_provider', 30),
    ('simples_nacional', 'iss_municipal', 'conditional', 'iss_applicable', 40),
    ('simples_nacional', 'municipal_service_tax_return', 'conditional', 'iss_applicable', 50),
    ('simples_nacional', 'icms_state_routine', 'conditional', 'icms_taxpayer', 60),
    ('simples_nacional', 'destda', 'conditional', 'icms_taxpayer', 70),
    ('simples_nacional', 'fgts', 'conditional', 'has_employees', 80),
    ('simples_nacional', 'esocial', 'conditional', 'has_employees', 90),
    ('simples_nacional', 'dctfweb_mit', 'conditional', 'has_employees', 100),
    ('simples_nacional', 'payroll_closing', 'conditional', 'has_employees', 110),
    ('simples_nacional', 'efd_reinf', 'conditional', 'service_provider', 120),
    ('simples_nacional', 'accounting_monthly_closing', 'conditional', 'accounting_contracted', 130),
    ('simples_nacional', 'tax_regularidade_review', 'required', NULL, 140),
    ('simples_nacional', 'client_document_checklist', 'required', NULL, 150),
    ('simples_nacional', 'annual_cadastral_fiscal_review', 'required', NULL, 160),
    ('simples_nacional', 'simples_option_status_review', 'required', NULL, 170),
    ('lucro_presumido', 'irpj_csll_presumido', 'required', NULL, 10),
    ('lucro_presumido', 'pis_cofins_cumulativo', 'required', NULL, 20),
    ('lucro_presumido', 'dctfweb_mit', 'required', NULL, 30),
    ('lucro_presumido', 'efd_reinf', 'conditional', 'service_provider', 50),
    ('lucro_presumido', 'ecf', 'required', NULL, 60),
    ('lucro_presumido', 'ecd', 'conditional', 'accounting_contracted', 70),
    ('lucro_presumido', 'efd_contribuicoes', 'conditional', 'service_provider', 80),
    ('lucro_presumido', 'efd_icms_ipi', 'conditional', 'icms_taxpayer', 90),
    ('lucro_presumido', 'iss_municipal', 'conditional', 'iss_applicable', 100),
    ('lucro_presumido', 'municipal_service_tax_return', 'conditional', 'iss_applicable', 110),
    ('lucro_presumido', 'fgts', 'conditional', 'has_employees', 120),
    ('lucro_presumido', 'esocial', 'conditional', 'has_employees', 130),
    ('lucro_presumido', 'payroll_closing', 'conditional', 'has_employees', 140),
    ('lucro_presumido', 'inss_contribution_review', 'conditional', 'has_employees', 150),
    ('lucro_presumido', 'tax_withholding_review', 'conditional', 'service_provider', 160),
    ('lucro_presumido', 'tax_regularidade_review', 'required', NULL, 170),
    ('lucro_presumido', 'client_document_checklist', 'required', NULL, 180),
    ('lucro_presumido', 'accounting_monthly_closing', 'required', NULL, 190),
    ('lucro_presumido', 'annual_cadastral_fiscal_review', 'required', NULL, 200),
    ('lucro_real', 'irpj_csll_lucro_real', 'required', NULL, 10),
    ('lucro_real', 'pis_cofins_nao_cumulativo', 'required', NULL, 20),
    ('lucro_real', 'dctfweb_mit', 'required', NULL, 30),
    ('lucro_real', 'efd_contribuicoes', 'required', NULL, 50),
    ('lucro_real', 'ecd', 'required', NULL, 60),
    ('lucro_real', 'ecf', 'required', NULL, 70),
    ('lucro_real', 'efd_reinf', 'conditional', 'service_provider', 80),
    ('lucro_real', 'efd_icms_ipi', 'conditional', 'icms_taxpayer', 90),
    ('lucro_real', 'iss_municipal', 'conditional', 'iss_applicable', 100),
    ('lucro_real', 'municipal_service_tax_return', 'conditional', 'iss_applicable', 110),
    ('lucro_real', 'fgts', 'conditional', 'has_employees', 120),
    ('lucro_real', 'esocial', 'conditional', 'has_employees', 130),
    ('lucro_real', 'payroll_closing', 'conditional', 'has_employees', 140),
    ('lucro_real', 'inss_contribution_review', 'conditional', 'has_employees', 150),
    ('lucro_real', 'tax_withholding_review', 'conditional', 'service_provider', 160),
    ('lucro_real', 'lalur_lacs_review', 'required', NULL, 170),
    ('lucro_real', 'tax_regularidade_review', 'required', NULL, 180),
    ('lucro_real', 'client_document_checklist', 'required', NULL, 190),
    ('lucro_real', 'accounting_monthly_closing', 'required', NULL, 200),
    ('lucro_real', 'annual_cadastral_fiscal_review', 'required', NULL, 210),
    ('mei', 'pgmei', 'required', NULL, 10),
    ('mei', 'dasn_simei', 'required', NULL, 20),
    ('mei', 'mei_revenue_support', 'required', NULL, 30),
    ('mei', 'iss_municipal', 'conditional', 'iss_applicable', 40),
    ('mei', 'municipal_service_tax_return', 'conditional', 'iss_applicable', 50),
    ('mei', 'mei_status_limit_review', 'required', NULL, 60),
    ('mei', 'fgts', 'conditional', 'has_employees', 70),
    ('mei', 'esocial', 'conditional', 'has_employees', 80),
    ('mei', 'dctfweb_mit', 'conditional', 'has_employees', 90),
    ('mei', 'payroll_closing', 'conditional', 'has_employees', 100),
    ('mei', 'mei_migration_alert', 'optional', NULL, 110),
    ('mei', 'client_document_checklist', 'required', NULL, 120),
    ('mei', 'annual_cadastral_fiscal_review', 'required', NULL, 130)
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

UPDATE public.obligation_regime_load_items item
SET is_active = false,
    notes = 'Item removido da carga padrao atual: DCTF PGD mensal foi substituida por DCTFWeb/MIT a partir de 2025.',
    updated_at = now()
FROM public.obligation_templates template
WHERE item.template_id = template.id
  AND template.code = 'dctf_mensal'
  AND item.is_active = true;
