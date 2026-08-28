import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegraContadorConnection } from "../types";
import { FiscalStatusBadge } from "./FiscalStatusBadge";

export function ConnectionHealthCard({ connection, canTest, testing, onTest }: { connection: IntegraContadorConnection | null; canTest: boolean; testing: boolean; onTest: () => void }) {
  return <Card><CardHeader><CardTitle className="flex items-center justify-between">Saúde da conexão {connection ? <FiscalStatusBadge status={connection.status} /> : null}</CardTitle></CardHeader>
    <CardContent className="space-y-3 text-sm"><p>{connection ? `Ambiente: ${connection.environment}` : "Integração ainda não configurada. Você pode ativar a demonstração oficial do SERPRO sem credenciais de produção."}</p>
      {connection?.lastErrorCode ? <p role="alert">Ação necessária: verifique contrato, certificado e procurações.</p> : null}
      {canTest ? <Button type="button" onClick={onTest} disabled={testing}>{testing ? "Validando…" : connection ? "Testar conexão" : "Ativar demonstração"}</Button> : null}
    </CardContent></Card>;
}
