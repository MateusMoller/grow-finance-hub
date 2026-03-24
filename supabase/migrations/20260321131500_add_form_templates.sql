-- Form templates managed by internal team and consumed by client portal
CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  sector text NOT NULL DEFAULT 'Geral',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS fields jsonb,
  ADD COLUMN IF NOT EXISTS is_published boolean,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.form_templates
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN sector SET DEFAULT 'Geral',
  ALTER COLUMN sector SET NOT NULL,
  ALTER COLUMN fields SET DEFAULT '[]'::jsonb,
  ALTER COLUMN fields SET NOT NULL,
  ALTER COLUMN is_published SET DEFAULT false,
  ALTER COLUMN is_published SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'form_templates_fields_is_array'
  ) THEN
    ALTER TABLE public.form_templates
      ADD CONSTRAINT form_templates_fields_is_array
      CHECK (jsonb_typeof(fields) = 'array');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'form_templates_created_by_fkey'
  ) THEN
    ALTER TABLE public.form_templates
      ADD CONSTRAINT form_templates_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients can view only published forms" ON public.form_templates;
CREATE POLICY "Clients can view only published forms" ON public.form_templates
FOR SELECT TO authenticated
USING (
  is_published
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
);
DROP POLICY IF EXISTS "Team can insert form templates" ON public.form_templates;
CREATE POLICY "Team can insert form templates" ON public.form_templates
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'employee')
  OR has_role(auth.uid(), 'commercial')
);
DROP POLICY IF EXISTS "Team can update form templates" ON public.form_templates;
CREATE POLICY "Team can update form templates" ON public.form_templates
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
DROP POLICY IF EXISTS "Admins can delete form templates" ON public.form_templates;
CREATE POLICY "Admins can delete form templates" ON public.form_templates
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'director')
  OR has_role(auth.uid(), 'manager')
);
DROP TRIGGER IF EXISTS update_form_templates_updated_at ON public.form_templates;
CREATE TRIGGER update_form_templates_updated_at
BEFORE UPDATE ON public.form_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.form_templates (title, description, sector, fields, is_published)
SELECT
  'Formulário de Admissão',
  'Cadastro de novo colaborador para início do processo de admissão.',
  'Departamento Pessoal',
  '[
    {"name":"empresa","label":"Empresa","type":"text","required":true,"placeholder":"Nome da empresa"},
    {"name":"nome_colaborador","label":"Nome do colaborador","type":"text","required":true},
    {"name":"cpf","label":"CPF","type":"text","required":true,"placeholder":"000.000.000-00"},
    {"name":"cargo","label":"Cargo","type":"text","required":true},
    {"name":"salario","label":"Salário","type":"text","required":true,"placeholder":"R$ 0,00"},
    {"name":"data_admissao","label":"Data de admissão","type":"date","required":true},
    {"name":"tipo_contrato","label":"Tipo de contrato","type":"select","required":true,"options":["CLT","Estágio","Temporário","PJ"]},
    {"name":"observacoes","label":"Observações","type":"textarea","placeholder":"Informações adicionais..."}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.form_templates
  WHERE title = 'Formulário de Admissão'
);
INSERT INTO public.form_templates (title, description, sector, fields, is_published)
SELECT
  'Formulário de Férias',
  'Solicitação de férias com período e configurações de pagamento.',
  'Departamento Pessoal',
  '[
    {"name":"empresa","label":"Empresa","type":"text","required":true},
    {"name":"nome_colaborador","label":"Nome do colaborador","type":"text","required":true},
    {"name":"cpf","label":"CPF","type":"text","required":true},
    {"name":"data_inicio","label":"Data de início das férias","type":"date","required":true},
    {"name":"dias","label":"Quantidade de dias","type":"select","required":true,"options":["30 dias","20 dias + 10 abono","15 dias + 15 dias","10 dias + 20 dias"]},
    {"name":"abono","label":"Vender 1/3 (abono)?","type":"select","options":["Sim","Não"]},
    {"name":"observacoes","label":"Observações","type":"textarea","placeholder":"Informações adicionais..."}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.form_templates
  WHERE title = 'Formulário de Férias'
);
INSERT INTO public.form_templates (title, description, sector, fields, is_published)
SELECT
  'Formulário de Demissão',
  'Abertura de processo de desligamento de colaborador.',
  'Departamento Pessoal',
  '[
    {"name":"empresa","label":"Empresa","type":"text","required":true},
    {"name":"nome_colaborador","label":"Nome do colaborador","type":"text","required":true},
    {"name":"cpf","label":"CPF","type":"text","required":true},
    {"name":"data_demissao","label":"Data de demissão","type":"date","required":true},
    {"name":"tipo_demissao","label":"Tipo de demissão","type":"select","required":true,"options":["Sem justa causa","Com justa causa","Pedido de demissão","Acordo mútuo"]},
    {"name":"motivo","label":"Motivo","type":"textarea","placeholder":"Descreva o motivo..."}
  ]'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.form_templates
  WHERE title = 'Formulário de Demissão'
);
