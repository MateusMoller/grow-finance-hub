import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Newspaper,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Send,
  Mail,
  Users,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { buildNewsletterSlug, triggerNewsletterBroadcast } from "@/lib/newsletter";

type NewsletterRow = Tables<"newsletters">;

interface ManagedNewsletter {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  is_published: boolean;
  published_at: string | null;
  email_sent_at: string | null;
  email_send_error: string | null;
  updated_at: string;
}

interface NewsletterEditorState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  is_published: boolean;
}

const createEmptyDraft = (): NewsletterEditorState => ({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  is_published: false,
});

const parseNewsletter = (row: NewsletterRow): ManagedNewsletter => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt,
  content: row.content,
  is_published: row.is_published,
  published_at: row.published_at,
  email_sent_at: row.email_sent_at,
  email_send_error: row.email_send_error,
  updated_at: row.updated_at,
});

const getFunctionErrorMessage = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (payload && typeof payload === "object" && "error" in payload) {
        return String(payload.error);
      }
    } catch {
      // ignore parse errors and fallback to generic message
    }
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message || "Erro ao executar funcao");
  }

  return "Erro ao executar funcao";
};

export default function NewsletterAdminPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newsletters, setNewsletters] = useState<ManagedNewsletter[]>([]);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [activeSubscribersCount, setActiveSubscribersCount] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNewsletterId, setEditingNewsletterId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewsletterEditorState>(createEmptyDraft());

  const fetchNewsletters = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [newslettersRes, totalSubscribersRes, activeSubscribersRes] = await Promise.all([
      supabase
        .from("newsletters")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("newsletter_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

    setLoading(false);

    if (newslettersRes.error) {
      toast.error(`Erro ao carregar newsletters: ${newslettersRes.error.message}`);
      return;
    }

    if (totalSubscribersRes.error) {
      toast.error(`Erro ao carregar assinantes: ${totalSubscribersRes.error.message}`);
      return;
    }

    if (activeSubscribersRes.error) {
      toast.error(`Erro ao carregar assinantes ativos: ${activeSubscribersRes.error.message}`);
      return;
    }

    const parsed = (newslettersRes.data || []).map((item) => parseNewsletter(item as NewsletterRow));
    setNewsletters(parsed);
    setSubscribersCount(totalSubscribersRes.count || 0);
    setActiveSubscribersCount(activeSubscribersRes.count || 0);
  }, [isAdmin]);

  useEffect(() => {
    void fetchNewsletters();
  }, [fetchNewsletters]);

  const stats = useMemo(
    () => ({
      total: newsletters.length,
      published: newsletters.filter((item) => item.is_published).length,
      sent: newsletters.filter((item) => item.email_sent_at).length,
    }),
    [newsletters],
  );

  const openCreateDialog = () => {
    setEditingNewsletterId(null);
    setDraft(createEmptyDraft());
    setEditorOpen(true);
  };

  const openEditDialog = (newsletter: ManagedNewsletter) => {
    setEditingNewsletterId(newsletter.id);
    setDraft({
      title: newsletter.title,
      slug: newsletter.slug,
      excerpt: newsletter.excerpt || "",
      content: newsletter.content,
      is_published: newsletter.is_published,
    });
    setEditorOpen(true);
  };

  const dispatchEmails = async (newsletterId: string, silentSuccess = false) => {
    setSendingId(newsletterId);
    const { error } = await triggerNewsletterBroadcast(newsletterId);
    setSendingId(null);

    if (error) {
      const message = await getFunctionErrorMessage(error);
      toast.error(`Falha ao enviar newsletter: ${message}`);
      await fetchNewsletters();
      return false;
    }

    if (!silentSuccess) {
      toast.success("Newsletter enviada para os assinantes");
    }
    await fetchNewsletters();
    return true;
  };

  const saveNewsletter = async () => {
    if (!isAdmin) {
      toast.error("Apenas admin pode gerenciar newsletters");
      return;
    }

    const title = draft.title.trim();
    const content = draft.content.trim();
    const slug = buildNewsletterSlug(draft.slug || draft.title);

    if (!title) {
      toast.error("Informe o titulo da newsletter");
      return;
    }

    if (!content) {
      toast.error("Informe o conteudo da newsletter");
      return;
    }

    const existing = editingNewsletterId
      ? newsletters.find((item) => item.id === editingNewsletterId) || null
      : null;

    const isPublishingNow = Boolean(draft.is_published && !existing?.is_published);
    const publishDate = draft.is_published
      ? existing?.published_at || new Date().toISOString()
      : null;

    const payload = {
      title,
      slug,
      excerpt: draft.excerpt.trim() || null,
      content,
      is_published: draft.is_published,
      published_at: publishDate,
      email_sent_at: draft.is_published ? existing?.email_sent_at || null : null,
      email_send_error: draft.is_published ? existing?.email_send_error || null : null,
    };

    setSaving(true);

    if (editingNewsletterId) {
      const { error } = await supabase
        .from("newsletters")
        .update(payload)
        .eq("id", editingNewsletterId);

      setSaving(false);

      if (error) {
        toast.error(`Erro ao atualizar newsletter: ${error.message}`);
        return;
      }

      toast.success("Newsletter atualizada");
      setEditorOpen(false);
      setEditingNewsletterId(null);
      setDraft(createEmptyDraft());
      await fetchNewsletters();

      if (isPublishingNow) {
        await dispatchEmails(editingNewsletterId, true);
      }
      return;
    }

    const { data, error } = await supabase
      .from("newsletters")
      .insert([
        {
          ...payload,
          created_by: user?.id || null,
        },
      ])
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      toast.error(`Erro ao criar newsletter: ${error.message}`);
      return;
    }

    toast.success("Newsletter criada");
    setEditorOpen(false);
    setEditingNewsletterId(null);
    setDraft(createEmptyDraft());
    await fetchNewsletters();

    if (draft.is_published && data?.id) {
      await dispatchEmails(data.id, true);
    }
  };

  const togglePublish = async (newsletter: ManagedNewsletter) => {
    if (!isAdmin) {
      toast.error("Apenas admin pode publicar newsletters");
      return;
    }

    const nextPublished = !newsletter.is_published;
    setTogglingId(newsletter.id);

    const { error } = await supabase
      .from("newsletters")
      .update({
        is_published: nextPublished,
        published_at: nextPublished ? newsletter.published_at || new Date().toISOString() : null,
        email_sent_at: nextPublished ? newsletter.email_sent_at : null,
        email_send_error: nextPublished ? newsletter.email_send_error : null,
      })
      .eq("id", newsletter.id);

    setTogglingId(null);

    if (error) {
      toast.error(`Erro ao atualizar publicacao: ${error.message}`);
      return;
    }

    toast.success(nextPublished ? "Newsletter publicada" : "Newsletter despublicada");
    await fetchNewsletters();

    if (nextPublished && !newsletter.email_sent_at) {
      await dispatchEmails(newsletter.id, true);
    }
  };

  const deleteNewsletter = async (newsletter: ManagedNewsletter) => {
    if (!isAdmin) {
      toast.error("Apenas admin pode excluir newsletters");
      return;
    }

    const confirmed = window.confirm(`Excluir newsletter "${newsletter.title}"?`);
    if (!confirmed) return;

    const { error } = await supabase.from("newsletters").delete().eq("id", newsletter.id);
    if (error) {
      toast.error(`Erro ao excluir newsletter: ${error.message}`);
      return;
    }

    setNewsletters((prev) => prev.filter((item) => item.id !== newsletter.id));
    toast.success("Newsletter excluida");
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl space-y-4">
          <h1 className="font-heading text-2xl font-bold">Newsletter</h1>
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm">
              Esta area e exclusiva para administradores. Use um usuario com perfil admin para cadastrar e publicar
              newsletters.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Newsletter</h1>
            <p className="text-sm text-muted-foreground">
              Crie conteudos, publique no site e dispare e-mails automaticamente para os assinantes.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Nova newsletter
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total de newsletters</p>
            <p className="mt-1 text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Publicadas</p>
            <p className="mt-1 text-2xl font-bold text-primary">{stats.published}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Com e-mail enviado</p>
            <p className="mt-1 text-2xl font-bold">{stats.sent}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Assinantes totais</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <Users className="h-4 w-4 text-primary" /> {subscribersCount}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Assinantes ativos</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold">
              <Mail className="h-4 w-4 text-primary" /> {activeSubscribersCount}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : newsletters.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhuma newsletter cadastrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Clique em "Nova newsletter" para criar a primeira edicao.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {newsletters.map((newsletter, index) => (
              <motion.div
                key={newsletter.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-xl border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{newsletter.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Atualizado em {new Date(newsletter.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={newsletter.is_published ? "default" : "secondary"}>
                    {newsletter.is_published ? "Publicado" : "Rascunho"}
                  </Badge>
                </div>

                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {newsletter.excerpt || "Sem resumo. Clique em editar para adicionar um resumo curto."}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {newsletter.email_sent_at ? (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">
                      E-mail enviado
                    </Badge>
                  ) : newsletter.is_published ? (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-700">
                      E-mail pendente
                    </Badge>
                  ) : (
                    <Badge variant="outline">Aguardando publicacao</Badge>
                  )}
                  <span className="text-muted-foreground">Slug: /newsletter/{newsletter.slug}</span>
                </div>

                {newsletter.email_send_error && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{newsletter.email_send_error}</span>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditDialog(newsletter)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>

                  <Button
                    size="sm"
                    variant={newsletter.is_published ? "secondary" : "default"}
                    disabled={togglingId === newsletter.id}
                    onClick={() => togglePublish(newsletter)}
                  >
                    {togglingId === newsletter.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : newsletter.is_published ? (
                      "Despublicar"
                    ) : (
                      "Publicar"
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={!newsletter.is_published || sendingId === newsletter.id}
                    onClick={() => dispatchEmails(newsletter.id)}
                  >
                    {sendingId === newsletter.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> Enviar e-mails
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => deleteNewsletter(newsletter)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingNewsletterId(null);
            setDraft(createEmptyDraft());
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNewsletterId ? "Editar newsletter" : "Nova newsletter"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Titulo</Label>
              <Input
                value={draft.title}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    title: event.target.value,
                    slug: prev.slug || buildNewsletterSlug(event.target.value),
                  }))
                }
                placeholder="Ex: Planejamento tributario para 2026"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={draft.slug}
                onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="planejamento-tributario-2026"
              />
              <p className="text-xs text-muted-foreground">URL publica: /newsletter/{buildNewsletterSlug(draft.slug || draft.title)}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Resumo</Label>
              <Textarea
                rows={3}
                value={draft.excerpt}
                onChange={(event) => setDraft((prev) => ({ ...prev, excerpt: event.target.value }))}
                placeholder="Resumo curto para aparecer na listagem."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Conteudo</Label>
              <Textarea
                rows={12}
                value={draft.content}
                onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Escreva aqui o conteudo completo da newsletter."
              />
            </div>

            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(event) => setDraft((prev) => ({ ...prev, is_published: event.target.checked }))}
              />
              Publicar agora e disponibilizar no site
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditorOpen(false);
                setEditingNewsletterId(null);
                setDraft(createEmptyDraft());
              }}
            >
              Cancelar
            </Button>
            <Button onClick={saveNewsletter} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar newsletter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
