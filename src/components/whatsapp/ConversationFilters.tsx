import { Search } from "lucide-react";
import type { WhatsAppConversationFilters, WhatsAppConversationStatus } from "@/lib/whatsappTypes";

const statuses: Array<{ value: WhatsAppConversationStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abertas" },
  { value: "in_attendance", label: "Em atendimento" },
  { value: "pending_client", label: "Aguardando cliente" },
  { value: "resolved", label: "Resolvidas" },
];

export function ConversationFilters({
  filters,
  onChange,
}: {
  filters: WhatsAppConversationFilters;
  onChange: (filters: WhatsAppConversationFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center">
      <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={filters.search || ""}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Buscar por cliente, contato, telefone ou mensagem"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>
      <select
        value={filters.status || "all"}
        onChange={(event) => onChange({ ...filters, status: event.target.value as WhatsAppConversationStatus | "all" })}
        className="h-11 rounded-xl border bg-background px-3 text-sm outline-none"
      >
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
      <label className="flex h-11 items-center gap-2 rounded-xl border bg-background px-3 text-sm">
        <input
          type="checkbox"
          checked={Boolean(filters.unread)}
          onChange={(event) => onChange({ ...filters, unread: event.target.checked })}
        />
        Nao lidas
      </label>
    </div>
  );
}
