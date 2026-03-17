import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("E-mail ou senha inválidos.");
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/app");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - branding */}
      <div className="hidden lg:flex w-1/2 bg-hero items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(160_84%_22%/0.2),transparent_70%)]" />
        <div className="relative text-center space-y-6 px-12">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-heading font-bold text-2xl">G</span>
          </div>
          <h1 className="font-heading text-4xl font-bold text-primary-foreground">Grow Finance</h1>
          <p className="text-lg max-w-md" style={{ color: "hsl(150, 10%, 65%)" }}>
            Acesse sua conta e gerencie seu negócio com inteligência.
          </p>
        </div>
      </div>

      {/* Right - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="lg:hidden flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-heading font-bold text-sm">G</span>
            </div>
            <span className="font-heading font-bold text-lg">Grow Finance</span>
          </div>

          <div>
            <h2 className="font-heading text-2xl font-bold">Entrar</h2>
            <p className="text-sm text-muted-foreground mt-1">Acesse sua conta Grow Finance</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">E-mail</label>
              <Input type="email" placeholder="seu@email.com" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Senha</label>
              <Input type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button variant="hero" size="lg" className="w-full" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            <Link to="/" className="text-primary hover:underline">← Voltar ao site</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
