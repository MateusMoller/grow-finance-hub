import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2, CheckCircle2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyInternalRole, hasPortalAccessRole, normalizeRoles } from "@/lib/accessControl";
import growLockupHorizontalDark from "@/assets/brand/grow-lockup-horizontal-dark.png";
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

const trustNotes = ["Acesso segregado por ambiente", "Permissoes validadas apos login", "Portal e operacao no mesmo ecossistema"];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessProfile, setAccessProfile] = useState<AccessProfile>("internal");
  const [direction, setDirection] = useState(1);
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();

  const selectedAccess = useMemo(
    () => accessOptions.find((option) => option.key === accessProfile) || accessOptions[0],
    [accessProfile],
  );

  const handleAccessChange = (nextProfile: AccessProfile) => {
    if (nextProfile === accessProfile) return;

    const currentIndex = accessOptions.findIndex((option) => option.key === accessProfile);
    const nextIndex = accessOptions.findIndex((option) => option.key === nextProfile);

    setDirection(nextIndex > currentIndex ? 1 : -1);
    setAccessProfile(nextProfile);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await signIn(normalizedEmail, password);

    if (error) {
      setLoading(false);
      toast.error("E-mail ou senha invalidos.");
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      await signOut();
      setLoading(false);
      toast.error("Nao foi possivel validar o acesso apos o login.");
      return;
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    setLoading(false);
    if (roleError) {
      await signOut();
      toast.error("Nao foi possivel validar suas permissoes de acesso.");
      return;
    }

    const normalizedRoles = normalizeRoles(
      (roleRows || []).map((row) => String(row.role || "")),
    );
    const hasInternalAccess = hasAnyInternalRole(normalizedRoles);
    const hasPortalAccess = hasPortalAccessRole(normalizedRoles);

    if (selectedAccess.key === "internal" && !hasInternalAccess) {
      if (!hasPortalAccess) {
        await signOut();
      }
      toast.error("Este usuario nao tem permissao para acessar o App Interno.");
      navigate(hasPortalAccess ? "/app/portal" : "/app/login", { replace: true });
      return;
    }

    if (selectedAccess.key === "client" && !hasPortalAccess) {
      await signOut();
      toast.error("Este usuario nao possui permissao para acessar o Portal do Cliente.");
      return;
    }

    toast.success(`Login realizado. Entrando em ${selectedAccess.title}.`);
    navigate(selectedAccess.target);
  };

  return (
    <motion.div layout className="institutional-page min-h-screen bg-background lg:flex">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 250, damping: 30, mass: 0.85 }}
        className={`flex items-center justify-center px-5 py-8 sm:px-8 lg:min-h-screen lg:w-[46%] lg:px-12 xl:w-[44%] ${
          selectedAccess.key === "client" ? "lg:order-2" : "lg:order-1"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="institutional-card w-full max-w-md space-y-7 p-6 sm:p-8"
        >
          <Link
            to="/"
            className="block w-fit rounded-[1.25rem] border border-[#50516f]/10 bg-[#50516f] p-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <img
              src={growLockupHorizontalDark}
              alt="Grow Contabilidade"
              width={196}
              height={62}
              className="h-11 w-auto rounded-[0.9rem] object-cover"
            />
          </Link>

          <div className="space-y-2">
            <span className="institutional-kicker">Entrada segura</span>
            <h1 className="font-heading text-2xl font-bold">Acesse seu ambiente Grow</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Selecione o destino correto para manter a segregacao entre operacao interna e experiencia do cliente.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Ambiente de entrada
            </p>
            <div className="grid grid-cols-1 gap-2 rounded-2xl border border-border/70 bg-muted/35 p-1.5 sm:grid-cols-2">
              {accessOptions.map((option) => {
                const isActive = accessProfile === option.key;
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleAccessChange(option.key)}
                    className={`relative overflow-hidden rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="access-mode-highlight"
                        className="absolute inset-0 rounded-xl bg-background shadow-sm ring-1 ring-border"
                        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
                      />
                    )}
                    <div className="relative flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
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
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">E-mail</label>
              <Input
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="voce@empresa.com.br"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium">Senha</label>
              <Input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button variant="hero" size="lg" className="w-full gap-2 rounded-full" type="submit" disabled={loading}>
              {loading ? "Entrando…" : `Entrar em ${selectedAccess.title}`}
              {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </form>

          <div className="text-center text-sm">
            <Link to="/" className="text-primary underline-offset-4 hover:underline">
              Voltar ao site institucional
            </Link>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 250, damping: 30, mass: 0.85 }}
        className={`relative hidden min-h-screen overflow-hidden bg-slate-900 lg:block lg:w-[54%] xl:w-[56%] ${
          selectedAccess.key === "client" ? "lg:order-1" : "lg:order-2"
        }`}
      >
        <AnimatePresence mode="sync" initial={false} custom={direction}>
          <motion.img
            custom={direction}
            key={selectedAccess.key}
            src={selectedAccess.heroImage}
            alt={selectedAccess.heroAlt}
            width={1180}
            height={960}
            className="absolute inset-0 h-full w-full object-cover"
            initial={(dir: number) => ({
              x: dir > 0 ? -120 : 120,
            })}
            animate={{ x: 0 }}
            exit={(dir: number) => ({
              x: dir > 0 ? 120 : -120,
            })}
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
                ? "linear-gradient(270deg, rgba(10,22,47,0.72) 0%, rgba(12,24,50,0.32) 44%, rgba(16,26,51,0.72) 100%)"
                : "linear-gradient(270deg, rgba(13,20,42,0.7) 0%, rgba(16,28,56,0.28) 46%, rgba(13,20,42,0.74) 100%)",
          }}
        />

        <div className="absolute inset-x-8 top-8 z-10 flex items-center justify-between gap-4">
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
          <Link to="/" className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/20">
            Site institucional
          </Link>
        </div>

        <div className="absolute bottom-8 left-8 right-8 z-10 max-w-xl rounded-[1.75rem] border border-white/14 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/64">Acesso com contexto</p>
          <h2 className="mt-3 font-heading text-3xl font-semibold">{selectedAccess.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/72">{selectedAccess.subtitle}</p>
          <div className="mt-5 grid gap-2">
            {trustNotes.map((note) => (
              <p key={note} className="flex items-center gap-2 text-sm text-white/86">
                <CheckCircle2 className="h-4 w-4 text-grow-gold" aria-hidden="true" />
                {note}
              </p>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
