import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { hasAnyInternalRole, hasClientRole, normalizeRoles } from "@/lib/accessControl";
import growIcon from "@/assets/grow-icon.png";
import { GrowHeroArtwork } from "@/components/site/GrowHeroArtwork";

const resolveAccessTarget = (roles: string[]) => {
  const normalizedRoles = normalizeRoles(roles);

  if (hasAnyInternalRole(normalizedRoles)) {
    return { path: "/app", label: "App Interno" as const };
  }

  if (hasClientRole(normalizedRoles)) {
    return { path: "/app/portal", label: "Portal do Cliente" as const };
  }

  return null;
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, signOut, user, roles, roleLoaded, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !user || !roleLoaded) return;

    const target = resolveAccessTarget(roles);
    if (target) {
      navigate(target.path, { replace: true });
    }
  }, [authLoading, navigate, roleLoaded, roles, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await signIn(normalizedEmail, password);

    if (error) {
      setLoading(false);
      if (error.message.includes("Configuracao do Supabase ausente")) {
        toast.error("Integracao de autenticacao indisponivel. Verifique a configuracao do ambiente.");
      } else {
        toast.error("E-mail ou senha invalidos.");
      }
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      await signOut();
      setLoading(false);
      toast.error("Não foi possível validar o acesso após o login.");
      return;
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    setLoading(false);

    if (roleError) {
      await signOut();
      toast.error("Não foi possível validar suas permissões de acesso.");
      return;
    }

    const target = resolveAccessTarget((roleRows || []).map((row) => String(row.role || "")));

    if (!target) {
      await signOut();
      toast.error("Este usuário não possui permissão para acessar o sistema.");
      return;
    }

    toast.success(`Login realizado. Entrando em ${target.label}.`);
    navigate(target.path, { replace: true });
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

          <div className="space-y-2">
            <h2 className="font-heading text-2xl font-bold">Entrar</h2>
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
            <Button variant="hero" size="lg" className="w-full gap-2" type="submit" disabled={loading || !isSupabaseConfigured}>
              {loading ? "Entrando..." : (!isSupabaseConfigured ? "Configuracao pendente" : "Entrar")}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {!isSupabaseConfigured && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Autenticacao indisponivel: configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no ambiente.
            </p>
          )}

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
