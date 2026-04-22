import { supabase } from "@/integrations/supabase/client";

export const SITE_LEAD_TAG = "captação via site";

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const isSiteLeadSource = (value: string | null | undefined) => {
  const normalized = normalizeText(value || "");
  return normalized.includes("captação via site");
};

interface CaptureSiteLeadInput {
  fullName: string;
  companyName?: string;
  email: string;
  phone?: string;
  message?: string;
  originPage: string;
}

export const captureSiteLead = async (payload: CaptureSiteLeadInput) => {
  const { fullName, companyName, email, phone, message, originPage } = payload;

  return supabase.from("site_leads").insert({
    full_name: fullName,
    company_name: companyName?.trim() || null,
    email,
    phone: phone?.trim() || null,
    message: message?.trim() || null,
    source_tag: SITE_LEAD_TAG,
    origin_page: originPage,
  });
};

interface SendSiteContactEmailInput {
  fullName: string;
  companyName?: string;
  email: string;
  phone?: string;
  message: string;
  originPage?: string;
}

export const sendSiteContactEmail = async (payload: SendSiteContactEmailInput) => {
  return supabase.functions.invoke("send-site-contact-email", {
    body: {
      fullName: payload.fullName.trim(),
      companyName: payload.companyName?.trim() || null,
      email: payload.email.trim(),
      phone: payload.phone?.trim() || null,
      message: payload.message.trim(),
      originPage: payload.originPage?.trim() || "contact",
    },
  });
};
