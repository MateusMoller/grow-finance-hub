export type WhatsAppChatDensity = "compacta" | "confortavel";
export type WhatsAppChatBackground = "classico" | "limpo" | "suave";
export type WhatsAppBubbleTone = "verde" | "azul" | "neutro";

export const chatDensityLabels: Record<WhatsAppChatDensity, string> = {
  compacta: "Compacta",
  confortavel: "Confortável",
};

export const chatBackgroundLabels: Record<WhatsAppChatBackground, string> = {
  classico: "Clássico",
  limpo: "Limpo",
  suave: "Suave",
};

export const bubbleToneLabels: Record<WhatsAppBubbleTone, string> = {
  verde: "Verde",
  azul: "Azul",
  neutro: "Neutro",
};

export const whatsappBackgroundClass: Record<WhatsAppChatBackground, string> = {
  classico:
    "bg-[#efeae2] bg-[radial-gradient(circle_at_1px_1px,rgba(17,27,33,0.045)_1px,transparent_0)] bg-[size:18px_18px]",
  limpo: "bg-[#f7f8fa]",
  suave:
    "bg-[#eef7f3] bg-[radial-gradient(circle_at_1px_1px,rgba(0,128,105,0.05)_1px,transparent_0)] bg-[size:20px_20px]",
};

export const bubbleToneClass: Record<WhatsAppBubbleTone, { outbound: string; tail: string; audioAvatar: string }> = {
  verde: {
    outbound: "bg-[#d9fdd3]",
    tail: "bg-[#d9fdd3]",
    audioAvatar: "bg-[#d9fdd3] text-[#005c4b]",
  },
  azul: {
    outbound: "bg-[#dbeafe]",
    tail: "bg-[#dbeafe]",
    audioAvatar: "bg-[#dbeafe] text-[#1e3a8a]",
  },
  neutro: {
    outbound: "bg-[#e9edef]",
    tail: "bg-[#e9edef]",
    audioAvatar: "bg-[#e9edef] text-[#54656f]",
  },
};
