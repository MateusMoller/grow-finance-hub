import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  Settings,
  User,
  Shield,
  Bell,
  Palette,
  Building2,
  Key,
  Globe,
  Mail,
  Database,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";

const settingSections = [
  { id: "profile", title: "Perfil", description: "Informações pessoais e avatar", icon: User },
  { id: "company", title: "Empresa", description: "Dados da organização Grow", icon: Building2 },
  { id: "security", title: "Segurança", description: "Senha, autenticação e sessões", icon: Shield },
  { id: "notifications", title: "Notificações", description: "Preferências de alertas e e-mails", icon: Bell },
  { id: "appearance", title: "Aparência", description: "Tema, idioma e personalização", icon: Palette },
  { id: "integrations", title: "Integrações", description: "Conexões com serviços externos", icon: Globe },
];

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-heading text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências do sistema</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Navigation */}
          <div className="space-y-1">
            {settingSections.map((section, i) => (
              <motion.button
                key={section.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted/80 ${i === 0 ? "bg-muted" : ""}`}
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{section.title}</div>
                  <div className="text-xs text-muted-foreground">{section.description}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </motion.button>
            ))}
          </div>

          {/* Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile section */}
            <div className="rounded-xl border bg-card p-6">
              <h2 className="font-heading font-semibold mb-4">Perfil</h2>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div>
                  <div className="font-medium">{user?.email || "Usuário"}</div>
                  <div className="text-sm text-muted-foreground">Administrador</div>
                  <Button variant="outline" size="sm" className="mt-2 text-xs">Alterar foto</Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Nome completo</Label>
                  <Input placeholder="Seu nome" defaultValue="" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">E-mail</Label>
                  <Input value={user?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Telefone</Label>
                  <Input placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Cargo</Label>
                  <Input placeholder="Seu cargo" />
                </div>
              </div>
              <Button className="mt-4">Salvar alterações</Button>
            </div>

            {/* Notifications */}
            <div className="rounded-xl border bg-card p-6">
              <h2 className="font-heading font-semibold mb-4">Notificações</h2>
              <div className="space-y-4">
                {[
                  { label: "Novas tarefas atribuídas", desc: "Receber alerta quando uma tarefa for atribuída a você" },
                  { label: "Prazo próximo", desc: "Alertar 3 dias antes do vencimento" },
                  { label: "Novos formulários", desc: "Quando um cliente enviar um formulário" },
                  { label: "Novos leads", desc: "Quando um novo lead for capturado pelo site" },
                  { label: "E-mails de resumo", desc: "Receber resumo diário por e-mail" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </div>

            {/* Security */}
            <div className="rounded-xl border bg-card p-6">
              <h2 className="font-heading font-semibold mb-4">Segurança</h2>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Senha atual</Label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Nova senha</Label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                </div>
                <Button variant="outline">Alterar senha</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
