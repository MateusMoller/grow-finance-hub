import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionSettingsForm } from "@/features/integra-contador/components/ConnectionSettingsForm";
import { ConnectionHealthCard } from "@/features/integra-contador/components/ConnectionHealthCard";

describe("Integra Contador connection UI", () => {
  it("submits once and clears every secret field", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ConnectionSettingsForm organizationId="org" submitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("CNPJ contratante"), { target: { value: "12345678000199" } });
    fireEvent.change(screen.getByLabelText("Consumer Key"), { target: { value: "key" } });
    fireEvent.change(screen.getByLabelText("Consumer Secret"), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText("Senha do certificado"), { target: { value: "password" } });
    fireEvent.change(screen.getByLabelText(/Certificado A1/), { target: { files: [new File(["x"], "client.p12")] } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvar com segurança" }).closest("form")!);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByLabelText("Consumer Secret")).toHaveValue(""));
    expect(screen.getByLabelText("Senha do certificado")).toHaveAttribute("autocomplete", "new-password");
  });
  it("announces operational state and hides test control when denied", () => {
    render(<ConnectionHealthCard connection={{ id: "1", environment: "validation", contractorTaxId: "12345678000199", status: "active", certificateFilename: null, certificateFingerprint: null, certificateExpiresAt: null, configuredAt: null, enabledCapabilities: [], lastHealthCheckAt: null, lastSuccessAt: null, lastErrorCode: null, updatedAt: "now" }} canTest={false} testing={false} onTest={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Operacional");
    expect(screen.queryByRole("button", { name: "Testar conexão" })).not.toBeInTheDocument();
  });
});
