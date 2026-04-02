import { MessageCircle } from "lucide-react";

const GROW_WHATSAPP_NUMBER = "5551995325592";
const DEFAULT_MESSAGE = encodeURIComponent(
  "Ola! Vim pelo site da Grow e gostaria de falar com um especialista.",
);

const WHATSAPP_URL = `https://wa.me/${GROW_WHATSAPP_NUMBER}?text=${DEFAULT_MESSAGE}`;

export function SiteWhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Grow no WhatsApp"
      className="group fixed bottom-24 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-2.5 py-2 text-foreground shadow-[0_14px_30px_-20px_rgba(10,16,30,0.7)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-18px_rgba(10,16,30,0.72)] sm:bottom-24 sm:right-6 md:bottom-6"
      title="Falar com especialista"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#1C9B52]">
        <MessageCircle className="h-4.5 w-4.5" />
      </span>
      <span className="hidden pr-1 text-xs font-medium tracking-[0.01em] text-muted-foreground transition-colors group-hover:text-foreground sm:inline">
        WhatsApp Grow
      </span>
    </a>
  );
}
