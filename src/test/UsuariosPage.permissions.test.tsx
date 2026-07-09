import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUserManagement, type UserFilters } from "@/hooks/useUserManagement";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const organizationId = "00000000-0000-4000-8000-000000000001";

const filters: UserFilters = {
  search: " maria ",
  role: "colaborador",
  sectorCode: "fiscal",
  status: "active",
  moduleKey: "obrigacoes",
  page: 2,
  pageSize: 25,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { Wrapper, queryClient };
};

describe("user management permissions resources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as never);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true }, error: null });
  });

  it("uses server-side filters for Admin listing", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useUserManagement(organizationId, filters), { wrapper: Wrapper });

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith("admin_list_user_access", {
      _organization_id: organizationId,
      _search: "maria",
      _role: "colaborador",
      _sector_code: "fiscal",
      _status: "active",
      _module_key: "obrigacoes",
      _client_id: null,
      _requires_access_review: null,
      _page: 2,
      _page_size: 25,
    }));
  });

  it("loads only active clients for role-specific linking", async () => {
    const { Wrapper } = createWrapper();
    renderHook(() => useUserManagement(organizationId, filters), { wrapper: Wrapper });

    await waitFor(() => expect(supabase.from).toHaveBeenCalledWith("clients"));
    const clientsQuery = vi.mocked(supabase.from).mock.results[0].value as {
      neq: ReturnType<typeof vi.fn>;
    };
    expect(clientsQuery.neq).toHaveBeenCalledWith("status", "Inativo");
  });

  it("sends canonical role fields through the protected Edge Function", async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserManagement(organizationId, filters), { wrapper: Wrapper });

    result.current.saveMutation.mutate({
      userId: "00000000-0000-4000-8000-000000000002",
      displayName: "Maria",
      primaryRole: "colaborador",
      status: "active",
      sectorCode: "fiscal",
      enabledModules: ["tarefas", "obrigacoes"],
      linkedClientIds: [],
      changeReason: "Teste",
    });

    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledWith("manage-team-user", {
      body: expect.objectContaining({
        action: "update",
        organizationId,
        primaryRole: "colaborador",
        role: "colaborador",
        primary_role: "colaborador",
        sectorCode: "fiscal",
        sector_code: "fiscal",
        enabledModules: ["tarefas", "obrigacoes"],
      }),
    }));
  });
});
