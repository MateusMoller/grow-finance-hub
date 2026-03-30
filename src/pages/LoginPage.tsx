import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2, LockKeyhole, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import growIcon from "@/assets/grow-icon.png";
import growBgDark from "@/assets/grow-bg-dark.png";

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

  const handlePasswordHelp = () => {
    toast.info("Se precisar recuperar o acesso, fale com a equipe responsavel pela conta.");
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#040404] text-white">
      <div className="relative min-h-screen lg:grid lg:grid-cols-[minmax(440px,1fr)_1.1fr]">
        <div className="relative flex min-h-screen items-center px-6 py-10 sm:px-10 lg:px-14 xl:px-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(173,90,255,0.15),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,153,102,0.1),transparent_30%)]" />
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative z-10 w-full max-w-[360px] space-y-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_30px_rgba(168,85,247,0.18)]">
                <img src={growIcon} alt="Grow" className="h-7 w-7 object-contain" />
              </div>
              <div>
                <p className="font-heading text-sm font-semibold uppercase tracking-[0.28em] text-white/45">Grow Finance</p>
                <p className="text-xs text-white/35">Acesso interno e portal</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {accessOptions.map((option) => {
                  const isActive = accessProfile === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAccessProfile(option.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        isActive
                          ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-white shadow-[0_0_24px_rgba(217,70,239,0.18)]"
                          : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white/85"
                      }`}
                    >
                      {option.title}
                    </button>
                  );
                })}
              </div>

              <div>
                <h1 className="font-heading text-4xl font-bold leading-tight text-white sm:text-[2.8rem]">
                  Faca seu login<span className="text-[#ff8f7a]">.</span>
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">
                  Entre em {selectedAccess.title} com o mesmo acesso da sua conta Grow.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-lg border-fuchsia-500/60 bg-transparent text-white placeholder:text-white/20 focus-visible:ring-fuchsia-400/60 focus-visible:ring-offset-[#040404]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={handlePasswordHelp}
                    className="text-[11px] text-white/35 underline-offset-4 transition hover:text-white/70 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <Input
                  type="password"
                  placeholder="********"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-lg border-[#ffb56b]/70 bg-transparent text-white placeholder:text-white/20 focus-visible:ring-[#ffb56b]/70 focus-visible:ring-offset-[#040404]"
                />
              </div>

              <Button
                size="lg"
                className="h-11 w-full rounded-lg border-0 bg-[linear-gradient(90deg,#735dff_0%,#d95fee_52%,#ffb36b_100%)] font-semibold text-white shadow-[0_12px_30px_rgba(217,95,238,0.28)] transition-transform duration-200 hover:scale-[1.01] hover:opacity-95"
                type="submit"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>

            <div className="space-y-3 text-xs text-white/38">
              <p>Voce pode alternar entre os ambientes a qualquer momento ao sair e entrar novamente.</p>
              <Link to="/" className="inline-flex items-center gap-2 text-white/55 underline-offset-4 hover:text-white hover:underline">
                Voltar para o site
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="relative hidden min-h-screen lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,6,32,0.88),rgba(9,4,21,0.96))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_14%,rgba(194,76,255,0.38),transparent_18%),radial-gradient(circle_at_82%_88%,rgba(125,42,193,0.22),transparent_24%),radial-gradient(circle_at_20%_50%,rgba(83,47,160,0.18),transparent_30%)]" />
          <div className="absolute inset-0 opacity-55" style={{ backgroundImage: `url(${growBgDark})`, backgroundPosition: "center", backgroundSize: "cover" }} />
          <div className="absolute inset-0">
            <div className="absolute left-[14%] top-[12%] h-2 w-2 rounded-full bg-white/30 shadow-[0_0_14px_rgba(255,255,255,0.35)]" />
            <div className="absolute left-[26%] top-[22%] h-1 w-1 rounded-full bg-fuchsia-300/60" />
            <div className="absolute right-[18%] top-[18%] h-1.5 w-1.5 rounded-full bg-amber-200/60" />
            <div className="absolute right-[26%] top-[34%] h-1 w-1 rounded-full bg-white/25" />
            <div className="absolute bottom-[18%] left-[16%] h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
          </div>

          <div className="absolute inset-y-0 left-0 w-24 bg-[linear-gradient(90deg,#040404_0%,rgba(4,4,4,0.8)_38%,transparent_100%)]" />
          <div className="relative z-10 flex h-full items-end p-12 xl:p-16">
            <div className="max-w-md rounded-[28px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-fuchsia-200/70">Ambiente Grow</p>
              <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight text-white">
                Operacao, portal do cliente e rotina financeira no mesmo ecossistema.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                Um acesso para acompanhar tarefas, documentos e solicitacoes com a mesma identidade visual da plataforma.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
