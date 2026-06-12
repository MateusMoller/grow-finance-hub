import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { filterReportFields, groupReportFields } from "@/lib/reports/fieldSearch";
import type { ReportFieldDefinition } from "@/lib/reports/types";

interface ReportFieldBrowserProps {
  fields: readonly ReportFieldDefinition[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (fieldKey: string) => void;
}

export function ReportFieldBrowser({ fields, selectedKeys, onToggle }: ReportFieldBrowserProps) {
  const [search, setSearch] = useState("");
  const groups = useMemo(() => groupReportFields(filterReportFields(fields, search)), [fields, search]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Pesquisar campo"
          className="pl-9"
        />
      </div>
      <div className="max-h-[420px] space-y-3 overflow-auto pr-1 [content-visibility:auto]">
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum campo encontrado.</p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{group.label}</p>
              {group.fields.map((field) => (
                <label
                  key={field.key}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-2.5 text-sm hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selectedKeys.has(field.key)}
                    onCheckedChange={() => onToggle(field.key)}
                    aria-label={`Selecionar coluna ${field.label}`}
                  />
                  <span className="grid min-w-0 gap-1">
                    <span className="break-words font-medium leading-snug">{field.label}</span>
                    <span className="text-xs text-muted-foreground">{field.classification}</span>
                  </span>
                </label>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
