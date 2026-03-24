-- Clients table to persist client data
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  regime text DEFAULT 'Simples Nacional',
  sector text DEFAULT 'Contábil',
  status text DEFAULT 'Ativo',
  contact text,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'director')
  );
CREATE POLICY "Team can insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee')
  );
CREATE POLICY "Team can update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee')
  );
CREATE POLICY "Admins can delete clients" ON public.clients
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
-- Client data entries (contabilidade, fiscal, DP)
CREATE TABLE public.client_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'contabilidade', -- contabilidade, fiscal, dp
  field_name text NOT NULL,
  field_value text,
  period text, -- e.g. '2026-03', 'Q1-2026'
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view client_data" ON public.client_data
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'director')
  );
CREATE POLICY "Team can insert client_data" ON public.client_data
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee')
  );
CREATE POLICY "Team can update client_data" ON public.client_data
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee')
  );
CREATE POLICY "Admins can delete client_data" ON public.client_data
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
-- Client file attachments (per category)
CREATE TABLE public.client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'contabilidade',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can view client_files" ON public.client_files
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'director')
  );
CREATE POLICY "Team can insert client_files" ON public.client_files
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee')
  );
CREATE POLICY "Admins can delete client_files" ON public.client_files
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
-- Storage bucket for client files
INSERT INTO storage.buckets (id, name, public) VALUES ('client-files', 'client-files', false);
CREATE POLICY "Team can upload client files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files' AND (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'employee')
  ));
CREATE POLICY "Team can view client files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-files' AND (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'director')
  ));
CREATE POLICY "Admins can delete client files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-files' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')));
-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_data_updated_at BEFORE UPDATE ON public.client_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
