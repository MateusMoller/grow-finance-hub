import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureSiteLead } from "@/lib/siteLeadCapture";

interface SiteLeadFormProps {
  className?: string;
  formId: string;
  intro?: ReactNode;
  originPage: string;
  submitLabel: string;
  successMessage: string;
}

interface SiteLeadFormState {
  fullName: string;
  companyName: string;
  email: string;
}

const initialLeadForm: SiteLeadFormState = {
  fullName: "",
  companyName: "",
  email: "",
};

export function SiteLeadForm({
  className,
  formId,
  intro,
  originPage,
  submitLabel,
  successMessage,
}: SiteLeadFormProps) {
  const [sending, setSending] = useState(false);
  const [leadForm, setLeadForm] = useState<SiteLeadFormState>(initialLeadForm);

  const updateField =
    (field: keyof SiteLeadFormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLeadForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fullName = leadForm.fullName.trim();
    const email = leadForm.email.trim();

    if (!fullName || !email) {
      toast.error("Preencha nome e e-mail para continuar.");
      return;
    }

    setSending(true);

    const { error } = await captureSiteLead({
      fullName,
      companyName: leadForm.companyName.trim(),
      email,
      originPage,
    });

    setSending(false);

    if (error) {
      toast.error(`Nao foi possivel enviar sua solicitacao: ${error.message}`);
      return;
    }

    setLeadForm(initialLeadForm);
    toast.success(successMessage);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {intro}

      <div>
        <label htmlFor={`${formId}-name`} className="mb-1.5 block text-sm font-medium">
          Nome completo
        </label>
        <Input
          id={`${formId}-name`}
          name="full_name"
          autoComplete="name"
          placeholder="Seu nome completo"
          required
          value={leadForm.fullName}
          onChange={updateField("fullName")}
          className="rounded-full"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-company`} className="mb-1.5 block text-sm font-medium">
          Empresa
        </label>
        <Input
          id={`${formId}-company`}
          name="company_name"
          autoComplete="organization"
          placeholder="Nome da empresa"
          value={leadForm.companyName}
          onChange={updateField("companyName")}
          className="rounded-full"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-email`} className="mb-1.5 block text-sm font-medium">
          E-mail
        </label>
        <Input
          id={`${formId}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="voce@empresa.com.br"
          required
          value={leadForm.email}
          onChange={updateField("email")}
          className="rounded-full"
        />
      </div>

      <Button type="submit" className="w-full rounded-full" disabled={sending}>
        {sending ? "Enviando..." : submitLabel}
        {!sending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </Button>
    </form>
  );
}
