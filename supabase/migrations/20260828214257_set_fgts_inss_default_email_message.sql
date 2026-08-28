update public.obligation_templates
set
  completion_email_body = $message$Olá, {{cliente_nome}}!

Informamos que segue abaixo o link de acesso ao documento referente à **competência 08/2026**, com vencimento em **04/09/2026**:

{{documento_link}}

Pedimos, por gentileza, que verifique o documento e fique atento à data de vencimento.

Caso tenha alguma dúvida, conte conosco.

Atenciosamente,

Grow Contabilidade$message$,
  updated_at = now()
where lower(code) in ('fgts', 'inss');
