// Tipos compartilhados pelas telas e pelos dados financeiros.
export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  description: string;
  category: string;
  categoryId?: string;
  transaction_date: string;
  amount: number;
  type: TransactionType;
  isSettled?: boolean;
  accountId?: string;
  creditCardId?: string;
  creditCardKind?: "purchase" | "payment";
  cashBoxId?: string;
  cashBoxKind?: "deposit" | "withdrawal";
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
};

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  emoji: string;
};

export type Account = {
  id: string;
  name: string;
  institution: string;
  bankId?: string;
  balance: number;
};

export type CustomBank = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type CreditCardItem = {
  id: string;
  name: string;
  issuer: string;
  bankId?: string;
  creditLimit: number;
  lastFour?: string;
  closingDay?: number;
  dueDay?: number;
};

export type DashboardWidget = "cards" | "goals";

export type BudgetPlan = {
  id: string;
  category: string;
  categoryId?: string;
  limit: number;
};

export type FinancialGoal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string;
};

export type CashBox = {
  id: string;
  name: string;
};

export type Totals = { income: number; expenses: number; balance: number };

export type FinanceNotification = {
  id: string;
  title: string;
  message: string;
  tone: "danger" | "warning" | "success" | "neutral";
  actionLabel?: string;
  transactionId?: string;
};
