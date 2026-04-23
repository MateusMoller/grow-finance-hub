import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { captureSiteLead, sendSiteContactEmail } from "@/lib/siteLeadCapture";
import growMonogramVertical from "@/assets/brand/grow-monogram-vertical.png";

const contactItems = [
  { icon: Mail, label: "E-mail", value: "contato@contabilidadegrow.com.br", href: "mailto:contato@contabilidadegrow.com.br" },
  { icon: Phone, label: "Telefone", value: "(51) 99532-5592", href: "tel:+5551995325592" },
  { icon: MapPin, label: "Endereco", value: "Rua Julio de Castilhos, 2579 - Sl 212 - Centro, Taquara - RS" },
];

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [contactForm, setContactForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = contactForm.fullName.trim();
    const email = contactForm.email.trim();
    const message = contactForm.message.trim();

    if (!fullName || !email || !message) {
      toast.error("Preencha nome, e-mail e mensagem para continuar.");
      return;
    }

    const payload = {
      fullName,
      companyName: contactForm.companyName.trim(),
      email,
      phone: contactForm.phone.trim(),
      message,
      originPage: "contact",
    };

    setLoading(true);

    try {
      const { error } = await captureSiteLead(payload);

      if (error) {
        toast.error(`Nao foi possivel enviar a mensagem: ${error.message}`);
        return;
      }

      const { error: emailError } = await sendSiteContactEmail(payload);

      if (emailError) {
        toast.warning("Recebemos sua mensagem, mas o aviso por e-mail falhou. Nossa equipe vai revisar no CRM.");
      }

      setContactForm({
        fullName: "",
        companyName: "",
        email: "",
        phone: "",
        message: "",
      });
      toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <div className="institutional-page text-foreground">
        <section className="container py-10 sm:py-14 md:py-16">
          <div className="institutional-hero relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr] lg:p-9">
            <img
              src={growMonogramVertical}
              alt=""
              aria-hidden="true"
              width={420}
              height={620}
              className="brand-watermark -left-24 bottom-0 hidden h-[30rem] w-auto lg:block"
            />
            <motion.div {...fadeIn} className="relative z-10">
              <span className="institutional-kicker">Contato</span>
              <h1 className="mt-4 font-heading text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
                Vamos entender o momento da sua empresa e definir o proximo passo.
              </h1>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Preencha o formulario ou fale diretamente com a Grow. Nossa equipe retorna em ate 24 horas uteis com uma
                orientacao inicial.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2 md:hidden">
                <Button asChild variant="outline" className="h-10 rounded-full">
                  <a href="tel:+5551995325592">Ligar agora</a>
                </Button>
                <Button asChild className="h-10 rounded-full">
                  <a href="mailto:contato@contabilidadegrow.com.br">Enviar e-mail</a>
                </Button>
              </div>

              <div className="mt-8 space-y-4">
                {contactItems.map((item) => (
                  <div key={item.label} className="institutional-card-muted flex items-start gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</div>
                      {item.href ? (
                        <a className="text-sm font-medium text-foreground hover:underline" href={item.href}>
                          {item.value}
                        </a>
                      ) : (
                        <div className="text-sm font-medium">{item.value}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeIn} transition={{ duration: 0.45, delay: 0.1 }} className="relative z-10">
              <form onSubmit={handleSubmit} className="institutional-card space-y-5 p-5 sm:p-8">
                <div>
                  <span className="institutional-kicker">Avaliacao inicial</span>
                  <h2 className="mt-4 font-heading text-2xl font-semibold">Fale com um especialista</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Envie sua necessidade e direcionamos para o time certo.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-full-name" className="mb-1.5 block text-sm font-medium">Nome</label>
                    <Input
                      id="contact-full-name"
                      name="full_name"
                      autoComplete="name"
                      placeholder="Seu nome"
                      required
                      className="h-11 rounded-full"
                      value={contactForm.fullName}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-company-name" className="mb-1.5 block text-sm font-medium">Empresa</label>
                    <Input
                      id="contact-company-name"
                      name="company_name"
                      autoComplete="organization"
                      placeholder="Nome da empresa"
                      className="h-11 rounded-full"
                      value={contactForm.companyName}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium">E-mail</label>
                    <Input
                      id="contact-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      spellCheck={false}
                      placeholder="voce@empresa.com.br"
                      required
                      className="h-11 rounded-full"
                      value={contactForm.email}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-medium">Telefone</label>
                    <Input
                      id="contact-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="(51) 99999-9999"
                      className="h-11 rounded-full"
                      value={contactForm.phone}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium">Mensagem</label>
                  <Textarea
                    id="contact-message"
                    name="message"
                    placeholder="Conte rapidamente o que sua empresa precisa"
                    rows={5}
                    required
                    value={contactForm.message}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, message: event.target.value }))}
                  />
                </div>

                <Button variant="hero" size="lg" className="w-full rounded-full" type="submit" disabled={loading}>
                  {loading ? "Enviando…" : "Enviar mensagem"}
                  {!loading && <Send className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </form>
            </motion.div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
