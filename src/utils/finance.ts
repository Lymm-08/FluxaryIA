import type { Account, CreditCardItem, Totals, Transaction } from "../types/finance";
import { localDateString } from "./format";

// Calcula o saldo atual das contas a partir do saldo inicial e seus lançamentos.
export function getAccountBalance(account: Account, transactions: Transaction[]) {
  const movement = transactions
    .filter((item) => item.isSettled !== false && item.accountId === account.id && item.creditCardKind !== "purchase")
    .reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);
  return account.balance + movement;
}

export function resetMonthlyFinance(
  transactions: Transaction[],
  accounts: Account[],
  month: string,
  deleteCardHistory: boolean,
) {
  const remainingTransactions = transactions.filter((item) => {
    const isCardTransaction = Boolean(item.creditCardId || item.creditCardKind);
    if (deleteCardHistory && isCardTransaction) return false;
    return !item.transaction_date.startsWith(month)
      || Boolean(item.cashBoxKind)
      || (!deleteCardHistory && isCardTransaction);
  });
  const resetAccounts = accounts.map((account) => ({
    ...account,
    balance: account.balance - getAccountBalance(account, remainingTransactions),
  }));
  return { transactions: remainingTransactions, accounts: resetAccounts };
}

// Combina saldos líquidos das contas com lançamentos do mês sem conta associada.
export function calculateTotals(transactions: Transaction[], accounts: Account[] = []): Totals {
  const month = localDateString(new Date()).slice(0, 7);
  const monthly = transactions.filter((item) => item.isSettled !== false && item.transaction_date.startsWith(month));
  const income = monthly.filter((item) => item.type === "income" && !item.cashBoxKind).reduce((sum, item) => sum + item.amount, 0);
  const expenses = monthly
    .filter((item) => item.type === "expense" && item.creditCardKind !== "purchase" && !item.cashBoxKind)
    .reduce((sum, item) => sum + item.amount, 0);
  const accountBalance = accounts.reduce((sum, account) => sum + getAccountBalance(account, transactions), 0);
  const unassignedMonthlyNet = monthly
    .filter((item) => !item.accountId && item.creditCardKind !== "purchase" && !item.cashBoxKind)
    .reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);
  return { income, expenses, balance: accountBalance + unassignedMonthlyNet };
}

export function calculateProjectedBalance(transactions: Transaction[], accounts: Account[], cards: CreditCardItem[]) {
  const actualBalance = calculateTotals(transactions, accounts).balance;
  const plannedBalanceChange = transactions
    .filter((item) => item.isSettled === false)
    .filter((item) => item.creditCardKind !== "payment" && item.creditCardKind !== "purchase" && !item.cashBoxKind)
    .reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0);
  const unpaidCardBalances = cards.reduce((sum, card) => sum + getCardInvoiceBalance(card, transactions), 0);
  return actualBalance + plannedBalanceChange - unpaidCardBalances;
}

export function getCashBoxBalance(cashBoxId: string, transactions: Transaction[]) {
  return transactions
    .filter((item) => item.cashBoxId === cashBoxId && item.cashBoxKind && item.isSettled !== false)
    .reduce((sum, item) => sum + (item.cashBoxKind === "deposit" ? item.amount : -item.amount), 0);
}

export function getCardUsage(card: CreditCardItem, transactions: Transaction[]) {
  const purchases = transactions
    .filter((item) => item.creditCardId === card.id && item.creditCardKind === "purchase")
    .reduce((sum, item) => sum + item.amount, 0);
  const settledPayments = transactions
    .filter((item) => item.isSettled !== false && item.creditCardId === card.id && item.creditCardKind === "payment")
    .reduce((sum, item) => sum + item.amount, 0);
  const used = Math.max(0, purchases - settledPayments);
  return {
    used,
    available: card.creditLimit - used,
    progress: card.creditLimit > 0 ? Math.min(100, (used / card.creditLimit) * 100) : 0,
  };
}

// Agendamentos reservam limite, mas ainda não fazem parte do valor pagável da fatura.
export function getCardInvoiceBalance(card: CreditCardItem, transactions: Transaction[]) {
  const purchases = transactions
    .filter((item) => item.isSettled !== false && item.creditCardId === card.id && item.creditCardKind === "purchase")
    .reduce((sum, item) => sum + item.amount, 0);
  const payments = transactions
    .filter((item) => item.isSettled !== false && item.creditCardId === card.id && item.creditCardKind === "payment")
    .reduce((sum, item) => sum + item.amount, 0);
  return Math.max(0, purchases - payments);
}

export type CardBillingNotice = {
  tone: "danger" | "warning" | "success" | "neutral";
  title: string;
  message: string;
};

export function getCardBillingNotice(card: CreditCardItem, transactions: Transaction[], today = new Date(), showAmounts = true): CardBillingNotice {
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const closingDay = Math.min(31, Math.max(1, card.closingDay ?? 10));
  const dueDay = Math.min(31, Math.max(1, card.dueDay ?? 17));
  const closingThisMonth = dateAtDay(currentDate.getFullYear(), currentDate.getMonth(), closingDay);
  const lastClosing = closingThisMonth <= currentDate
    ? closingThisMonth
    : dateAtDay(currentDate.getFullYear(), currentDate.getMonth() - 1, closingDay);
  const nextClosing = closingThisMonth >= currentDate
    ? closingThisMonth
    : dateAtDay(currentDate.getFullYear(), currentDate.getMonth() + 1, closingDay);
  const lastDue = dueDateForClosing(lastClosing, closingDay, dueDay);
  const upcomingDue = dueDateForClosing(nextClosing, closingDay, dueDay);
  const balanceAtLastDue = transactions
    .filter((item) =>
      item.creditCardId === card.id
      && item.isSettled !== false
      && (
        (item.creditCardKind === "purchase" && item.transaction_date <= localDateString(lastClosing))
        || item.creditCardKind === "payment"
      ),
    )
    .reduce((balance, item) => balance + (item.creditCardKind === "purchase" ? item.amount : -item.amount), 0);
  const outstanding = getCardInvoiceBalance(card, transactions);
  const dueToReport = lastDue >= currentDate ? lastDue : upcomingDue;
  const dueBalance = lastDue >= currentDate ? balanceAtLastDue : outstanding;

  if (lastDue < currentDate && balanceAtLastDue > 0) {
    return {
      tone: "danger",
      title: "Fatura vencida",
      message: showAmounts
        ? `Venceu em ${formatShortDate(lastDue)}; ${moneyLabel(balanceAtLastDue)} ainda está em aberto.`
        : `Venceu em ${formatShortDate(lastDue)} e ainda há saldo em aberto.`,
    };
  }

  if (lastClosing.getTime() === currentDate.getTime()) {
    return {
      tone: "success",
      title: "Fatura fechou hoje",
      message: `O vencimento desta fatura será em ${formatShortDate(upcomingDue)}.`,
    };
  }

  const daysUntilDue = Math.ceil((dueToReport.getTime() - currentDate.getTime()) / 86400000);
  if (dueBalance > 0 && daysUntilDue >= 0 && daysUntilDue <= 7) {
    return {
      tone: "warning",
      title: daysUntilDue === 0 ? "Fatura vence hoje" : `Fatura vence em ${daysUntilDue} ${daysUntilDue === 1 ? "dia" : "dias"}`,
      message: showAmounts
        ? `Vencimento em ${formatShortDate(dueToReport)}. Confira o saldo em aberto de ${moneyLabel(dueBalance)}.`
        : `Vencimento em ${formatShortDate(dueToReport)}. Confira o saldo em aberto.`,
    };
  }

  return {
    tone: "neutral",
    title: lastClosing < currentDate && lastDue >= currentDate
      ? `Fatura fechada em ${formatShortDate(lastClosing)}`
      : `Fechamento em ${formatShortDate(nextClosing)}`,
    message: lastClosing < currentDate && lastDue >= currentDate
      ? `O vencimento desta fatura será em ${formatShortDate(lastDue)}.`
      : `O próximo vencimento será em ${formatShortDate(dueToReport)}.`,
  };
}

function dateAtDay(year: number, month: number, day: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(firstDay.getFullYear(), firstDay.getMonth(), Math.min(day, lastDay));
}

function dueDateForClosing(closingDate: Date, closingDay: number, dueDay: number) {
  const dueMonthOffset = dueDay <= closingDay ? 1 : 0;
  return dateAtDay(closingDate.getFullYear(), closingDate.getMonth() + dueMonthOffset, dueDay);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function moneyLabel(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}
