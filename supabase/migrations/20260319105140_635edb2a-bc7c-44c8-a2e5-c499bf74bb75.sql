-- Table for threaded messages on client requests
CREATE TABLE public.request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_from_team boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.request_messages ENABLE ROW LEVEL SECURITY;
-- Clients can view messages on their own requests, admins/managers can view all
CREATE POLICY "Users can view messages on own requests"
ON public.request_messages FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.client_requests cr
    WHERE cr.id = request_messages.request_id AND cr.user_id = auth.uid()
  )
);
-- Authenticated users can insert messages on requests they own or if they are admin/manager
CREATE POLICY "Users can insert messages"
ON public.request_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.client_requests cr
      WHERE cr.id = request_messages.request_id AND cr.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
  )
);
-- Enable realtime for request_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_messages;
