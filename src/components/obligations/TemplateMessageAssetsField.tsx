import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getStoredCurrentOrganizationId, invokeGrowObligations } from "@/lib/growObligations";
import { sanitizeStorageFilename } from "@/lib/fileUploadSecurity";
import { supabase } from "@/integrations/supabase/client";

type MessageAsset = {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  preview_url: string | null;
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxBytes = 5 * 1024 * 1024;

export function TemplateMessageAssetsField({
  templateId,
  channel,
  disabled,
}: {
  templateId: string | null;
  channel: "email" | "whatsapp";
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const queryKey = ["grow-obligations", "template-message-assets", templateId, channel] as const;
  const assetsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await invokeGrowObligations<{ ok: true; assets: MessageAsset[] }>({
        action: "list_template_message_assets",
        template_id: templateId,
        channel,
      });
      return response.assets;
    },
    enabled: Boolean(templateId),
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!templateId) throw new Error("Salve a obrigacao antes de anexar imagens.");
      if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) {
        throw new Error("Envie uma imagem JPG, PNG, WEBP ou GIF de ate 5 MB.");
      }
      if ((assetsQuery.data?.length || 0) >= 5) throw new Error("Cada mensagem aceita no maximo 5 imagens.");
      const organizationId = await getStoredCurrentOrganizationId();
      if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");
      const path = `${organizationId}/message-assets/${templateId}/${crypto.randomUUID()}-${sanitizeStorageFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("obligation-files").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      try {
        return await invokeGrowObligations({
          action: "register_template_message_asset",
          template_id: templateId,
          channel,
          storage_path: path,
          file_name: file.name,
          content_type: file.type,
          file_size: file.size,
        });
      } catch (error) {
        await supabase.storage.from("obligation-files").remove([path]);
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Imagem anexada a mensagem.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao anexar imagem."),
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => invokeGrowObligations({ action: "delete_template_message_asset", asset_id: assetId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success("Imagem removida.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao remover imagem."),
  });

  const assets = assetsQuery.data || [];
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Imagens da mensagem</p>
          <p className="text-xs text-muted-foreground">JPG, PNG, WEBP ou GIF, ate 5 MB cada. Maximo de 5 imagens.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={disabled || !templateId || uploadMutation.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) uploadMutation.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !templateId || uploadMutation.isPending || assets.length >= 5}
          onClick={() => inputRef.current?.click()}
        >
          {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          Anexar imagem
        </Button>
      </div>
      {!templateId ? <p className="text-xs text-amber-700">Salve a obrigacao primeiro para liberar os anexos.</p> : null}
      {assetsQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      {assets.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {assets.map((asset) => (
            <div key={asset.id} className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 p-2">
              {asset.preview_url ? <img src={asset.preview_url} alt="" className="h-12 w-12 rounded-md object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{asset.file_name}</p>
                <p className="text-xs text-muted-foreground">{Math.ceil(asset.file_size / 1024)} KB</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${asset.file_name}`} disabled={disabled || deleteMutation.isPending} onClick={() => deleteMutation.mutate(asset.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
