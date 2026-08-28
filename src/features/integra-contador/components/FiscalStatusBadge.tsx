import { Badge } from "@/components/ui/badge";
import type { FiscalConnectionStatus } from "../types";

const labels: Record<FiscalConnectionStatus, string> = { disabled: "Desativada", pending: "Aguardando validação", validating: "Validando", active: "Operacional", requires_action: "Requer ação", failed: "Falha" };
export function FiscalStatusBadge({ status }: { status: FiscalConnectionStatus }) {
  return <Badge variant={status === "active" ? "default" : status === "failed" ? "destructive" : "secondary"} role="status">{labels[status]}</Badge>;
}
