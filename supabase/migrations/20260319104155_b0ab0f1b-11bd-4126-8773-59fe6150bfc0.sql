-- Status enum for requests
CREATE TYPE public.request_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
-- Client requests table
CREATE TABLE public.client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  status request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
-- Clients see own requests, admins/managers see all
CREATE POLICY "Clients can view own requests" ON public.client_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Clients can insert own requests" ON public.client_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can update requests" ON public.client_requests
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR user_id = auth.uid());
CREATE POLICY "Admins can delete requests" ON public.client_requests
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
-- Trigger for updated_at
CREATE TRIGGER update_client_requests_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Client documents table
CREATE TABLE public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.client_requests(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients can view own documents" ON public.client_documents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Clients can insert own documents" ON public.client_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Clients can delete own documents" ON public.client_documents
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));
-- Storage bucket for client documents
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', false);
-- Storage policies
CREATE POLICY "Clients can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Clients can view own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')));
CREATE POLICY "Clients can delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR has_role(auth.uid(), 'admin')));
