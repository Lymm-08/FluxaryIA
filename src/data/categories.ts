import type { Category } from "../types/finance";

// Categorias iniciais exibidas para quem está começando a usar o Fluxary.ia.
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "expense-food", name: "Alimentação", type: "expense", color: "#e6a23c", emoji: "🍽️" },
  { id: "expense-home", name: "Moradia", type: "expense", color: "#6387d9", emoji: "🏠" },
  { id: "expense-transport", name: "Transporte", type: "expense", color: "#7a71c7", emoji: "🚗" },
  { id: "expense-health", name: "Saúde", type: "expense", color: "#e47777", emoji: "❤️" },
  { id: "expense-leisure", name: "Lazer", type: "expense", color: "#d778a2", emoji: "🎬" },
  { id: "expense-shopping", name: "Compras", type: "expense", color: "#d89354", emoji: "🛍️" },
  { id: "expense-emergency", name: "Emergência", type: "expense", color: "#d85d5d", emoji: "emergency" },
  { id: "expense-other", name: "Outros", type: "expense", color: "#829087", emoji: "📦" },
  { id: "income-salary", name: "Salário", type: "income", color: "#178567", emoji: "💼" },
  { id: "income-freelance", name: "Freelance", type: "income", color: "#5596c6", emoji: "💻" },
  { id: "income-investments", name: "Investimentos", type: "income", color: "#8c78c8", emoji: "📈" },
  { id: "income-pix", name: "Pix", type: "income", color: "#32a98c", emoji: "pix" },
  { id: "income-other", name: "Outros", type: "income", color: "#829087", emoji: "✨" },
];

export const CATEGORY_COLORS = [
  "#178567", "#6387d9", "#7a71c7", "#e47777", "#d778a2", "#e6a23c", "#5596c6", "#829087",
];

export const CATEGORY_ICONS = [
  "🍽️", "🏠", "🚗", "❤️", "🎬", "🛍️", "💼", "💻", "📈", "✨", "📦", "🐾", "emergency", "pix",
];
