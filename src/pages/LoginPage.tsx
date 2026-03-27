import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import growIcon from "@/assets/grow-icon.png";

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
    <div className="min-h-screen flex bg-muted/20">
      <div className="hidden lg:flex w-1/2 bg-hero items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(160_84%_22%/0.22),transparent_70%)]" />
        <div className="relative text-center space-y-6 px-12">
          <div className="h-16 w-16 rounded-2xl overflow-hidden mx-auto border border-white/20">
            <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
          </div>
          <h1 className="font-heading text-4xl font-bold text-primary-foreground">Grow Finance</h1>
          <p className="text-lg max-w-md" style={{ color: "hsl(150, 10%, 65%)" }}>
            Escolha como deseja entrar e troque de ambiente quando quiser.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="lg:hidden flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden">
              <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
            </div>
            <span className="font-heading font-bold text-lg">Grow Finance</span>
          </div>

          <div>
            <h2 className="font-heading text-2xl font-bold">Entrar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              O mesmo login pode entrar no App Interno e no Portal do Cliente.
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              Selecione o ambiente de entrada
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {accessOptions.map((option) => {
                const isActive = accessProfile === option.key;
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setAccessProfile(option.key)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </span>
                      {isActive && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                    </div>
                    <p className="text-sm font-semibold mt-2">{option.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{option.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-4 space-y-4">
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

          <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            Se precisar alternar, basta sair e entrar novamente escolhendo o outro ambiente.
          </div>

          <div className="text-sm text-center space-y-2">
            <p className="text-muted-foreground">
              <Link to="/" className="text-primary hover:underline">
                Voltar ao site
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
