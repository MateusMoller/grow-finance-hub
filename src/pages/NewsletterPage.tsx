import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { CalendarDays, Loader2, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import growMonogramVertical from "@/assets/brand/grow-monogram-vertical.png";

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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const formatDate = (value: string | null) => {
  if (!value) return "Sem data";
  return dateFormatter.format(new Date(value));
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
      <div className="institutional-page text-foreground">
        <section className="container max-w-6xl space-y-6 py-10 sm:space-y-8 sm:py-14 md:py-16">
          <div className="institutional-hero relative overflow-hidden p-5 sm:p-7 md:p-9">
            <img
              src={growMonogramVertical}
              alt=""
              aria-hidden="true"
              width={420}
              height={620}
              className="brand-watermark -right-20 -top-28 hidden h-[32rem] w-auto lg:block"
            />
            <div className="relative z-10 max-w-3xl space-y-3">
              <span className="institutional-kicker">Conteudo Grow</span>
              <h1 className="font-heading text-3xl font-bold sm:text-4xl md:text-5xl">Newsletter Grow</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Insights de gestao, contabilidade e estrategia para empresas que querem crescer com mais controle.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="institutional-card flex items-center justify-center gap-3 py-20" aria-live="polite">
              <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">Carregando newsletters…</span>
            </div>
          ) : newsletters.length === 0 ? (
            <div className="institutional-card p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Newspaper className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="mt-4 font-medium">Ainda nao temos newsletters publicadas.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Assim que uma nova edicao for publicada, ela aparecera aqui com leitura completa.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
              <aside className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:block lg:space-y-3">
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
                      className={`min-w-[84%] snap-start rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-w-0 ${
                        isActive
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "bg-card/86 hover:border-primary/40 hover:bg-card"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {item.excerpt || "Clique para ler esta edicao da newsletter."}
                      </p>
                      <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDate(item.published_at || item.created_at)}
                      </p>
                    </motion.button>
                  );
                })}
              </aside>

              <article className="institutional-card p-4 sm:p-6 md:p-8">
                {activeNewsletter && (
                  <>
                    <div className="mb-5 border-b pb-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Edicao selecionada</p>
                      <h2 className="mt-2 font-heading text-2xl font-semibold">{activeNewsletter.title}</h2>
                      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        Publicado em {formatDate(activeNewsletter.published_at || activeNewsletter.created_at)}
                      </p>
                      {activeNewsletter.excerpt && (
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{activeNewsletter.excerpt}</p>
                      )}
                    </div>

                    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
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

          <div className="institutional-card-muted p-5 text-center">
            <p className="text-sm text-muted-foreground">
              Quer receber as proximas edicoes por e-mail? Use o campo "Assine nossa newsletter" no rodape.
            </p>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
