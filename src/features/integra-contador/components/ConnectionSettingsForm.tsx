import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfigureConnectionInput, FiscalEnvironment } from "../types";

export function ConnectionSettingsForm({ organizationId, submitting, onSubmit }: { organizationId: string; submitting: boolean; onSubmit: (input: ConfigureConnectionInput) => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const certificateInput = event.currentTarget.elements.namedItem("certificate") as HTMLInputElement | null;
    const certificate = certificateInput?.files?.[0];
    if (!certificate) return;
    await onSubmit({ organizationId, environment: data.get("environment") as FiscalEnvironment, contractorTaxId: String(data.get("contractorTaxId")), consumerKey: String(data.get("consumerKey")), consumerSecret: String(data.get("consumerSecret")), certificatePassword: String(data.get("certificatePassword")), certificate });
    formRef.current?.reset();
  };
  return <Card><CardHeader><CardTitle>Configurar credenciais</CardTitle></CardHeader><CardContent>
    <form ref={formRef} onSubmit={submit} className="grid gap-4" autoComplete="off">
      <div><Label htmlFor="environment">Ambiente</Label><select id="environment" name="environment" className="h-10 w-full rounded-md border bg-background px-3"><option value="validation">Validação</option><option value="production">Produção</option><option value="development">Desenvolvimento</option></select></div>
      <div><Label htmlFor="contractorTaxId">CNPJ contratante</Label><Input id="contractorTaxId" name="contractorTaxId" inputMode="numeric" pattern="[0-9]{14}" required /></div>
      <div><Label htmlFor="consumerKey">Consumer Key</Label><Input id="consumerKey" name="consumerKey" type="password" autoComplete="new-password" required /></div>
      <div><Label htmlFor="consumerSecret">Consumer Secret</Label><Input id="consumerSecret" name="consumerSecret" type="password" autoComplete="new-password" required /></div>
      <div><Label htmlFor="certificate">Certificado A1 (.p12 ou .pfx, até 2 MB)</Label><Input id="certificate" name="certificate" type="file" accept=".p12,.pfx" required /></div>
      <div><Label htmlFor="certificatePassword">Senha do certificado</Label><Input id="certificatePassword" name="certificatePassword" type="password" autoComplete="new-password" required /></div>
      <Button disabled={submitting}>{submitting ? "Salvando…" : "Salvar com segurança"}</Button>
    </form></CardContent></Card>;
}
