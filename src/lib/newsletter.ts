import { supabase } from "@/integrations/supabase/client";

export const normalizeNewsletterEmail = (value: string) => value.trim().toLowerCase();

export const buildNewsletterSlug = (value: string) => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "newsletter";
};

interface SubscribeNewsletterInput {
  email: string;
  source?: string;
}

export const subscribeToNewsletter = async ({ email, source = "site_footer" }: SubscribeNewsletterInput) => {
  const normalizedEmail = normalizeNewsletterEmail(email);

  return supabase.from("newsletter_subscribers").insert(
    [
      {
        email: normalizedEmail,
        source,
        status: "active",
        subscribed_at: new Date().toISOString(),
        unsubscribed_at: null,
      },
    ],
    {
      onConflict: "email",
      ignoreDuplicates: true,
    },
  );
};

export const triggerNewsletterBroadcast = async (newsletterId: string) => {
  return supabase.functions.invoke("send-newsletter-broadcast", {
    body: { newsletter_id: newsletterId },
  });
};
