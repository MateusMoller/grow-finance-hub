import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { captureSiteLead } from "@/lib/siteLeadCapture";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fullName = contactForm.fullName.trim();
    const email = contactForm.email.trim();
    const message = contactForm.message.trim();

    if (!fullName || !email || !message) {
      toast.error("Preencha nome, e-mail e mensagem para continuar.");
      return;
    }

    setLoading(true);

    const { error } = await captureSiteLead({
      fullName,
      companyName: contactForm.companyName.trim(),
      email,
      phone: contactForm.phone.trim(),
      message,
      originPage: "contact",
    });

    setLoading(false);

    if (error) {
      toast.error(`Nao foi possivel enviar a mensagem: ${error.message}`);
      return;
    }

    setContactForm({
      fullName: "",
      companyName: "",
      email: "",
      phone: "",
      message: "",
    });
    toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
  };

  return (
    <SiteLayout>
      <section className="bg-background py-12 sm:py-16 md:py-20">
        <div className="container">
          <div className="grid gap-10 md:grid-cols-2 md:gap-14">
            <motion.div {...fadeIn}>
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">Contato</span>
              <h1 className="mt-3 mb-5 font-heading text-3xl font-bold sm:text-4xl md:mb-6 md:text-5xl">
                Vamos <span className="text-primary">conversar?</span>
              </h1>
              <p className="mb-8 leading-relaxed text-muted-foreground md:mb-10">
                Preencha o formulario ou entre em contato diretamente. Nossa equipe responde em ate 24 horas uteis.
              </p>

              <div className="mb-6 grid grid-cols-2 gap-2 md:hidden">
                <Button asChild variant="outline" className="h-10 rounded-full">
                  <a href="tel:+5551995325592">Ligar agora</a>
                </Button>
                <Button asChild className="h-10 rounded-full">
                  <a href="mailto:contato@contabilidadegrow.com.br">Enviar e-mail</a>
                </Button>
              </div>

              <div className="space-y-6">
                {[
                  { icon: Mail, label: "E-mail", value: "contato@contabilidadegrow.com.br" },
                  { icon: Phone, label: "Telefone", value: "(51) 99532-5592" },
                  { icon: MapPin, label: "Endereco", value: "Rua Julio de Castilhos, 2579 - Sl 205 - Centro, Taquara - RS" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-sm font-medium">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
              <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border bg-card p-5 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Nome</label>
                    <Input
                      placeholder="Seu nome"
                      required
                      className="h-11"
                      value={contactForm.fullName}
                      onChange={(event) =>
                        setContactForm((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Empresa</label>
                    <Input
                      placeholder="Nome da empresa"
                      className="h-11"
                      value={contactForm.companyName}
                      onChange={(event) =>
                        setContactForm((prev) => ({ ...prev, companyName: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">E-mail</label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    required
                    className="h-11"
                    value={contactForm.email}
                    onChange={(event) =>
                      setContactForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Telefone</label>
                  <Input
                    placeholder="(11) 99999-9999"
                    className="h-11"
                    value={contactForm.phone}
                    onChange={(event) =>
                      setContactForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Mensagem</label>
                  <Textarea
                    placeholder="Como podemos ajudar?"
                    rows={4}
                    required
                    value={contactForm.message}
                    onChange={(event) =>
                      setContactForm((prev) => ({ ...prev, message: event.target.value }))
                    }
                  />
                </div>

                <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
                  {loading ? "Enviando..." : (
                    <>Enviar Mensagem <Send className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
