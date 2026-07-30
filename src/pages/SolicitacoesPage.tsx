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
  portalRequestFieldTypeLabels,
  portalRequestFieldTypes,
  portalRequestFieldTypesWithOptions,
  portalRequestTypesTable,
  resolvePortalRequestTypesForManagement,
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

const fieldTypeOptions: { value: PortalRequestFieldType; label: string }[] = portalRequestFieldTypes.map((value) => ({
  value,
  label: portalRequestFieldTypeLabels[value],
}));

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
    const nextTypes = resolvePortalRequestTypesForManagement(normalized.length > 0 ? normalized : defaultPortalRequestTypes);
    setRequestTypes(nextTypes);

    const nextSelected = selectedId && nextTypes.some((item) => item.id === selectedId)
      ? selectedId
      : nextTypes[0]?.id || null;
    setSelectedId(nextSelected);
    const nextDraftSource = nextTypes.find((item) => item.id === nextSelected) || nextTypes[0] || null;
    if (nextDraftSource) {
      setDraft(draftFromRequestType(nextDraftSource));
    } else {
      setSelectedId(null);
      setDraft(emptyDraft(organizationId || null));
    }
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
          ? (() => {
              const nextType = changes.type || field.type;
              const acceptsOptions = portalRequestFieldTypesWithOptions.has(nextType);

              return {
                ...field,
                ...changes,
                id: changes.label && !field.label ? normalizeFieldId(changes.label) : field.id,
                options: acceptsOptions ? changes.options || field.options || ["", ""] : undefined,
              };
            })()
          : field,
      ),
    }));
  };

  const handleFieldOptionChange = (fieldIndex: number, optionIndex: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((field, index) => {
        if (index !== fieldIndex) return field;
        const options = [...(field.options || [])];
        options[optionIndex] = value;
        return { ...field, options };
      }),
    }));
  };

  const handleAddFieldOption = (fieldIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((field, index) =>
        index === fieldIndex ? { ...field, options: [...(field.options || []), ""] } : field,
      ),
    }));
  };

  const handleRemoveFieldOption = (fieldIndex: number, optionIndex: number) => {
    setDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((field, index) =>
        index === fieldIndex
          ? { ...field, options: (field.options || []).filter((_, currentIndex) => currentIndex !== optionIndex) }
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
      .map((field, index) => {
        const options = (field.options || [])
          .map((option) => option.trim())
          .filter(Boolean)
          .slice(0, 20);

        return {
          id: normalizeFieldId(field.id || field.label) || `campo_${index + 1}`,
          label: field.label.trim(),
          type: field.type,
          required: Boolean(field.required),
          ...(portalRequestFieldTypesWithOptions.has(field.type) ? { options } : {}),
        };
      })
      .filter((field) => field.label);

    const fieldWithoutOptions = fields.find(
      (field) => portalRequestFieldTypesWithOptions.has(field.type) && (!field.options || field.options.length === 0),
    );
    if (fieldWithoutOptions) {
      toast.error(`Informe ao menos uma opção para o campo: ${fieldWithoutOptions.label}.`);
      return;
    }

    const slug = draft.slug.trim() || buildPortalRequestTypeSlug(title);
    setSaving(true);
    const payload = {
      organization_id: organizationId,
      title,
      slug,
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
    let targetId = shouldUpdate ? draft.id : null;

    if (!targetId) {
      const { data: existingType, error: lookupError } = await portalRequestTypesTable()
        .select("id")
        .eq("organization_id", organizationId)
        .eq("slug", slug)
        .maybeSingle();

      if (lookupError) {
        setSaving(false);
        toast.error(`Não foi possível validar o tipo existente: ${lookupError.message || "erro desconhecido"}`);
        return;
      }

      targetId = existingType && typeof existingType === "object" && "id" in existingType
        ? String((existingType as { id: unknown }).id || "")
        : null;
    }

    const request = targetId
      ? portalRequestTypesTable().update(payload).eq("id", targetId).select("*").single()
      : portalRequestTypesTable().insert(payload).select("*").single();

    const { data, error } = await request;
    setSaving(false);

    if (error || !data) {
      toast.error(`Não foi possível salvar o tipo de solicitação: ${error?.message || "erro desconhecido"}`);
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
    if (!organizationId) {
      toast.error("Organização atual não encontrada.");
      return;
    }

    const confirmed = window.confirm("Deseja excluir este tipo de solicitação?");
    if (!confirmed) return;

    setSaving(true);
    const deletedPayload = {
      organization_id: organizationId,
      title: draft.title.trim() || "Solicitação excluída",
      slug: draft.slug.trim() || buildPortalRequestTypeSlug(draft.title || "solicitacao-excluida"),
      description: draft.description.trim() || null,
      sector: normalizeRequestTypeSector(draft.sector),
      task_title_template: draft.taskTitleTemplate.trim() || draft.title.trim() || "Solicitação excluída",
      task_description_template: draft.taskDescriptionTemplate.trim() || null,
      form_fields: normalizeRequestTypeFields(draft.fields),
      is_active: false,
      sort_order: Number.parseInt(draft.sortOrder, 10) || 100,
      created_by: user?.id || null,
    };

    const shouldUpdate = draft.id && draft.sourceOrganizationId === organizationId;
    let deleteError: { message?: string } | null = null;

    if (shouldUpdate) {
      const result = await portalRequestTypesTable().update(deletedPayload).eq("id", draft.id).select("*").single();
      deleteError = result.error;
    } else {
      const { data: existingType, error: lookupError } = await portalRequestTypesTable()
        .select("id")
        .eq("organization_id", organizationId)
        .eq("slug", deletedPayload.slug)
        .maybeSingle();

      if (lookupError) {
        deleteError = lookupError;
      } else {
        const targetId = existingType && typeof existingType === "object" && "id" in existingType
          ? String((existingType as { id: unknown }).id || "")
          : null;
        const result = targetId
          ? await portalRequestTypesTable().update(deletedPayload).eq("id", targetId).select("*").single()
          : await portalRequestTypesTable().insert(deletedPayload).select("*").single();
        deleteError = result.error;
      }
    }

    setSaving(false);

    if (deleteError) {
      toast.error(`Não foi possível excluir: ${deleteError.message || "erro desconhecido"}`);
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
                  <Label>Título padrão da tarefa</Label>
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
                  <Label>Descrição curta do atalho</Label>
                  <Input
                    value={draft.description}
                    onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Texto auxiliar para orientar o cliente."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Descrição inicial da tarefa</Label>
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
                    {draft.fields.map((field, index) => {
                      const fieldAcceptsOptions = portalRequestFieldTypesWithOptions.has(field.type);

                      return (
                      <div key={`${field.id}-${index}`} className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_190px_130px_40px] md:items-end">
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
                        {fieldAcceptsOptions ? (
                          <div className="space-y-3 rounded-xl border bg-muted/20 p-3 md:col-span-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <Label>Opções disponíveis</Label>
                                <p className="text-xs text-muted-foreground">
                                  A numeração abaixo será usada no WhatsApp. O cliente responde apenas com o número.
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => handleAddFieldOption(index)}
                              >
                                <Plus className="h-4 w-4" />
                                Opção
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {(field.options && field.options.length > 0 ? field.options : [""]).map(
                                (option, optionIndex) => (
                                  <div key={`${field.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white text-sm font-semibold text-muted-foreground">
                                      {optionIndex + 1}
                                    </span>
                                    <Input
                                      value={option}
                                      onChange={(event) => handleFieldOptionChange(index, optionIndex, event.target.value)}
                                      placeholder={`Texto da opção ${optionIndex + 1}`}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 shrink-0 text-destructive"
                                      onClick={() => handleRemoveFieldOption(index, optionIndex)}
                                      disabled={(field.options || []).length <= 1}
                                      aria-label={`Remover opção ${optionIndex + 1}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}
                        {field.type === "file" ? (
                          <p className="text-xs text-muted-foreground md:col-span-4">
                            No portal este campo vira upload. No WhatsApp, o cliente deverá responder com mídia ou documento.
                          </p>
                        ) : null}
                      </div>
                      );
                    })}
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
