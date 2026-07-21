import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download, FileText, Image as ImageIcon, Mic, Pause, Play, RefreshCw, Reply, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { bubbleToneClass, type WhatsAppBubbleTone } from "@/components/whatsapp/appearance";
import { whatsAppReplyReferenceFor, type WhatsAppReplyReference } from "@/lib/whatsappMessagePreview";
import { getWhatsAppAttachmentUrl } from "@/lib/whatsappMedia";
import type { WhatsAppAttachment, WhatsAppMessage } from "@/lib/whatsappTypes";

const formatTime = (message: WhatsAppMessage) => {
  const value = message.sent_at || message.received_at || message.created_at;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const baseMimeType = (value: string | null | undefined) => (value || "").toLowerCase().split(";")[0].trim();

const statusLabel = (status: string | null | undefined) => {
  if (status === "blocked") return "Bloqueado";
  if (status === "failed") return "Falha";
  if (status === "pending") return "Processando";
  if (status === "stored" || status === "sent") return "";
  return status || "";
};

const formatSeconds = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const waveformBars = [12, 16, 22, 13, 27, 18, 30, 20, 14, 25, 32, 16, 22, 28, 18, 12, 26, 34, 20, 15, 24, 29, 17, 22, 31, 19, 14, 26, 33, 21, 16, 24];

function AudioVoiceNote({
  signedUrl,
  contactInitials,
  outbound,
  bubbleTone,
}: {
  signedUrl: string;
  contactInitials: string;
  outbound: boolean;
  bubbleTone: WhatsAppBubbleTone;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLSpanElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const accentColor = outbound ? "#00a884" : "#667781";
  const emptyBarClass = outbound ? "bg-[#8fd8bf]" : "bg-slate-300";
  const filledBarClass = outbound ? "bg-[#00a884]" : "bg-slate-600";
  const displayedLeftTime = currentTime > 0 || isPlaying ? formatSeconds(currentTime) : formatSeconds(duration);
  const tone = bubbleToneClass[bubbleTone];

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      return;
    }

    audio.pause();
    setIsPlaying(false);
  };

  const seekToClientX = (clientX: number) => {
    const audio = audioRef.current;
    const waveform = waveformRef.current;
    if (!audio || !waveform || duration <= 0) return;

    const rect = waveform.getBoundingClientRect();
    const nextProgress = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const nextTime = nextProgress * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div className="flex w-[20rem] max-w-full items-center gap-2.5 rounded-lg px-0.5 py-0.5 text-[#111b21]">
      <button
        type="button"
        onClick={togglePlayback}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#00a884]/30"
        aria-label={isPlaying ? "Pausar áudio" : "Reproduzir áudio"}
      >
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={(event) => seekToClientX(event.clientX)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seekToClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1) return;
            seekToClientX(event.clientX);
          }}
          className="flex h-8 w-full cursor-pointer items-center rounded-md px-0.5 focus:outline-none focus:ring-2 focus:ring-[#00a884]/25"
          aria-label="Avançar ou voltar no áudio"
        >
          <span ref={waveformRef} className="relative flex h-full w-full items-center justify-between">
            {waveformBars.map((height, index) => {
              const filled = (index + 0.5) / waveformBars.length <= progress;
              return (
                <span
                  key={`${height}-${index}`}
                  className={`w-[3px] rounded-full transition-colors ${filled ? filledBarClass : emptyBarClass}`}
                  style={{ height }}
                />
              );
            })}
            <span
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm ring-2 ring-white"
              style={{ left: `${progress * 100}%`, backgroundColor: accentColor }}
            />
          </span>
        </button>
        <div className="mt-0.5 flex items-center justify-between text-[10px] font-medium text-[#667781]">
          <span>{displayedLeftTime}</span>
          <span>{duration > 0 && currentTime > 0 ? formatSeconds(Math.max(duration - currentTime, 0)) : ""}</span>
        </div>
      </div>
      <div className="relative shrink-0">
        <span className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-sm font-bold shadow-sm ring-2 ring-white ${tone.audioAvatar}`}>
          {contactInitials}
        </span>
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#00a884]" />
      </div>
      <audio
        ref={audioRef}
        src={signedUrl}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
    </div>
  );
}

function AttachmentPreview({
  attachment,
  time,
  contactInitials,
  outbound,
  bubbleTone,
}: {
  attachment: WhatsAppAttachment;
  time: string;
  contactInitials: string;
  outbound: boolean;
  bubbleTone: WhatsAppBubbleTone;
}) {
  const type = baseMimeType(attachment.content_type);
  const isAudio = type.startsWith("audio/");
  const isImage = type.startsWith("image/");
  const isVideo = type.startsWith("video/");
  const canOpen = Boolean(attachment.storage_path) && ["stored", "sent"].includes(attachment.status);
  const { data } = useQuery({
    queryKey: ["whatsapp", "attachment-url", attachment.id],
    queryFn: () => getWhatsAppAttachmentUrl(attachment.id),
    enabled: canOpen,
    staleTime: 4 * 60 * 1000,
  });
  const label = attachment.file_name || (isAudio ? "Áudio recebido" : "Arquivo");
  const status = statusLabel(attachment.status);

  if (isImage && data?.signedUrl) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="group relative block overflow-hidden rounded-lg bg-black/5 text-left transition hover:brightness-95">
            <img src={data.signedUrl} alt={label} className="max-h-80 w-[19rem] max-w-full object-cover" loading="lazy" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/55 via-black/20 to-transparent px-2 pb-1.5 pt-9 text-white">
              <span className="min-w-0 truncate text-xs drop-shadow">{label}</span>
              <span className="shrink-0 text-[10px] drop-shadow">{time}</span>
            </div>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[min(96vw,64rem)] border-white/10 bg-slate-950 p-3 text-white">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <DialogDescription className="sr-only">Pré-visualização da imagem recebida pelo WhatsApp.</DialogDescription>
          <img src={data.signedUrl} alt={label} className="max-h-[82vh] w-full rounded-lg object-contain" />
          <a href={data.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15">
            <Download className="h-4 w-4" />
            Abrir arquivo
          </a>
        </DialogContent>
      </Dialog>
    );
  }

  if (isVideo && data?.signedUrl) {
    return (
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video controls preload="metadata" src={data.signedUrl} className="max-h-72 w-[19rem] max-w-full bg-black" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/55 via-black/20 to-transparent px-2 pb-1.5 pt-8 text-white">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs drop-shadow">
            <Video className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          <span className="shrink-0 text-[10px] drop-shadow">{time}</span>
        </div>
      </div>
    );
  }

  if (isAudio && data?.signedUrl) {
    return <AudioVoiceNote signedUrl={data.signedUrl} contactInitials={contactInitials} outbound={outbound} bubbleTone={bubbleTone} />;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/5 p-2 text-xs">
      {isAudio ? <Mic className="h-4 w-4" /> : isImage ? <ImageIcon className="h-4 w-4" /> : isVideo ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {data?.signedUrl ? (
        <a href={data.signedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
          <Download className="h-3.5 w-3.5" />
          Abrir
        </a>
      ) : (
        status && <span>{status}</span>
      )}
    </div>
  );
}

export function MessageBubble({
  message,
  contactInitials,
  bubbleTone = "verde",
  compact = false,
  onReply,
}: {
  message: WhatsAppMessage;
  contactInitials: string;
  bubbleTone?: WhatsAppBubbleTone;
  compact?: boolean;
  onReply?: (message: WhatsAppReplyReference) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const outbound = message.direction === "outbound";
  const failed = message.delivery_status === "failed" || Boolean(message.blocked_reason);
  const time = formatTime(message);
  const hasAttachments = Boolean(message.attachments?.length);
  const tone = bubbleToneClass[bubbleTone];
  const downloadableAttachment = message.attachments?.find(
    (attachment) => Boolean(attachment.storage_path) && ["stored", "sent"].includes(attachment.status),
  );
  const downloadLabel = downloadableAttachment?.file_name || "mídia";
  const downloadQuery = useQuery({
    queryKey: ["whatsapp", "attachment-url", downloadableAttachment?.id || "none", "menu-download"],
    queryFn: () => getWhatsAppAttachmentUrl(downloadableAttachment?.id || ""),
    enabled: menuOpen && Boolean(downloadableAttachment),
    staleTime: 4 * 60 * 1000,
  });

  return (
    <div className={`group/message flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[min(78%,38rem)] rounded-lg px-2.5 text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          compact ? "py-1" : "py-1.5"
        } ${outbound ? `rounded-tr-none ${tone.outbound}` : "rounded-tl-none bg-white"} ${failed ? "ring-1 ring-destructive/40" : ""}`}
      >
        <span
          className={`absolute top-0 h-3 w-3 ${
            outbound
              ? `-right-1.5 ${tone.tail} [clip-path:polygon(0_0,100%_0,0_100%)]`
              : "-left-1.5 bg-white [clip-path:polygon(0_0,100%_0,100%_100%)]"
          }`}
        />
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Opções da mensagem"
              className={`absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full text-[#667781] opacity-0 shadow-sm transition group-hover/message:opacity-100 focus:opacity-100 ${
                outbound ? tone.outbound : "bg-white"
              } hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#00a884]/30`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={outbound ? "end" : "start"} className="w-44">
            <DropdownMenuItem onSelect={() => onReply?.(whatsAppReplyReferenceFor(message))}>
              <Reply className="mr-2 h-4 w-4" />
              Responder
            </DropdownMenuItem>
            {downloadableAttachment && (
              <>
                <DropdownMenuSeparator />
                {downloadQuery.data?.signedUrl ? (
                  <DropdownMenuItem asChild>
                    <a href={downloadQuery.data.signedUrl} download={downloadLabel} target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Baixar mídia
                    </a>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>
                    <Download className="mr-2 h-4 w-4" />
                    Preparando...
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {message.body && (
          <p className={`whitespace-pre-wrap break-words px-1 pr-12 ${compact ? "text-[14px] leading-[1.4]" : "text-[14.5px] leading-[1.45]"}`}>
            {message.body}
          </p>
        )}
        {message.attachments?.map((attachment) => (
          <AttachmentPreview
            key={attachment.id}
            attachment={attachment}
            time={time}
            contactInitials={contactInitials}
            outbound={outbound}
            bubbleTone={bubbleTone}
          />
        ))}
        <div className={`mt-0.5 items-center justify-end gap-1 px-1 text-[10px] text-[#667781] ${hasAttachments && !failed ? "hidden" : "flex"}`}>
          {failed && <RefreshCw className="h-3 w-3 text-destructive" />}
          {(failed || message.delivery_status === "queued" || message.delivery_status === "sending") && (
            <span>{message.blocked_reason || message.failure_reason || message.delivery_status}</span>
          )}
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}
