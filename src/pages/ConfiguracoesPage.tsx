import { useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  Bell,
  Building2,
  ChevronRight,
  Copy,
  Globe,
  Loader2,
  Palette,
  RefreshCcw,
  Shield,
  Upload,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import type { TablesInsert } from "@/integrations/supabase/types";

type SettingSectionId = "profile" | "company" | "security" | "notifications" | "appearance" | "integrations";
type ThemePreference = "light" | "dark" | "system";
type IntegrationTokenStatus = {
  enabled: boolean;
  token_configured: boolean;
  token_prefix: string | null;
  last_used_at: string | null;
  rotated_at: string | null;
  revealed_token?: string | null;
};

const settingSections: { id: SettingSectionId; title: string; description: string; icon: typeof User }[] = [
  { id: "profile", title: "Perfil", description: "Dados pessoais e avatar", icon: User },
  { id: "company", title: "Empresa", description: "Dados da organizacao", icon: Building2 },
  { id: "security", title: "Seguranca", description: "Senha e autenticacao", icon: Shield },
  { id: "notifications", title: "Notificacoes", description: "Alertas do sistema", icon: Bell },
  { id: "appearance", title: "Aparencia", description: "Tema e idioma", icon: Palette },
  { id: "integrations", title: "Integracoes", description: "Conexoes externas", icon: Globe },
];

const notificationLabels = [
  { key: "assignedTasks", title: "Novas tarefas atribuidas", desc: "Quando uma tarefa for atribuida a voce" },
  { key: "dueSoon", title: "Prazo proximo", desc: "Alerta de vencimento" },
  { key: "newForms", title: "Novos formularios", desc: "Quando cliente enviar formulario" },
  { key: "newLeads", title: "Novos leads", desc: "Quando lead for capturado" },
  { key: "dailyEmail", title: "Resumo diario por e-mail", desc: "Resumo de eventos diarios" },
] as const;

function isMissingColumnError(message: string | undefined, column: string) {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("column") && normalized.includes(column.toLowerCase());
}

function readStringSetting(settings: Record<string, unknown>, modernKey: string, legacyKey: string) {
  const modernValue = settings[modernKey];
  if (typeof modernValue === "string") return modernValue;
  const legacyValue = settings[legacyKey];
  if (typeof legacyValue === "string") return legacyValue;
  return "";
}

function readBooleanSetting(
  settings: Record<string, unknown>,
  modernKey: string,
  legacyKey: string,
  fallback = false,
) {
  const modernValue = settings[modernKey];
  if (typeof modernValue === "boolean") return modernValue;
  const legacyValue = settings[legacyKey];
  if (typeof legacyValue === "boolean") return legacyValue;
  return fallback;
}

function normalizeThemePreference(value: unknown, fallback: ThemePreference = "system"): ThemePreference {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "light" || normalized === "dark" || normalized === "system") {
    return normalized;
  }
  return fallback;
}

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<SettingSectionId>("profile");
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<SettingSectionId | "avatar" | null>(null);
  const [savingThemePreference, setSavingThemePreference] = useState(false);
  const [integrationTokenAction, setIntegrationTokenAction] = useState<"rotate" | "toggle" | "copy" | null>(null);

  const [profileForm, setProfileForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    jobTitle: "",
    avatarUrl: "",
  });
  const [companyForm, setCompanyForm] = useState({
    companyName: "",
    companyDocument: "",
    companyEmail: "",
    companyPhone: "",
    companyWebsite: "",
  });
  const [notificationSettings, setNotificationSettings] = useState({
    assignedTasks: true,
    dueSoon: true,
    newForms: true,
    newLeads: true,
    dailyEmail: true,
  });
  const [appearanceSettings, setAppearanceSettings] = useState({
    themePreference: "system" as ThemePreference,
    languageCode: "pt-BR",
    compactMode: false,
  });
  const [integrationSettings, setIntegrationSettings] = useState({
    calendarSync: false,
    driveSync: false,
    webhookUrl: "",
    apiAccess: false,
  });
  const [integrationTokenStatus, setIntegrationTokenStatus] = useState<IntegrationTokenStatus>({
    enabled: false,
    token_configured: false,
    token_prefix: null,
    last_used_at: null,
    rotated_at: null,
    revealed_token: null,
  });
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const upsertUserSettings = async (payload: Partial<Omit<TablesInsert<"user_settings">, "user_id">>) => {
    if (!user) return { error: new Error("Usuario nao autenticado.") };
    return supabase.from("user_settings").upsert({ user_id: user.id, ...payload }, { onConflict: "user_id" });
  };

  const invokeIntegrationTokenManager = async (body: Record<string, unknown>) =>
    supabase.functions.invoke<IntegrationTokenStatus>("manage-integration-token", { body });

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [profileRes, settingsRes, tokenStatusRes] = await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
      invokeIntegrationTokenManager({ action: "status" }),
    ]);

    if (profileRes.error) toast.error("Falha ao carregar perfil.");
    if (settingsRes.error) toast.error("Falha ao carregar configuracoes.");
    if (tokenStatusRes.error) toast.error("Falha ao carregar o status do token.");

    const profile = profileRes.data;
    const settings = (settingsRes.data || {}) as Record<string, unknown>;
    const currentTheme = normalizeThemePreference(theme, "system");
    const initialTheme = normalizeThemePreference(settings.theme_preference, currentTheme);

    setProfileForm({
      displayName: profile?.display_name || user.email?.split("@")[0] || "",
      email: user.email || "",
      phone: typeof settings.phone === "string" ? settings.phone : "",
      jobTitle: typeof settings.job_title === "string" ? settings.job_title : "",
      avatarUrl: profile?.avatar_url || "",
    });
    setCompanyForm({
      companyName: typeof settings.company_name === "string" ? settings.company_name : "",
      companyDocument: typeof settings.company_document === "string" ? settings.company_document : "",
      companyEmail: typeof settings.company_email === "string" ? settings.company_email : "",
      companyPhone: typeof settings.company_phone === "string" ? settings.company_phone : "",
      companyWebsite: typeof settings.company_website === "string" ? settings.company_website : "",
    });
    setNotificationSettings({
      assignedTasks: typeof settings.notify_assigned_tasks === "boolean" ? settings.notify_assigned_tasks : true,
      dueSoon: typeof settings.notify_due_soon === "boolean" ? settings.notify_due_soon : true,
      newForms: typeof settings.notify_new_forms === "boolean" ? settings.notify_new_forms : true,
      newLeads: typeof settings.notify_new_leads === "boolean" ? settings.notify_new_leads : true,
      dailyEmail: typeof settings.notify_daily_email === "boolean" ? settings.notify_daily_email : true,
    });
    setAppearanceSettings({
      themePreference: initialTheme,
      languageCode: typeof settings.language_code === "string" ? settings.language_code : "pt-BR",
      compactMode: typeof settings.compact_mode === "boolean" ? settings.compact_mode : false,
    });
    setIntegrationSettings({
      calendarSync: readBooleanSetting(settings, "calendar_sync", "integrations_calendar_sync"),
      driveSync: readBooleanSetting(settings, "drive_sync", "integrations_drive_sync"),
      webhookUrl: readStringSetting(settings, "webhook_url", "integrations_webhook_url"),
      apiAccess: tokenStatusRes.data?.enabled ?? false,
    });
    setIntegrationTokenStatus({
      enabled: tokenStatusRes.data?.enabled ?? false,
      token_configured: tokenStatusRes.data?.token_configured ?? false,
      token_prefix: tokenStatusRes.data?.token_prefix ?? null,
      last_used_at: tokenStatusRes.data?.last_used_at ?? null,
      rotated_at: tokenStatusRes.data?.rotated_at ?? null,
      revealed_token: null,
    });

    if (initialTheme !== currentTheme) {
      setTheme(initialTheme);
    }

    setLoading(false);
  }, [setTheme, theme, user]);

  useEffect(() => {
    if (user) {
      void loadSettings();
    } else {
      setLoading(false);
    }
  }, [loadSettings, user]);

  useEffect(() => {
    const normalizedTheme = normalizeThemePreference(theme, "system");
    setAppearanceSettings((prev) =>
      prev.themePreference === normalizedTheme
        ? prev
        : { ...prev, themePreference: normalizedTheme },
    );
  }, [theme]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingSection("profile");
    const [profileRes, settingsRes] = await Promise.all([
      supabase.from("profiles").upsert(
        { user_id: user.id, display_name: profileForm.displayName.trim() || null, avatar_url: profileForm.avatarUrl || null },
        { onConflict: "user_id" },
      ),
      upsertUserSettings({ phone: profileForm.phone.trim() || null, job_title: profileForm.jobTitle.trim() || null }),
    ]);
    setSavingSection(null);
    if (profileRes.error || settingsRes.error) return toast.error("Erro ao salvar perfil.");
    toast.success("Perfil atualizado.");
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Avatar deve ter ate 2MB.");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return toast.error("Use PNG, JPG ou WEBP.");
    }

    setSavingSection("avatar");
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${user.id}/avatar.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-avatars")
      .upload(filePath, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setSavingSection(null);
      return toast.error("Erro ao enviar avatar.");
    }

    const { data } = supabase.storage.from("profile-avatars").getPublicUrl(filePath);
    const { error: profileError } = await supabase.from("profiles").upsert(
      { user_id: user.id, display_name: profileForm.displayName.trim() || null, avatar_url: data.publicUrl },
      { onConflict: "user_id" },
    );
    setSavingSection(null);
    if (profileError) return toast.error("Falha ao salvar avatar no perfil.");
    setProfileForm((prev) => ({ ...prev, avatarUrl: data.publicUrl }));
    toast.success("Avatar atualizado.");
  };

  const saveCompany = async () => {
    setSavingSection("company");
    const { error } = await upsertUserSettings({
      company_name: companyForm.companyName.trim() || null,
      company_document: companyForm.companyDocument.trim() || null,
      company_email: companyForm.companyEmail.trim() || null,
      company_phone: companyForm.companyPhone.trim() || null,
      company_website: companyForm.companyWebsite.trim() || null,
    });
    setSavingSection(null);
    if (error) return toast.error("Erro ao salvar empresa.");
    toast.success("Dados da empresa salvos.");
  };

  const saveNotifications = async () => {
    setSavingSection("notifications");
    const { error } = await upsertUserSettings({
      notify_assigned_tasks: notificationSettings.assignedTasks,
      notify_due_soon: notificationSettings.dueSoon,
      notify_new_forms: notificationSettings.newForms,
      notify_new_leads: notificationSettings.newLeads,
      notify_daily_email: notificationSettings.dailyEmail,
    });
    setSavingSection(null);
    if (error) return toast.error("Erro ao salvar notificacoes.");
    toast.success("Notificacoes salvas.");
  };

  const handleThemePreferenceChange = (value: ThemePreference) => {
    const normalized = normalizeThemePreference(value, appearanceSettings.themePreference);
    if (normalized === appearanceSettings.themePreference) return;

    setAppearanceSettings((prev) => ({ ...prev, themePreference: normalized }));
    setTheme(normalized);

    setSavingThemePreference(true);
    void upsertUserSettings({ theme_preference: normalized })
      .then(({ error }) => {
        if (error) {
          toast.error("Nao foi possivel salvar o tema automaticamente.");
        }
      })
      .finally(() => {
        setSavingThemePreference(false);
      });
  };

  const saveAppearance = async () => {
    setSavingSection("appearance");
    const normalizedTheme = normalizeThemePreference(appearanceSettings.themePreference, "system");
    setTheme(normalizedTheme);
    const { error } = await upsertUserSettings({
      theme_preference: normalizedTheme,
      language_code: appearanceSettings.languageCode,
      compact_mode: appearanceSettings.compactMode,
    });
    setSavingSection(null);
    if (error) return toast.error("Erro ao salvar aparencia.");
    toast.success("Aparencia salva.");
  };

  const saveIntegrations = async () => {
    setSavingSection("integrations");
    let { error } = await upsertUserSettings({
      calendar_sync: integrationSettings.calendarSync,
      drive_sync: integrationSettings.driveSync,
      webhook_url: integrationSettings.webhookUrl.trim() || null,
    });

    if (
      error &&
      (
        isMissingColumnError(error.message, "calendar_sync") ||
        isMissingColumnError(error.message, "drive_sync") ||
        isMissingColumnError(error.message, "webhook_url")
      )
    ) {
      ({ error } = await upsertUserSettings({
        integrations_calendar_sync: integrationSettings.calendarSync,
        integrations_drive_sync: integrationSettings.driveSync,
        integrations_webhook_url: integrationSettings.webhookUrl.trim() || null,
      } as unknown as Partial<Omit<TablesInsert<"user_settings">, "user_id">>));
    }

    setSavingSection(null);
    if (error) return toast.error("Erro ao salvar integracoes.");
    toast.success("Integracoes salvas.");
  };

  const handleRotateIntegrationToken = async () => {
    setIntegrationTokenAction("rotate");
    const { data, error } = await invokeIntegrationTokenManager({ action: "rotate" });
    setIntegrationTokenAction(null);

    if (error || !data) {
      toast.error("Nao foi possivel gerar um novo token seguro.");
      return;
    }

    setIntegrationTokenStatus(data);
    setIntegrationSettings((prev) => ({ ...prev, apiAccess: data.enabled }));
    toast.success("Novo token gerado. Copie-o agora; ele nao sera exibido novamente.");
  };

  const handleIntegrationAccessToggle = async (enabled: boolean) => {
    if (enabled && !integrationTokenStatus.token_configured) {
      await handleRotateIntegrationToken();
      return;
    }

    setIntegrationTokenAction("toggle");
    const { data, error } = await invokeIntegrationTokenManager({ action: "set_enabled", enabled });
    setIntegrationTokenAction(null);

    if (error || !data) {
      toast.error("Nao foi possivel atualizar o acesso por token.");
      return;
    }

    setIntegrationTokenStatus((prev) => ({ ...prev, ...data, revealed_token: prev.revealed_token }));
    setIntegrationSettings((prev) => ({ ...prev, apiAccess: data.enabled }));
    toast.success(enabled ? "Acesso por token habilitado." : "Acesso por token desabilitado.");
  };

  const copyIntegrationToken = async () => {
    if (!integrationTokenStatus.revealed_token) return;
    setIntegrationTokenAction("copy");
    try {
      await navigator.clipboard.writeText(integrationTokenStatus.revealed_token);
      toast.success("Token copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o token.");
    } finally {
      setIntegrationTokenAction(null);
    }
  };

  const changePassword = async () => {
    if (!user?.email) return;
    if (!securityForm.currentPassword) return toast.error("Informe a senha atual.");
    if (securityForm.newPassword.length < 8) return toast.error("Nova senha precisa ter 8 caracteres.");
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      return toast.error("Confirmacao da senha invalida.");
    }

    setSavingSection("security");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: securityForm.currentPassword,
    });
    if (signInError) {
      setSavingSection(null);
      return toast.error("Senha atual invalida.");
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: securityForm.newPassword });
    setSavingSection(null);
    if (updateError) return toast.error("Nao foi possivel alterar a senha.");
    setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    toast.success("Senha alterada com sucesso.");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="font-heading text-2xl font-bold">Configuracoes</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferencias do sistema</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            {settingSections.map((section, index) => (
              <motion.button
                key={section.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-muted/80 ${
                  activeSection === section.id ? "bg-muted" : ""
                }`}
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

          <div className="lg:col-span-2 space-y-6">
            {activeSection === "profile" && (
              <div className="rounded-xl border bg-card p-6">
                <h2 className="font-heading font-semibold mb-4">Perfil</h2>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={uploadAvatar}
                />
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                    {profileForm.avatarUrl ? (
                      <img src={profileForm.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-primary">
                        {profileForm.displayName.charAt(0).toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{profileForm.email || "Usuario"}</div>
                    <div className="text-sm text-muted-foreground">{profileForm.jobTitle || "Sem cargo definido"}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={savingSection === "avatar"}
                    >
                      {savingSection === "avatar" ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3 mr-1" />
                      )}
                      Alterar foto
                    </Button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Nome completo</Label>
                    <Input
                      value={profileForm.displayName}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">E-mail</Label>
                    <Input value={profileForm.email} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Telefone</Label>
                    <Input
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Cargo</Label>
                    <Input
                      value={profileForm.jobTitle}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, jobTitle: event.target.value }))}
                    />
                  </div>
                </div>
                <Button className="mt-4" onClick={saveProfile} disabled={savingSection === "profile"}>
                  {savingSection === "profile" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar alteracoes
                </Button>
              </div>
            )}

            {activeSection === "company" && (
              <div className="rounded-xl border bg-card p-6">
                <h2 className="font-heading font-semibold mb-4">Empresa</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Nome da empresa</Label>
                    <Input
                      value={companyForm.companyName}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Documento</Label>
                    <Input
                      value={companyForm.companyDocument}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyDocument: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">E-mail corporativo</Label>
                    <Input
                      value={companyForm.companyEmail}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyEmail: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Telefone corporativo</Label>
                    <Input
                      value={companyForm.companyPhone}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyPhone: event.target.value }))}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="text-sm">Website</Label>
                    <Input
                      value={companyForm.companyWebsite}
                      onChange={(event) => setCompanyForm((prev) => ({ ...prev, companyWebsite: event.target.value }))}
                    />
                  </div>
                </div>
                <Button className="mt-4" onClick={saveCompany} disabled={savingSection === "company"}>
                  {savingSection === "company" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar dados da empresa
                </Button>
              </div>
            )}

            {activeSection === "notifications" && (
              <div className="rounded-xl border bg-card p-6">
                <h2 className="font-heading font-semibold mb-4">Notificacoes</h2>
                <div className="space-y-4">
                  {notificationLabels.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.desc}</div>
                      </div>
                      <Switch
                        checked={notificationSettings[item.key]}
                        onCheckedChange={(checked) => setNotificationSettings((prev) => ({ ...prev, [item.key]: checked }))}
                      />
                    </div>
                  ))}
                </div>
                <Button className="mt-4" onClick={saveNotifications} disabled={savingSection === "notifications"}>
                  {savingSection === "notifications" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar notificacoes
                </Button>
              </div>
            )}

            {activeSection === "appearance" && (
              <div className="rounded-xl border bg-card p-6">
                <h2 className="font-heading font-semibold mb-4">Aparencia</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Tema</Label>
                    <Select value={appearanceSettings.themePreference} onValueChange={handleThemePreferenceChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">Sistema</SelectItem>
                        <SelectItem value="light">Claro</SelectItem>
                        <SelectItem value="dark">Escuro</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingThemePreference && <p className="text-xs text-muted-foreground">Salvando tema...</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Idioma</Label>
                    <Select
                      value={appearanceSettings.languageCode}
                      onValueChange={(value) => setAppearanceSettings((prev) => ({ ...prev, languageCode: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Portugues (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es-ES">Espanol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border rounded-lg p-3">
                  <div>
                    <div className="text-sm font-medium">Modo compacto</div>
                    <div className="text-xs text-muted-foreground">Reduz espacos da interface</div>
                  </div>
                  <Switch
                    checked={appearanceSettings.compactMode}
                    onCheckedChange={(checked) => setAppearanceSettings((prev) => ({ ...prev, compactMode: checked }))}
                  />
                </div>
                <Button
                  className="mt-4"
                  onClick={saveAppearance}
                  disabled={savingSection === "appearance" || savingThemePreference}
                >
                  {savingSection === "appearance" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar aparencia
                </Button>
              </div>
            )}

            {activeSection === "integrations" && (
              <div className="rounded-xl border bg-card p-6">
                <h2 className="font-heading font-semibold mb-4">Integracoes</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Sincronizacao com calendario</div>
                      <div className="text-xs text-muted-foreground">Atualiza compromissos automaticamente</div>
                    </div>
                    <Switch
                      checked={integrationSettings.calendarSync}
                      onCheckedChange={(checked) => setIntegrationSettings((prev) => ({ ...prev, calendarSync: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Integracao com drive</div>
                      <div className="text-xs text-muted-foreground">Sincroniza arquivos enviados</div>
                    </div>
                    <Switch
                      checked={integrationSettings.driveSync}
                      onCheckedChange={(checked) => setIntegrationSettings((prev) => ({ ...prev, driveSync: checked }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Webhook</Label>
                    <Input
                      value={integrationSettings.webhookUrl}
                      onChange={(event) => setIntegrationSettings((prev) => ({ ...prev, webhookUrl: event.target.value }))}
                    />
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Acesso por token</div>
                        <div className="text-xs text-muted-foreground">
                          O token e gerenciado no servidor e apenas o hash fica persistido.
                        </div>
                      </div>
                      <Switch
                        checked={integrationSettings.apiAccess}
                        onCheckedChange={(checked) => void handleIntegrationAccessToggle(checked)}
                        disabled={integrationTokenAction === "toggle" || integrationTokenAction === "rotate"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Status do token</Label>
                      <Input
                        readOnly
                        value={
                          integrationTokenStatus.revealed_token ||
                          (integrationTokenStatus.token_configured ? `${integrationTokenStatus.token_prefix}...` : "Nenhum token ativo")
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleRotateIntegrationToken()}
                        disabled={integrationTokenAction === "rotate" || integrationTokenAction === "toggle"}
                      >
                        {integrationTokenAction === "rotate" ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-4 w-4 mr-1" />
                        )}
                        Gerar novo token
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyIntegrationToken()}
                        disabled={!integrationTokenStatus.revealed_token || integrationTokenAction === "copy"}
                      >
                        {integrationTokenAction === "copy" ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        Copiar token
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      O valor completo do token so aparece no momento da geracao. Ultimo uso:{" "}
                      {integrationTokenStatus.last_used_at
                        ? new Date(integrationTokenStatus.last_used_at).toLocaleString("pt-BR")
                        : "ainda nao utilizado"}
                      .
                    </p>
                  </div>
                </div>

                <Button className="mt-4" onClick={saveIntegrations} disabled={savingSection === "integrations"}>
                  {savingSection === "integrations" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar integracoes
                </Button>
              </div>
            )}

            {activeSection === "security" && (
              <div className="rounded-xl border bg-card p-6">
                <h2 className="font-heading font-semibold mb-4">Seguranca</h2>
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Senha atual</Label>
                      <Input
                        type="password"
                        value={securityForm.currentPassword}
                        onChange={(event) => setSecurityForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Nova senha</Label>
                      <Input
                        type="password"
                        value={securityForm.newPassword}
                        onChange={(event) => setSecurityForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-sm">Confirmar nova senha</Label>
                      <Input
                        type="password"
                        value={securityForm.confirmPassword}
                        onChange={(event) => setSecurityForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      />
                    </div>
                  </div>
                  <Button variant="outline" onClick={changePassword} disabled={savingSection === "security"}>
                    {savingSection === "security" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Alterar senha
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
