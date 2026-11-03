// Formatação monetária e de datas usada em todas as telas financeiras.
export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function parseAmount(value: string) {
  const input = value.trim().replace(/[\s\u00a0]/g, "").replace(/^R\$/i, "");
  const commaIndex = input.lastIndexOf(",");
  const dotIndex = input.lastIndexOf(".");
  let normalized = input;

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalIndex = Math.max(commaIndex, dotIndex);
    const integer = input.slice(0, decimalIndex).replace(/[.,]/g, "");
    const fraction = input.slice(decimalIndex + 1).replace(/[.,]/g, "");
    normalized = `${integer}.${fraction}`;
  } else if (commaIndex >= 0) {
    normalized = input.replace(",", ".");
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

export function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
}
