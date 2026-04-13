import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import growIcon from "@/assets/grow-icon.png";
import financeHeroImage from "@/assets/login-finance-hero.svg";
import portalHeroImage from "@/assets/login-portal-hero.svg";

type AccessProfile = "internal" | "client";

const accessOptions: Array<{
  key: AccessProfile;
  title: string;
  subtitle: string;
  icon: typeof BriefcaseBusiness;
  target: string;
  heroImage: string;
  heroAlt: string;
  visualTag: string;
}> = [
  {
    key: "internal",
    title: "App Interno",
    subtitle: "Operacao, tarefas, clientes e gestao da equipe.",
    icon: BriefcaseBusiness,
    target: "/app",
    heroImage: financeHeroImage,
    heroAlt: "Painel do app interno com indicadores financeiros e operacionais",
    visualTag: "Operacao interna",
  },
  {
    key: "client",
    title: "Portal do Cliente",
    subtitle: "Solicitacoes, documentos, formularios e atendimento.",
    icon: Building2,
    target: "/app/portal",
    heroImage: portalHeroImage,
    heroAlt: "Painel do portal do cliente com documentos, checklist e atendimento",
    visualTag: "Experiencia do cliente",
  },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessProfile, setAccessProfile] = useState<AccessProfile>("internal");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const selectedAccess = useMemo(
    () => accessOptions.find((option) => option.key === accessProfile) || accessOptions[0],
    [accessProfile]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await signIn(normalizedEmail, password);
    setLoading(false);

    if (error) {
      toast.error("E-mail ou senha invalidos.");
      return;
    }

    toast.success(`Login realizado. Entrando em ${selectedAccess.title}.`);
    navigate(selectedAccess.target);
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(420px,560px)_1fr]">
      <div className="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-7"
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden">
              <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
            </div>
            <span className="font-heading font-bold text-lg">Grow Finance</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-bold">Entrar</h2>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.14em]">
              Ambiente de entrada
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
              {accessOptions.map((option) => {
                const isActive = accessProfile === option.key;
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAccessProfile(option.key)}
                    className={`relative overflow-hidden rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="access-mode-highlight"
                        className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border"
                        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
                      />
                    )}
                    <div className="relative flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-sm font-semibold">{option.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{selectedAccess.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Senha</label>
              <Input
                type="password"
                placeholder="********"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button variant="hero" size="lg" className="w-full gap-2" type="submit" disabled={loading}>
              {loading ? "Entrando..." : `Entrar em ${selectedAccess.title}`}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="text-sm text-center space-y-2">
            <p className="text-muted-foreground">
              <Link to="/" className="text-primary hover:underline">
                Voltar ao site
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      <div className="relative hidden min-h-screen overflow-hidden lg:block">
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={selectedAccess.key}
            src={selectedAccess.heroImage}
            alt={selectedAccess.heroAlt}
            className="absolute inset-0 h-full w-full object-cover"
            initial={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          />
        </AnimatePresence>

        <motion.div
          key={`veil-${selectedAccess.key}`}
          className="absolute inset-0"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          style={{
            background:
              selectedAccess.key === "client"
                ? "linear-gradient(270deg, rgba(10,22,47,0.52) 0%, rgba(12,24,50,0.26) 44%, rgba(16,26,51,0.54) 100%)"
                : "linear-gradient(270deg, rgba(13,20,42,0.5) 0%, rgba(16,28,56,0.2) 46%, rgba(13,20,42,0.56) 100%)",
          }}
        />

        <div className="absolute left-8 top-8 z-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`tag-${selectedAccess.key}`}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.36, ease: "easeOut" }}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white/90 backdrop-blur-sm"
            >
              {selectedAccess.visualTag}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
