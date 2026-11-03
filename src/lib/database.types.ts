// Tipos alinhados ao schema consolidado e às migrations internas.
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type OwnedRow = { id: string; user_id: string; created_at: string; updated_at: string };

export type TransactionRow = OwnedRow & {
  description: string; category: string; category_id: string | null; transaction_date: string; amount: number; type: "income" | "expense"; is_settled: boolean;
  account_id: string | null; credit_card_id: string | null; credit_card_kind: "purchase" | "payment" | null;
  cash_box_id: string | null; cash_box_kind: "deposit" | "withdrawal" | null;
  installment_group_id: string | null; installment_number: number | null; installment_count: number | null;
};
type TransactionInsert = Omit<TransactionRow, "created_at" | "updated_at" | "cash_box_id" | "cash_box_kind"> & {
  cash_box_id?: string | null;
  cash_box_kind?: "deposit" | "withdrawal" | null;
};
export type CategoryRow = OwnedRow & {
  name: string; type: "income" | "expense"; color: string; emoji: string;
};
export type AccountRow = OwnedRow & {
  name: string; institution: string; bank_id: string; balance: number;
};
export type CreditCardRow = OwnedRow & {
  name: string; issuer: string; bank_id: string; last_four: string; credit_limit: number; closing_day: number; due_day: number;
};
export type CustomBankRow = OwnedRow & { name: string; emoji: string; color: string };
export type BudgetRow = OwnedRow & { category: string; category_id: string | null; monthly_limit: number };
export type GoalRow = OwnedRow & { name: string; target: number; saved: number; deadline: string | null };
export type CashBoxRow = OwnedRow & { name: string };
export type ProfileRow = { id: string; email: string; display_name: string; created_at: string; updated_at: string };
export type UserSettingsRow = { user_id: string; monthly_budget: number | null; dark_mode: boolean; dashboard_widgets: string[]; created_at: string; updated_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, { id: string; email: string; display_name?: string }>;
      user_settings: Table<UserSettingsRow, { user_id: string; monthly_budget?: number | null; dark_mode?: boolean; dashboard_widgets?: string[] }>;
      transactions: Table<TransactionRow, TransactionInsert>;
      categories: Table<CategoryRow, Omit<CategoryRow, "created_at" | "updated_at">>;
      accounts: Table<AccountRow, Omit<AccountRow, "created_at" | "updated_at">>;
      credit_cards: Table<CreditCardRow, Omit<CreditCardRow, "created_at" | "updated_at">>;
      custom_banks: Table<CustomBankRow, Omit<CustomBankRow, "created_at" | "updated_at">>;
      budgets: Table<BudgetRow, Omit<BudgetRow, "created_at" | "updated_at">>;
      financial_goals: Table<GoalRow, Omit<GoalRow, "created_at" | "updated_at">>;
      cash_boxes: Table<CashBoxRow, Omit<CashBoxRow, "created_at" | "updated_at">>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
