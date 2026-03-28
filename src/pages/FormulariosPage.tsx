import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type FormFieldType = "text" | "email" | "date" | "select" | "textarea";

interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface ManagedForm {
  id: string;
  title: string;
  description: string | null;
  sector: string;
  is_published: boolean;
  fields: FormField[];
  created_at: string;
  updated_at: string;
}

interface FormEditorState {
  title: string;
  description: string;
  sector: string;
  is_published: boolean;
  fields: FormField[];
}

type FormTemplateRow = Tables<"form_templates">;

const sectorOptions = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Financeiro",
  "Comercial",
  "Societário",
  "Geral",
];

const fieldTypeOptions: Array<{ value: FormFieldType; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "email", label: "E-mail" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção" },
  { value: "textarea", label: "Texto longo" },
];

const createEmptyField = (index: number): FormField => ({
  name: `campo_${index}`,
  label: "",
  type: "text",
  required: false,
  options: [],
  placeholder: "",
});

const createEmptyEditor = (): FormEditorState => ({
  title: "",
  description: "",
  sector: "Geral",
  is_published: false,
  fields: [createEmptyField(1)],
});

const normalizeFieldName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const parseFields = (value: unknown): FormField[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const type = raw.type;

      if (!["text", "email", "date", "select", "textarea"].includes(String(type))) {
        return null;
      }

      return {
        name: String(raw.name || `campo_${index + 1}`),
        label: String(raw.label || ""),
        type: type as FormFieldType,
        required: Boolean(raw.required),
        options: Array.isArray(raw.options)
          ? raw.options.map((option) => String(option))
          : [],
        placeholder: raw.placeholder ? String(raw.placeholder) : "",
      };
    })
    .filter((field): field is FormField => Boolean(field));
};

export default function FormulariosPage() {
  const { user } = useAuth();

  const [forms, setForms] = useState<ManagedForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [draft, setDraft] = useState<FormEditorState>(createEmptyEditor());

  const fetchForms = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("form_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(`Erro ao carregar formulários: ${error.message}`);
      setLoading(false);
      return;
    }

    const parsed = (data || []).map((item) => {
      const row = item as FormTemplateRow;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        sector: row.sector || "Geral",
        is_published: Boolean(row.is_published),
        fields: parseFields(row.fields),
        created_at: row.created_at,
        updated_at: row.updated_at,
      } satisfies ManagedForm;
    });

    setForms(parsed);
    setLoading(false);
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const filteredForms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return forms;

    return forms.filter((form) => {
      return (
        form.title.toLowerCase().includes(term) ||
        (form.description || "").toLowerCase().includes(term) ||
        form.sector.toLowerCase().includes(term)
      );
    });
  }, [forms, search]);

  const stats = {
    total: forms.length,
    published: forms.filter((form) => form.is_published).length,
    drafts: forms.filter((form) => !form.is_published).length,
  };

  const openCreateDialog = () => {
    setEditingFormId(null);
    setDraft(createEmptyEditor());
    setEditorOpen(true);
  };

  const openEditDialog = (form: ManagedForm) => {
    setEditingFormId(form.id);
    setDraft({
      title: form.title,
      description: form.description || "",
      sector: sectorOptions.includes(form.sector) ? form.sector : "Geral",
      is_published: form.is_published,
      fields: form.fields.length > 0
        ? form.fields.map((field) => ({ ...field, options: field.options || [] }))
        : [createEmptyField(1)],
    });
    setEditorOpen(true);
  };

  const updateField = (index: number, key: keyof FormField, value: string | boolean | string[]) => {
    setDraft((prev) => {
      const nextFields = [...prev.fields];
      const current = nextFields[index];
      if (!current) return prev;

      nextFields[index] = {
        ...current,
        [key]: value,
      } as FormField;

      return { ...prev, fields: nextFields };
    });
  };

  const addField = () => {
    setDraft((prev) => ({
      ...prev,
      fields: [...prev.fields, createEmptyField(prev.fields.length + 1)],
    }));
  };

  const removeField = (index: number) => {
    setDraft((prev) => {
      if (prev.fields.length <= 1) return prev;
      return {
        ...prev,
        fields: prev.fields.filter((_, idx) => idx !== index),
      };
    });
  };

  const normalizeDraftFields = (): FormField[] => {
    return draft.fields.map((field, index) => {
      const normalizedName = normalizeFieldName(field.name || field.label || `campo_${index + 1}`);
      return {
        name: normalizedName || `campo_${index + 1}`,
        label: field.label.trim(),
        type: field.type,
        required: Boolean(field.required),
        placeholder: field.placeholder?.trim() || "",
        options:
          field.type === "select"
            ? (field.options || []).map((option) => option.trim()).filter(Boolean)
            : [],
      };
    });
  };

  const saveForm = async () => {
    const title = draft.title.trim();
    if (!title) {
      toast.error("Informe o título do formulário");
      return;
    }

    if (draft.fields.length === 0) {
      toast.error("Adicione ao menos um campo");
      return;
    }

    const normalizedFields = normalizeDraftFields();

    const missingLabel = normalizedFields.find((field) => !field.label);
    if (missingLabel) {
      toast.error("Todos os campos precisam de rótulo");
      return;
    }

    const duplicateName = normalizedFields.find(
      (field, index) => normalizedFields.findIndex((inner) => inner.name === field.name) !== index
    );

    if (duplicateName) {
      toast.error("Os nomes dos campos precisam ser únicos");
      return;
    }

    const payload = {
      title,
      description: draft.description.trim() || null,
      sector: draft.sector,
      is_published: draft.is_published,
      fields: normalizedFields as Json,
    };

    setSaving(true);

    if (editingFormId) {
      const { error } = await supabase
        .from("form_templates")
        .update(payload)
        .eq("id", editingFormId);

      setSaving(false);

      if (error) {
        toast.error(`Erro ao atualizar formulário: ${error.message}`);
        return;
      }

      toast.success("Formulário atualizado");
    } else {
      const { error } = await supabase
        .from("form_templates")
        .insert([{
          ...payload,
          created_by: user?.id || null,
        }]);

      setSaving(false);

      if (error) {
        toast.error(`Erro ao criar formulário: ${error.message}`);
        return;
      }

      toast.success("Formulário criado");
    }

    setEditorOpen(false);
    setEditingFormId(null);
    setDraft(createEmptyEditor());
    fetchForms();
  };

  const togglePublish = async (form: ManagedForm) => {
    setTogglingId(form.id);

    const { error } = await supabase
      .from("form_templates")
      .update({ is_published: !form.is_published })
      .eq("id", form.id);

    setTogglingId(null);

    if (error) {
      toast.error(`Erro ao atualizar status: ${error.message}`);
      return;
    }

    setForms((prev) =>
      prev.map((item) =>
        item.id === form.id ? { ...item, is_published: !item.is_published } : item
      )
    );

    toast.success(form.is_published ? "Formulário despublicado" : "Formulário publicado");
  };

  const deleteForm = async (form: ManagedForm) => {
    const confirmed = window.confirm(`Excluir o formulário "${form.title}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("form_templates").delete().eq("id", form.id);

    if (error) {
      toast.error(`Erro ao excluir formulário: ${error.message}`);
      return;
    }

    setForms((prev) => prev.filter((item) => item.id !== form.id));
    toast.success("Formulário excluído");
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">Formulários</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie modelos de formulários e publique no Portal do Cliente quando estiverem prontos.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Novo formulário
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Publicados</p>
            <p className="text-2xl font-bold mt-1 text-primary">{stats.published}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Rascunhos</p>
            <p className="text-2xl font-bold mt-1">{stats.drafts}</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <Label htmlFor="search-form" className="text-xs text-muted-foreground">Buscar formulário</Label>
          <Input
            id="search-form"
            className="mt-2"
            placeholder="Buscar por título, descrição ou setor..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nenhum formulário encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Crie o primeiro formulário para disponibilizar no portal.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredForms.map((form, index) => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{form.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Atualizado em {new Date(form.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={form.is_published ? "default" : "secondary"}>
                    {form.is_published ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground mt-3 line-clamp-3">
                  {form.description || "Sem descrição"}
                </p>

                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  <Badge variant="outline">{form.sector}</Badge>
                  <span>{form.fields.length} campo(s)</span>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditDialog(form)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>

                  <Button
                    size="sm"
                    variant={form.is_published ? "secondary" : "default"}
                    onClick={() => togglePublish(form)}
                    disabled={togglingId === form.id}
                  >
                    {togglingId === form.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : form.is_published ? (
                      "Despublicar"
                    ) : (
                      "Publicar"
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteForm(form)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFormId ? "Editar formulário" : "Novo formulário"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex: Formulário de Admissão"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Setor responsável</Label>
                <Select
                  value={draft.sector}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, sector: value }))}
                >
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
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                placeholder="Explique quando este formulário deve ser usado"
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Publicado no portal</p>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, clientes verão este formulário na aba de Formulários.
                </p>
              </div>
              <Switch
                checked={draft.is_published}
                onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_published: checked }))}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Campos do formulário</h3>
                <Button type="button" variant="outline" size="sm" onClick={addField}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar campo
                </Button>
              </div>

              <div className="space-y-3">
                {draft.fields.map((field, index) => (
                  <div key={`${field.name}_${index}`} className="border rounded-lg p-4 space-y-3">
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Rótulo</Label>
                        <Input
                          value={field.label}
                          onChange={(event) => updateField(index, "label", event.target.value)}
                          placeholder="Ex: Nome do colaborador"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Nome interno</Label>
                        <Input
                          value={field.name}
                          onChange={(event) => updateField(index, "name", event.target.value)}
                          placeholder="nome_colaborador"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Tipo</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(index, "type", value as FormFieldType)}
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

                      <div className="space-y-1 md:col-span-2">
                        <Label>Placeholder (opcional)</Label>
                        <Input
                          value={field.placeholder || ""}
                          onChange={(event) => updateField(index, "placeholder", event.target.value)}
                          placeholder="Texto de ajuda"
                        />
                      </div>
                    </div>

                    {field.type === "select" && (
                      <div className="space-y-1">
                        <Label>Opções (separadas por vírgula)</Label>
                        <Input
                          value={(field.options || []).join(", ")}
                          onChange={(event) => {
                            const options = event.target.value
                              .split(",")
                              .map((option) => option.trim())
                              .filter(Boolean);
                            updateField(index, "options", options);
                          }}
                          placeholder="Sim, Não"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={Boolean(field.required)}
                          onCheckedChange={(checked) => updateField(index, "required", checked)}
                        />
                        <span className="text-sm">Campo obrigatório</span>
                      </div>

                      {draft.fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeField(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditorOpen(false);
                setEditingFormId(null);
                setDraft(createEmptyEditor());
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={saveForm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar formulário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}


