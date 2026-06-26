import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatPermissionAuditValue, usePermissionAudit } from "@/hooks/usePermissionAudit";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

const organizationId = "00000000-0000-4000-8000-000000000001";

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

  return Wrapper;
};

describe("permission audit query resources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: {
        items: [
          {
            id: "audit-1",
            action: "role_changed",
            result: "success",
          },
        ],
        total: 1,
      },
      error: null,
    });
  });

  it("passes filter-aware pagination to the Admin audit RPC", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => usePermissionAudit(organizationId, { action: "role_changed", page: 3, pageSize: 10 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data?.total).toBe(1));
    expect(supabase.rpc).toHaveBeenCalledWith("admin_list_permission_audit", {
      _organization_id: organizationId,
      _target_user_id: null,
      _actor_user_id: null,
      _action: "role_changed",
      _date_from: null,
      _date_to: null,
      _page: 3,
      _page_size: 10,
    });
  });

  it("does not call the audit RPC before organization scope is known", () => {
    const wrapper = createWrapper();
    renderHook(() => usePermissionAudit(null, { action: "all", page: 1, pageSize: 20 }), { wrapper });

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("renders before and after audit values compactly", () => {
    expect(formatPermissionAuditValue(null)).toBe("-");
    expect(formatPermissionAuditValue("admin")).toBe("admin");
    expect(formatPermissionAuditValue([])).toBe("[]");
    expect(formatPermissionAuditValue({ status: "active", modules: ["tarefas"] })).toBe(
      '{"status":"active","modules":["tarefas"]}',
    );
  });
});
