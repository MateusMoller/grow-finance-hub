import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WhatsAppReplyReference } from "@/lib/whatsappMessagePreview";
import { isAllowedWhatsAppAttachment, isWhatsAppWindowActive, type WhatsAppConversationSummary } from "@/lib/whatsappTypes";

const WHATSAPP_ATTACHMENT_ACCEPT = [
  "image/jpeg",
  "image/png",
  "audio/aac",
  "audio/amr",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "video/mp4",
  "video/3gp",
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
].join(",");

export function MessageComposer({
  conversation,
  sending,
  compact = false,
  replyReference,
  onSendText,
  onSendFile,
  onClearReplyReference,
}: {
  conversation: WhatsAppConversationSummary | null;
  sending: boolean;
  compact?: boolean;
  replyReference: WhatsAppReplyReference | null;
  onSendText: (text: string, replyReference: WhatsAppReplyReference | null) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onClearReplyReference: () => void;
}) {
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const windowActive = isWhatsAppWindowActive(conversation?.active_window_expires_at);
  const disabledReason = useMemo(() => {
    if (!conversation) return "Selecione uma conversa para responder.";
    if (!windowActive) return "Janela de atendimento fechada. Envio livre bloqueado no v1.";
    return null;
  }, [conversation, windowActive]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || disabledReason || sending) return;
    await onSendText(value, replyReference);
    setText("");
    onClearReplyReference();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} className={`border-t border-[#d1d7db] bg-[#f0f2f5] px-4 ${compact ? "py-2" : "py-3"}`}>
      <div className="mx-auto max-w-[58rem]">
        {disabledReason && (
          <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
            {disabledReason}
          </p>
        )}
        {fileError && (
          <p className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive ring-1 ring-destructive/10">
            {fileError}
          </p>
        )}
        {replyReference && (
          <div className="mb-2 flex items-stretch overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <span className="w-1 shrink-0 bg-[#00a884]" />
            <div className="min-w-0 flex-1 px-3 py-2">
              <p className="truncate text-xs font-semibold text-[#008069]">
                Respondendo {replyReference.direction === "inbound" ? "ao cliente" : "à equipe"}
              </p>
              <p className="truncate text-xs text-[#667781]">{replyReference.preview}</p>
            </div>
            <button
              type="button"
              onClick={onClearReplyReference}
              aria-label="Cancelar resposta"
              className="flex w-10 shrink-0 items-center justify-center text-[#667781] transition hover:bg-[#f0f2f5] hover:text-[#111b21] focus:outline-none focus:ring-2 focus:ring-[#00a884]/30"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="mx-auto max-w-[58rem]">
        <div className="flex items-end gap-2 rounded-[1.65rem] bg-white px-2 py-1.5 shadow-sm ring-1 ring-black/5 transition focus-within:ring-[#00a884]/35">
          <label className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full text-[#54656f] transition hover:bg-[#f0f2f5] hover:text-[#111b21] ${compact ? "h-9 w-9" : "h-10 w-10"}`}>
            <Paperclip className="h-5 w-5" />
            <input
              type="file"
              accept={WHATSAPP_ATTACHMENT_ACCEPT}
              className="hidden"
              disabled={Boolean(disabledReason) || sending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                setFileError(null);
                if (!file) return;
                if (!isAllowedWhatsAppAttachment(file)) {
                  setFileError("Arquivo não permitido. Use imagens até 5 MB, áudios/vídeos até 16 MB ou documentos comuns até 100 MB.");
                  return;
                }
                void onSendFile(file);
              }}
            />
          </label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={Boolean(disabledReason) || sending}
            rows={1}
            placeholder="Digite uma mensagem"
            className={`max-h-32 flex-1 resize-none border-0 bg-transparent px-1 text-[15px] leading-tight text-[#111b21] outline-none placeholder:text-[#8696a0] disabled:cursor-not-allowed disabled:opacity-70 ${compact ? "min-h-9 py-2" : "min-h-10 py-2.5"}`}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || Boolean(disabledReason) || sending}
            className={`shrink-0 rounded-full bg-[#00a884] text-white shadow-sm transition hover:bg-[#008f72] disabled:bg-[#d9dee2] disabled:text-white/85 ${compact ? "h-9 w-9" : "h-10 w-10"}`}
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
        <p className="mt-1.5 px-4 text-[10px] text-[#8696a0]">Enter envia. Shift+Enter quebra linha.</p>
      </div>
    </form>
  );
}
