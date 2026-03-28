import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Loader2, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

type NewsletterRow = Tables<"newsletters">;

interface PublishedNewsletter {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  published_at: string | null;
  created_at: string;
}

const formatDate = (value: string | null) => {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const parseNewsletter = (row: NewsletterRow): PublishedNewsletter => ({
  id: row.id,
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt,
  content: row.content,
  published_at: row.published_at,
  created_at: row.created_at,
});

export default function NewsletterPage() {
  const [loading, setLoading] = useState(true);
  const [newsletters, setNewsletters] = useState<PublishedNewsletter[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    const loadNewsletters = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("newsletters")
        .select("id, title, slug, excerpt, content, published_at, created_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .order("created_at", { ascending: false });

      setLoading(false);

      if (error) {
        toast.error(`Nao foi possivel carregar a newsletter: ${error.message}`);
        return;
      }

      const parsed = (data || []).map((item) => parseNewsletter(item as NewsletterRow));
      setNewsletters(parsed);
      setActiveSlug((current) => current || parsed[0]?.slug || null);
    };

    void loadNewsletters();
  }, []);

  const activeNewsletter = useMemo(
    () => newsletters.find((item) => item.slug === activeSlug) || newsletters[0] || null,
    [activeSlug, newsletters],
  );

  return (
    <SiteLayout>
      <section className="bg-[#f3f3f6] py-12 sm:py-16 dark:bg-[#051334]">
        <div className="container max-w-6xl space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Conteudo Grow</p>
            <h1 className="font-heading text-2xl font-bold sm:text-3xl md:text-4xl">Newsletter Grow</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Insights de gestao, contabilidade e estrategias para acelerar o crescimento da sua empresa.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border bg-card py-20">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : newsletters.length === 0 ? (
            <div className="rounded-2xl border bg-card p-10 text-center">
              <p className="font-medium">Ainda nao temos newsletters publicadas.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Assim que uma nova edicao for publicada, ela aparecera aqui.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              <aside className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none sm:grid-cols-2 lg:block lg:space-y-3">
                {newsletters.map((item, index) => {
                  const isActive = activeNewsletter?.id === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => setActiveSlug(item.slug)}
                      className={`min-w-[84%] snap-start rounded-xl border p-3.5 text-left transition sm:min-w-0 sm:p-4 ${
                        isActive ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40"
                      }`}
                    >
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                        {item.excerpt || "Clique para ler esta edicao da newsletter."}
                      </p>
                      <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(item.published_at || item.created_at)}
                      </p>
                    </motion.button>
                  );
                })}
              </aside>

              <article className="rounded-2xl border bg-card p-4 sm:p-6 md:p-8">
                {activeNewsletter && (
                  <>
                    <div className="mb-5 border-b pb-4">
                      <h2 className="font-heading text-xl font-semibold sm:text-2xl">{activeNewsletter.title}</h2>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Publicado em {formatDate(activeNewsletter.published_at || activeNewsletter.created_at)}
                      </p>
                      {activeNewsletter.excerpt && (
                        <p className="mt-3 text-sm text-muted-foreground">{activeNewsletter.excerpt}</p>
                      )}
                    </div>

                    <div className="space-y-4 text-sm leading-relaxed">
                      {activeNewsletter.content
                        .split(/\n{2,}/)
                        .map((paragraph) => paragraph.trim())
                        .filter(Boolean)
                        .map((paragraph, index) => (
                          <p key={`${activeNewsletter.id}-${index}`}>{paragraph}</p>
                        ))}
                    </div>
                  </>
                )}
              </article>
            </div>
          )}

          <div className="rounded-xl border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Quer receber as proximas edicoes por e-mail? Use o campo "Assine nossa newsletter" no rodape.
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
