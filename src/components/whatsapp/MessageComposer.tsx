import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onSendText,
  onSendFile,
}: {
  conversation: WhatsAppConversationSummary | null;
  sending: boolean;
  onSendText: (text: string) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
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
    await onSendText(value);
    setText("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-[#f0f2f5] px-4 py-3">
      {disabledReason && <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{disabledReason}</p>}
      {fileError && <p className="mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{fileError}</p>}
      <div className="mx-auto flex max-w-5xl items-end gap-2">
        <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-800">
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
                setFileError("Arquivo nao permitido. Use imagens ate 5 MB, audios/videos ate 16 MB ou documentos comuns ate 100 MB.");
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
          className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border-0 bg-white px-4 py-3 text-sm shadow-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-70"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || Boolean(disabledReason) || sending} className="h-11 w-11 shrink-0 rounded-full bg-[#00a884] text-white hover:bg-[#008f72] disabled:bg-slate-300">
          <Send className="h-5 w-5" />
        </Button>
      </div>
      <p className="mx-auto mt-1 max-w-5xl px-14 text-[10px] text-slate-400">Enter envia. Shift+Enter quebra linha.</p>
    </form>
  );
}
