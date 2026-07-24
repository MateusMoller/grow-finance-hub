import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { ModuleContextPill } from "@/components/app/ModuleContextPill";
import { sectorOptions } from "@/components/portal/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  buildPortalRequestTypeSlug,
  defaultPortalRequestTypes,
  normalizePortalRequestType,
  normalizeRequestTypeFields,
  normalizeRequestTypeSector,
  portalRequestTypesTable,
  sortPortalRequestTypes,
  type PortalRequestFieldType,
  type PortalRequestType,
  type PortalRequestTypeField,
} from "@/lib/portalRequestTypes";
import { toast } from "sonner";

type RequestTypeDraft = {
  id: string | null;
  sourceOrganizationId: string | null;
  title: string;
  slug: string;
  description: string;
  sector: string;
  taskTitleTemplate: string;
  taskDescriptionTemplate: string;
  fields: PortalRequestTypeField[];
  isActive: boolean;
  sortOrder: string;
};

const fieldTypeOptions: { value: PortalRequestFieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "date", label: "Data" },
  { value: "number", label: "Número" },
];

const emptyDraft = (organizationId: string | null): RequestTypeDraft => ({
  id: null,
  sourceOrganizationId: organizationId,
  title: "",
  slug: "",
  description: "",
  sector: "Geral",
  taskTitleTemplate: "",
  taskDescriptionTemplate: "",
  fields: [],
  isActive: true,
  sortOrder: "100",
});

const draftFromRequestType = (requestType: PortalRequestType): RequestTypeDraft => ({
  id: requestType.id,
  sourceOrganizationId: requestType.organization_id,
  title: requestType.title,
  slug: requestType.slug,
  description: requestType.description || "",
  sector: normalizeRequestTypeSector(requestType.sector),
  taskTitleTemplate: requestType.task_title_template || requestType.title,
  taskDescriptionTemplate: requestType.task_description_template || "",
  fields: normalizeRequestTypeFields(requestType.form_fields),
  isActive: requestType.is_active,
  sortOrder: String(requestType.sort_order || 100),
});

const normalizeFieldId = (value: string) =>
  buildPortalRequestTypeSlug(value)
    .replace(/-/g, "_")
    .replace(/^_+|_+$/g, "");

export default function SolicitacoesPage() {
  const { user, effectiveAccess, currentOrganizationId } = useAuth();
  const organizationId = effectiveAccess?.organizationId || currentOrganizationId;

  const [requestTypes, setRequestTypes] = useState<PortalRequestType[]>(defaultPortalRequestTypes);
  const [selectedId, setSelectedId] = useState<string | null>(defaultPortalRequestTypes[0]?.id || null);
  const [draft, setDraft] = useState<RequestTypeDraft>(() => draftFromRequestType(defaultPortalRequestTypes[0]));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRequestType = useMemo(
    () => requestTypes.find((item) => item.id === selectedId) || null,
    [requestTypes, selectedId],
  );

  const loadRequestTypes = async () => {
    if (!user) return;
    setLoading(true);

    let query = portalRequestTypesTable()
      .select("*")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (organizationId) {
      query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
    } else {
      query = query.is("organization_id", null);
    }

    const { data, error } = await query;
    setLoading(false);

    if (error) {
      setRequestTypes(defaultPortalRequestTypes);
      toast.error("Não foi possível carregar os tipos salvos. Usando padrões locais.");
      return;
    }

    const normalized = sortPortalRequestTypes(
      (data || [])
        .map(normalizePortalRequestType)
        .filter((item: PortalRequestType | null): item is PortalRequestType => Boolean(item)),
    );
    const nextTypes = normalized.length > 0 ? normalized : defaultPortalRequestTypes;
    setRequestTypes(nextTypes);

    const nextSelected = selectedId && nextTypes.some((item) => item.id === selectedId)
      ? selectedId
      : nextTypes[0]?.id || null;
    setSelectedId(nextSelected);
    const nextDraftSource = nextTypes.find((item) => item.id === nextSelected) || nextTypes[0] || null;
    if (nextDraftSource) setDraft(draftFromRequestType(nextDraftSource));
  };

  useEffect(() => {
    void loadRequestTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, organizationId]);

  const handleSelect = (requestType: PortalRequestType) => {
    setSelectedId(requestType.id);
    setDraft(draftFromRequestType(requestType));
  };

  const handleNewType = () => {
    setSelectedId(null);
    setDraft(emptyDraft(organizationId || null));
  };

  const handleAddField = () => {
    setDraft((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          id: `campo_${prev.fields.length + 1}`,
          label: "",
          type: "text",
          required: false,
        },
      ],
    }));
  };

  const handleFieldChange = (index: number, changes: Partial<PortalRequestTypeField>) => {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((field, fieldIndex) =>
        fieldIndex === index
          ? {
              ...field,
              ...changes,
              id: changes.label && !field.label ? normalizeFieldId(changes.label) : field.id,
            }
          : field,
      ),
    }));
  };

  const handleRemoveField = (index: number) => {
    setDraft((prev) => ({ ...prev, fields: prev.fields.filter((_, fieldIndex) => fieldIndex !== index) }));
  };

  const handleSave = async () => {
    if (!user || !organizationId) {
      toast.error("Organização atual não encontrada.");
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      toast.error("Informe o nome do tipo de solicitação.");
      return;
    }

    const fields = draft.fields
      .map((field, index) => ({
        ...field,
        id: normalizeFieldId(field.id || field.label) || `campo_${index + 1}`,
        label: field.label.trim(),
      }))
      .filter((field) => field.label);

    setSaving(true);
    const payload = {
      organization_id: organizationId,
      title,
      slug: draft.slug.trim() || buildPortalRequestTypeSlug(title),
      description: draft.description.trim() || null,
      sector: normalizeRequestTypeSector(draft.sector),
      task_title_template: draft.taskTitleTemplate.trim() || title,
      task_description_template: draft.taskDescriptionTemplate.trim() || null,
      form_fields: fields,
      is_active: draft.isActive,
      sort_order: Number.parseInt(draft.sortOrder, 10) || 100,
      created_by: user.id,
    };

    const shouldUpdate = draft.id && draft.sourceOrganizationId === organizationId;
    const request = shouldUpdate
      ? portalRequestTypesTable().update(payload).eq("id", draft.id).select("*").single()
      : portalRequestTypesTable().insert(payload).select("*").single();

    const { data, error } = await request;
    setSaving(false);

    if (error || !data) {
      toast.error("Não foi possível salvar o tipo de solicitação.");
      return;
    }

    const saved = normalizePortalRequestType(data);
    if (!saved) {
      toast.error("Tipo salvo, mas a resposta veio inválida.");
      return;
    }

    toast.success("Tipo de solicitação salvo.");
    setSelectedId(saved.id);
    setDraft(draftFromRequestType(saved));
    await loadRequestTypes();
  };

  const handleDelete = async () => {
    if (!draft.id || draft.sourceOrganizationId !== organizationId) {
      toast.error("Tipos padrão não são excluídos. Desative ou salve uma versão da organização.");
      return;
    }

    const confirmed = window.confirm("Deseja excluir este tipo de solicitação?");
    if (!confirmed) return;

    setSaving(true);
    const { error } = await portalRequestTypesTable().delete().eq("id", draft.id);
    setSaving(false);

    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }

    toast.success("Tipo removido.");
    await loadRequestTypes();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <ModuleContextPill icon={ClipboardList} label="Portal do cliente" />
            <h1 className="font-heading text-2xl font-bold">Solicitações</h1>
            <p className="text-sm text-muted-foreground">
              Configure os tipos de solicitação que aparecem como atalhos no portal do cliente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => void loadRequestTypes()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button className="gap-1.5" onClick={handleNewType}>
              <Plus className="h-4 w-4" />
              Novo tipo
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Tipos cadastrados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {requestTypes.map((requestType) => {
                const selected = selectedRequestType?.id === requestType.id;
                return (
                  <button
                    key={requestType.id}
                    type="button"
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"
                    }`}
                    onClick={() => handleSelect(requestType)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{requestType.title}</p>
                        <p className="text-xs text-muted-foreground">{requestType.sector}</p>
                      </div>
                      <Badge variant={requestType.is_active ? "default" : "secondary"} className="shrink-0">
                        {requestType.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {requestType.description ? (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{requestType.description}</p>
                    ) : null}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings2 className="h-4 w-4" />
                    Editor do tipo
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Campos extras aparecem no formulário do portal quando o cliente escolhe este tipo.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={draft.isActive}
                    onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, isActive: checked }))}
                  />
                  <span className="text-sm text-muted-foreground">Ativo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do atalho</Label>
                  <Input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        title: event.target.value,
                        slug: prev.slug || buildPortalRequestTypeSlug(event.target.value),
                      }))
                    }
                    placeholder="Ex.: Nota fiscal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Setor responsavel</Label>
                  <Select value={draft.sector} onValueChange={(sector) => setDraft((prev) => ({ ...prev, sector }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sectorOptions.map((sector) => (
                        <SelectItem key={sector} value={sector}>
                          {sector}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Titulo padrao da tarefa</Label>
                  <Input
                    value={draft.taskTitleTemplate}
                    onChange={(event) => setDraft((prev) => ({ ...prev, taskTitleTemplate: event.target.value }))}
                    placeholder="Ex.: Solicitar nota fiscal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={draft.sortOrder}
                    onChange={(event) => setDraft((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descricao curta do atalho</Label>
                  <Input
                    value={draft.description}
                    onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Texto auxiliar para orientar o cliente."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descricao inicial da tarefa</Label>
                  <Textarea
                    className="min-h-[92px]"
                    value={draft.taskDescriptionTemplate}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, taskDescriptionTemplate: event.target.value }))
                    }
                    placeholder="Texto que entra automaticamente na descrição quando o tipo for escolhido."
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Campos do formulário</p>
                    <p className="text-xs text-muted-foreground">
                      Defina perguntas adicionais para este tipo de solicitação.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleAddField}>
                    <Plus className="h-4 w-4" />
                    Adicionar campo
                  </Button>
                </div>

                {draft.fields.length === 0 ? (
                  <div className="rounded-xl border bg-card px-3 py-4 text-sm text-muted-foreground">
                    Nenhum campo adicional configurado.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {draft.fields.map((field, index) => (
                      <div key={`${field.id}-${index}`} className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[1fr_180px_120px_40px] md:items-end">
                        <div className="space-y-2">
                          <Label>Nome do campo</Label>
                          <Input
                            value={field.label}
                            onChange={(event) => handleFieldChange(index, { label: event.target.value })}
                            placeholder="Ex.: Competencia"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select
                            value={field.type}
                            onValueChange={(value) => handleFieldChange(index, { type: value as PortalRequestFieldType })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {fieldTypeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pb-2">
                          <Switch
                            checked={Boolean(field.required)}
                            onCheckedChange={(required) => handleFieldChange(index, { required })}
                          />
                          <span className="text-sm">Obrigatório</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleRemoveField(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" className="gap-1.5" onClick={() => void handleDelete()} disabled={saving || !draft.id}>
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
                <Button type="button" className="gap-1.5" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
