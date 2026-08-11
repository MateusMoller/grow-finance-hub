const startOfLocalDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

export const getChatDateKey = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export const formatChatDateLabel = (timestamp: string) => {
  const messageDate = new Date(timestamp);
  if (Number.isNaN(messageDate.getTime())) return "Data desconhecida";

  const today = startOfLocalDay(new Date());
  const messageDay = startOfLocalDay(messageDate);
  const differenceInDays = Math.round(
    (today.getTime() - messageDay.getTime()) / 86_400_000,
  );

  if (differenceInDays === 0) return "Hoje";
  if (differenceInDays === 1) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(messageDate);
};
