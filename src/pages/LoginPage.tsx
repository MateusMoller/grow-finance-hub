import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import growIcon from "@/assets/grow-icon.png";
import financeHeroImage from "@/assets/login-finance-hero.svg";

type AccessProfile = "internal" | "client";

const accessOptions: Array<{
  key: AccessProfile;
  title: string;
  subtitle: string;
  icon: typeof BriefcaseBusiness;
  target: string;
}> = [
  {
    key: "internal",
    title: "App Interno",
    subtitle: "Operacao, tarefas, clientes e gestao da equipe.",
    icon: BriefcaseBusiness,
    target: "/app",
  },
  {
    key: "client",
    title: "Portal do Cliente",
    subtitle: "Solicitacoes, documentos, formularios e atendimento.",
    icon: Building2,
    target: "/portal",
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
    const { error } = await signIn(email, password);
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
            <p className="text-sm text-muted-foreground">
              O mesmo login pode entrar no App Interno e no Portal do Cliente.
            </p>
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
                    className={`rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
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

          <p className="text-xs text-muted-foreground">
            Se precisar alternar, basta sair e entrar novamente escolhendo o outro ambiente.
          </p>

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
        <img
          src={financeHeroImage}
          alt="Ilustracao de analise financeira em escritorio"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-slate-900/45 via-slate-900/20 to-transparent" />
      </div>
    </div>
  );
}
