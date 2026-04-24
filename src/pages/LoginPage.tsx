import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { hasAnyInternalRole, hasPortalAccessRole, normalizeRoles } from "@/lib/accessControl";
import growIcon from "@/assets/grow-icon.png";
import { GrowHeroArtwork } from "@/components/site/GrowHeroArtwork";

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
    target: "/app/portal",
  },
];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessProfile, setAccessProfile] = useState<AccessProfile>("internal");
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();

  const selectedAccess = useMemo(
    () => accessOptions.find((option) => option.key === accessProfile) || accessOptions[0],
    [accessProfile],
  );

  const handleSubmit = async (event: React.FormEvent) => {
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

    const normalizedRoles = normalizeRoles((roleRows || []).map((row) => String(row.role || "")));
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
    <motion.div layout className="min-h-screen bg-background lg:flex">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 250, damping: 30, mass: 0.85 }}
        className="flex items-center justify-center px-6 py-10 sm:px-8 lg:min-h-screen lg:w-[46%] lg:px-12 xl:w-[44%]"
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-7">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 overflow-hidden rounded-lg">
              <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
            </div>
            <span className="font-heading text-lg font-bold">Grow Finance</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="font-heading text-2xl font-bold">Entrar</h2>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Ambiente de entrada</p>
            <div className="grid grid-cols-1 gap-2 rounded-xl bg-muted/50 p-1 sm:grid-cols-2">
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
              <label className="mb-1.5 block text-sm font-medium">E-mail</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Senha</label>
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

          <div className="space-y-2 text-center text-sm">
            <p className="text-muted-foreground">
              <Link to="/" className="text-primary hover:underline">
                Voltar ao site
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 250, damping: 30, mass: 0.85 }}
        className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#f3f3f6] px-8 py-8 dark:bg-[#051334] lg:flex lg:w-[54%] xl:w-[56%]"
      >
        <GrowHeroArtwork className="h-[min(720px,calc(100vh-4rem))] w-full max-w-[720px]" />
      </motion.div>
    </motion.div>
  );
}
