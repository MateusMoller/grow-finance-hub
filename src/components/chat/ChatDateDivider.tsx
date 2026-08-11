import { formatChatDateLabel } from "@/lib/chatDate";

export function ChatDateDivider({ timestamp }: { timestamp: string }) {
  return (
    <div className="sticky top-2 z-10 flex justify-center py-1" role="separator" aria-label={`Mensagens de ${formatChatDateLabel(timestamp)}`}>
      <span className="rounded-lg border border-black/5 bg-white/90 px-3 py-1 text-[11px] font-medium text-[#54656f] shadow-sm backdrop-blur-sm">
        {formatChatDateLabel(timestamp)}
      </span>
    </div>
  );
}
