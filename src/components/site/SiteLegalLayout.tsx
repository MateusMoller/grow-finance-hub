import { ReactNode } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { motion } from "framer-motion";

interface LegalSection {
  title: string;
  paragraphs: string[];
}

interface SiteLegalLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
  asideTitle: string;
  asideText: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

const renderParagraphs = (paragraphs: string[]) =>
  paragraphs.map((paragraph) => (
    <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
      {paragraph}
    </p>
  ));

export function SiteLegalLayout({
  eyebrow,
  title,
  description,
  updatedAt,
  sections,
  asideTitle,
  asideText,
}: SiteLegalLayoutProps) {
  return (
    <SiteLayout>
      <section className="bg-[#f3f3f6] py-12 sm:py-16 md:py-20 dark:bg-[#051334]">
        <div className="container max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            <motion.aside {...fadeIn} className="space-y-6 lg:sticky lg:top-28 lg:self-start">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
                <h1 className="font-heading text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{title}</h1>
                <p className="max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
              </div>

              <div className="rounded-[28px] border border-primary/15 bg-card/90 p-5 shadow-sm dark:border-[#243054] dark:bg-[#0a1734]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">Ultima atualizacao</p>
                <p className="mt-3 text-sm font-medium text-foreground">{updatedAt}</p>
                <div className="mt-5 h-px w-full bg-gradient-to-r from-primary/20 via-primary/8 to-transparent" />
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">{asideTitle}</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{asideText}</p>
              </div>
            </motion.aside>

            <div className="space-y-4">
              {sections.map((section, index) => (
                <motion.article
                  key={section.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.45, delay: index * 0.04 }}
                  className="rounded-[28px] border border-border bg-card p-5 shadow-sm dark:border-[#243054] dark:bg-[#0a1734] sm:p-6"
                >
                  <h2 className="font-heading text-xl font-semibold tracking-[-0.03em] sm:text-2xl">{section.title}</h2>
                  <div className="mt-4 space-y-4">{renderParagraphs(section.paragraphs)}</div>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
