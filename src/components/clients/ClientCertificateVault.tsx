import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, ShieldCheck, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type CertificateStatus = { id: string; status: "active" | "expired" | "revoked" | "replaced"; fingerprintSuffix: string; validFrom: string | null; expiresAt: string | null; createdAt: string };
const errorMessages: Record<string, string> = {
  invalid_certificate_file: "Selecione um certificado A1 no formato .pfx ou .p12.",
  invalid_certificate_size: "O certificado precisa ter no máximo 1 MB.",
  invalid_certificate_contents: "O arquivo não contém um certificado e uma chave privada válidos.",
  certificate_expired: "Este certificado já está vencido.",
  certificate_password_or_file_invalid: "A senha está incorreta ou o arquivo não é um certificado A1 válido.",
  forbidden: "Somente administradores podem gerenciar certificados A1.",
};

async function invokeVault(form: FormData) {
  const { data, error } = await supabase.functions.invoke<{ certificate: CertificateStatus | null; error?: { code?: string } }>("client-certificate-vault", { body: form });
  if (error) {
    let code = "operation_failed";
    const context = (error as { context?: Response }).context;
    if (context) {
      const payload = await context.clone().json().catch(() => null) as { error?: { code?: string } } | null;
      code = payload?.error?.code || code;
    }
    throw new Error(code);
  }
  if (data?.error?.code) throw new Error(data.error.code);
  return data?.certificate ?? null;
}

function buildForm(action: string, organizationId: string, clientId: string) {
  const form = new FormData();
  form.set("action", action); form.set("organizationId", organizationId); form.set("clientId", clientId);
  return form;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(value)) : "Não informado";
}

export function ClientCertificateVault({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const queryKey = ["client-a1-certificate", organizationId, clientId] as const;
  const statusQuery = useQuery({ queryKey, queryFn: () => invokeVault(buildForm("status", organizationId, clientId)), staleTime: 30_000 });
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !password) throw new Error("missing_fields");
      const form = buildForm("upload", organizationId, clientId); form.set("certificate", file); form.set("password", password);
      return invokeVault(form);
    },
    onSuccess: (certificate) => {
      queryClient.setQueryData(queryKey, certificate); setFile(null); setPassword("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Certificado A1 protegido e armazenado com segurança.");
    },
    onError: (cause) => toast.error(errorMessages[(cause as Error).message] || "Não foi possível proteger o certificado."),
  });
  const removeMutation = useMutation({
    mutationFn: () => invokeVault(buildForm("remove", organizationId, clientId)),
    onSuccess: () => { queryClient.setQueryData(queryKey, null); toast.success("Certificado removido do cofre."); },
    onError: () => toast.error("Não foi possível remover o certificado."),
  });
  const certificate = statusQuery.data;
  const isExpired = certificate?.expiresAt ? new Date(certificate.expiresAt) <= new Date() : false;

  if (statusQuery.isLoading) return <div className="flex min-h-48 items-center justify-center rounded-2xl border bg-card"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (statusQuery.isError && (statusQuery.error as Error).message === "forbidden") return <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Somente administradores podem acessar o cofre de certificados.</div>;

  return <div className="space-y-4"><div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b bg-emerald-50/60 px-5 py-4 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /></div><div><h3 className="font-semibold">Cofre do certificado digital A1</h3><p className="text-xs text-muted-foreground">Acesso restrito a administradores e operações internas autorizadas.</p></div></div>
      <Badge variant="outline" className="w-fit gap-1.5 border-emerald-200 bg-white text-emerald-700 dark:bg-background dark:text-emerald-300"><LockKeyhole className="h-3.5 w-3.5" /> Criptografia AES-256-GCM</Badge>
    </div>
    <div className="grid gap-6 p-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="a1-certificate">Arquivo do certificado</Label><Input ref={fileInputRef} id="a1-certificate" type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={(event) => setFile(event.target.files?.[0] || null)} /><p className="text-xs text-muted-foreground">Formatos .pfx ou .p12, com tamanho máximo de 1 MB.</p></div>
        <div className="space-y-1.5"><Label htmlFor="a1-password">Senha do certificado</Label><div className="relative"><Input id="a1-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" maxLength={256} className="pr-11" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
        <Button onClick={() => uploadMutation.mutate()} disabled={!file || !password || uploadMutation.isPending}>{uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{certificate ? "Substituir certificado" : "Proteger e armazenar"}</Button>
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>O arquivo e a senha são enviados por conexão HTTPS, validados no servidor e criptografados antes do armazenamento. Eles nunca poderão ser baixados ou visualizados por esta tela.</p></div>
      </div>
      <div className="rounded-2xl border bg-muted/20 p-4">{certificate ? <div className="space-y-4">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><CheckCircle2 className={`h-5 w-5 ${isExpired ? "text-destructive" : "text-emerald-600"}`} /><span className="font-medium">Certificado {isExpired ? "vencido" : "protegido"}</span></div><Badge variant={isExpired ? "destructive" : "secondary"}>{isExpired ? "Vencido" : "Ativo"}</Badge></div>
        <dl className="space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Validade</dt><dd className="mt-0.5 flex items-center gap-2"><CalendarClock className="h-4 w-4" /> {formatDate(certificate.expiresAt)}</dd></div><div><dt className="text-xs text-muted-foreground">Identificação segura</dt><dd className="mt-0.5 flex items-center gap-2 font-mono"><KeyRound className="h-4 w-4" /> termina em {certificate.fingerprintSuffix}</dd></div></dl>
        <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={removeMutation.isPending} onClick={() => { if (window.confirm("Remover definitivamente este certificado do cofre?")) removeMutation.mutate(); }}><Trash2 className="mr-2 h-4 w-4" />Remover do cofre</Button>
      </div> : <div className="flex min-h-44 flex-col items-center justify-center text-center"><LockKeyhole className="mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhum certificado armazenado</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">Após o cadastro, somente o estado e a validade ficarão visíveis.</p></div>}</div>
    </div>
  </div></div>;
}
