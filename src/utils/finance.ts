import type { Account, CreditCardItem, Totals, Transaction } from "../types/finance";
import { localDateString } from "./format";

// Combina os saldos das contas com a movimentação líquida do mês atual.
export function calculateTotals(transactions: Transaction[], accounts: Account[] = []): Totals {
  const month = localDateString(new Date()).slice(0, 7);
  const monthly = transactions.filter((item) => item.transaction_date.startsWith(month));
  const income = monthly.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = monthly
    .filter((item) => item.type === "expense" && item.creditCardKind !== "purchase")
    .reduce((sum, item) => sum + item.amount, 0);
  const accountBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  return { income, expenses, balance: accountBalance + income - expenses };
}

export function getCardUsage(card: CreditCardItem, transactions: Transaction[]) {
  const purchases = transactions
    .filter((item) => item.creditCardId === card.id && item.creditCardKind === "purchase")
    .reduce((sum, item) => sum + item.amount, 0);
  const payments = transactions
    .filter((item) => item.creditCardId === card.id && item.creditCardKind === "payment")
    .reduce((sum, item) => sum + item.amount, 0);
  const used = Math.max(0, purchases - payments);
  return {
    used,
    available: Math.max(0, card.creditLimit - used),
    progress: card.creditLimit > 0 ? Math.min(100, (used / card.creditLimit) * 100) : 0,
  };
}
