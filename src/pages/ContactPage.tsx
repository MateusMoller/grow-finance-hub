import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function ContactPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Mensagem enviada com sucesso! Entraremos em contato em breve.");
    }, 1000);
  };

  return (
    <SiteLayout>
      <section className="py-24 bg-background">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16">
            <motion.div {...fadeIn}>
              <span className="text-xs font-semibold tracking-widest uppercase text-primary">Contato</span>
              <h1 className="font-heading text-4xl md:text-5xl font-bold mt-3 mb-6">
                Vamos <span className="text-primary">conversar?</span>
              </h1>
              <p className="text-muted-foreground leading-relaxed mb-10">
                Preencha o formulário ou entre em contato diretamente. Nossa equipe responde em até 24 horas úteis.
              </p>

              <div className="space-y-6">
                {[
                  { icon: Mail, label: "E-mail", value: "contato@growfinance.com.br" },
                  { icon: Phone, label: "Telefone", value: "(11) 99999-9999" },
                  { icon: MapPin, label: "Endereço", value: "São Paulo, SP" },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <c.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">{c.label}</div>
                      <div className="text-sm font-medium">{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
              <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Nome</label>
                    <Input placeholder="Seu nome" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Empresa</label>
                    <Input placeholder="Nome da empresa" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">E-mail</label>
                  <Input type="email" placeholder="seu@email.com" required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Telefone</label>
                  <Input placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Mensagem</label>
                  <Textarea placeholder="Como podemos ajudar?" rows={4} required />
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
