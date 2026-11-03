import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CATEGORIES } from "../data/categories";
import { supabase } from "../lib/supabase";
import type { Account, BudgetPlan, CashBox, CashBoxDeposit, Category, CreditCardItem, CustomBank, DashboardWidget, FinancialGoal, Transaction } from "../types/finance";
import type { PostgrestError } from "@supabase/supabase-js";

const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = ["cards", "goals"];

// Carrega e sincroniza exclusivamente os dados da conta autenticada.
export function useFinanceData(onError: (message: string) => void, userId: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CreditCardItem[]>([]);
  const [customBanks, setCustomBanks] = useState<CustomBank[]>([]);
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [cashBoxDeposits, setCashBoxDeposits] = useState<CashBoxDeposit[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(DEFAULT_DASHBOARD_WIDGETS);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [cashBoxSchemaReady, setCashBoxSchemaReady] = useState(true);
  const queues = useRef<Record<string, Promise<void>>>({});

  useEffect(() => {
    if (!userId || !supabase) return;
    let active = true;
    setLoadError("");
    const client = supabase;
    void (async () => {
      const results = await Promise.all([
        client.from("transactions").select("*").order("transaction_date", { ascending: false }),
        client.from("categories").select("*").order("name"),
        client.from("accounts").select("*").order("created_at", { ascending: false }),
        client.from("credit_cards").select("*").order("created_at", { ascending: false }),
        client.from("custom_banks").select("*").order("name"),
        client.from("budgets").select("*").order("category"),
        client.from("financial_goals").select("*").order("created_at", { ascending: false }),
        client.from("cash_boxes").select("*").order("created_at", { ascending: false }),
        client.from("cash_box_deposits").select("*").order("created_at", { ascending: false }),
        client.from("user_settings").select("*").maybeSingle(),
      ]);
      const cashBoxSchemaMissing = results.slice(7, 9).some((result) =>
        result.error && isMissingCashBoxTable(result.error),
      );
      const failed = results.find((result, index) =>
        result.error && !(cashBoxSchemaMissing && index >= 7 && index <= 8),
      );
      if (failed?.error) throw failed.error;
      if (!active) return;
      const [transactionRows, categoryRows, accountRows, cardRows, bankRows, budgetRows, goalRows, cashBoxRows, cashBoxDepositRows, settingsRows] = results;
      setCashBoxSchemaReady(!cashBoxSchemaMissing);
      const savedCategories = (categoryRows.data ?? []).map((row): Category => ({
        id: row.id, name: row.name, type: row.type, color: row.color, emoji: row.emoji,
      }));
      const loadedCategories = savedCategories.length
        ? [
          ...savedCategories,
          ...DEFAULT_CATEGORIES.filter((category) =>
            !savedCategories.some((saved) => saved.type === category.type),
          ),
        ]
        : DEFAULT_CATEGORIES;
      setCategories(loadedCategories);
      setTransactions((transactionRows.data ?? []).map((row): Transaction => ({
        id: row.id, description: row.description, category: row.category,
        ...(row.category_id
          ? { categoryId: row.category_id }
          : { categoryId: loadedCategories.find((category) => category.name === row.category && category.type === row.type)?.id }),
        transaction_date: row.transaction_date, amount: Number(row.amount), type: row.type,
        isSettled: row.is_settled ?? true,
        ...(row.account_id ? { accountId: row.account_id } : {}),
        ...(row.credit_card_id ? { creditCardId: row.credit_card_id } : {}),
        ...(row.credit_card_kind ? { creditCardKind: row.credit_card_kind } : {}),
        ...(row.installment_group_id ? { installmentGroupId: row.installment_group_id } : {}),
        ...(row.installment_number ? { installmentNumber: row.installment_number } : {}),
        ...(row.installment_count ? { installmentCount: row.installment_count } : {}),
      })));
      setAccounts((accountRows.data ?? []).map((row): Account => ({
        id: row.id, name: row.name, institution: row.institution, bankId: row.bank_id, balance: Number(row.balance),
      })));
      setCards((cardRows.data ?? []).map((row): CreditCardItem => ({
        id: row.id, name: row.name, issuer: row.issuer, bankId: row.bank_id, lastFour: row.last_four,
        creditLimit: Number(row.credit_limit), closingDay: row.closing_day, dueDay: row.due_day,
      })));
      setCustomBanks((bankRows.data ?? []).map((row): CustomBank => ({
        id: row.id, name: row.name, emoji: row.emoji, color: row.color,
      })));
      setPlans((budgetRows.data ?? []).map((row): BudgetPlan => ({
        id: row.id,
        category: row.category,
        ...(row.category_id
          ? { categoryId: row.category_id }
          : { categoryId: loadedCategories.find((category) => category.name === row.category && category.type === "expense")?.id }),
        limit: Number(row.monthly_limit),
      })));
      setGoals((goalRows.data ?? []).map((row): FinancialGoal => ({
        id: row.id, name: row.name, target: Number(row.target), saved: Number(row.saved), deadline: row.deadline ?? "",
      })));
      setCashBoxes((cashBoxRows.data ?? []).map((row): CashBox => ({ id: row.id, name: row.name })));
      setCashBoxDeposits((cashBoxDepositRows.data ?? []).map((row): CashBoxDeposit => ({
        id: row.id,
        cashBoxId: row.cash_box_id,
        accountId: row.account_id,
        amount: Number(row.amount),
        createdAt: row.created_at,
      })));
      setMonthlyBudget(settingsRows.data?.monthly_budget === null || settingsRows.data?.monthly_budget === undefined
        ? null
        : Number(settingsRows.data.monthly_budget));
      setDarkMode(settingsRows.data?.dark_mode ?? false);
      setDashboardWidgets(normalizeDashboardWidgets(settingsRows.data?.dashboard_widgets));
      setLoadedUserId(userId);
    })().catch((reason: unknown) => {
      if (!active) return;
      const message = reason instanceof Error ? reason.message : "Não foi possível carregar os dados da conta.";
      setLoadError(message);
      onError(`Falha ao carregar os dados da nuvem: ${message}`);
    });
    return () => { active = false; };
  }, [userId, onError, setAccounts, setCards, setCategories, setCashBoxDeposits, setCashBoxes, setCustomBanks, setGoals, setPlans, setTransactions]);

  const enqueueSync = useCallback((key: string, operation: () => Promise<void>) => {
    const previous = queues.current[key] ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation).catch((reason: unknown) => {
      const detail = reason instanceof Error ? reason.message : "erro desconhecido";
      if (key === "movimentações" && isMissingSettledColumn(reason)) {
        onError(
          "A movimentação não foi salva na nuvem porque falta a coluna is_settled no Supabase. "
          + "Execute supabase/migrations/20261103010000_future_transactions_settlement.sql no SQL Editor e tente novamente.",
        );
        return;
      }
      if (
        key === "movimentações"
        && isMissingAccountIdColumn(reason)
      ) {
        onError(
          "A movimentação não foi salva na nuvem porque falta a coluna account_id no Supabase. "
          + "Execute supabase/migrations/20261103000000_transactions_account_source.sql no SQL Editor e tente novamente.",
        );
        return;
      }
      onError(`Não foi possível sincronizar ${key} com a nuvem: ${detail}`);
    });
    queues.current[key] = next;
  }, [onError]);

  const cloudReady = Boolean(userId && loadedUserId === userId && !loadError && supabase);
  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    const rows = transactions.map((item) => ({
      id: item.id,
      user_id: userId,
      description: item.description,
      category: item.category,
      category_id: item.categoryId ?? null,
      transaction_date: item.transaction_date,
      amount: item.amount,
      type: item.type,
      is_settled: item.isSettled ?? true,
      account_id: item.accountId ?? null,
      credit_card_id: item.creditCardId ?? null,
      credit_card_kind: item.creditCardKind ?? null,
      installment_group_id: item.installmentGroupId ?? null,
      installment_number: item.installmentNumber ?? null,
      installment_count: item.installmentCount ?? null,
    }));
    enqueueSync("movimentações", async () => {
      await queues.current["categorias"];
      await queues.current["contas"];
      await queues.current["cartões"];
      await syncRows(
        rows,
        async () => (await client.from("transactions").upsert(rows, { onConflict: "user_id,id" })).error,
        async () => {
          const result = await client.from("transactions").select("id");
          return { ids: result.data?.map((row) => row.id) ?? [], error: result.error };
        },
        async (ids) => (await client.from("transactions").delete().in("id", ids)).error,
      );
    });
  }, [cloudReady, enqueueSync, transactions, userId]);

  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    const rows = categories.map((item) => ({ ...item, user_id: userId }));
    enqueueSync("categorias", () => syncRows(
      rows,
      async () => (await client.from("categories").upsert(rows, { onConflict: "user_id,id" })).error,
      async () => {
        const result = await client.from("categories").select("id");
        return { ids: result.data?.map((row) => row.id) ?? [], error: result.error };
      },
      async (ids) => (await client.from("categories").delete().in("id", ids)).error,
    ));
  }, [categories, cloudReady, enqueueSync, userId]);

  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    const rows = accounts.map((item) => ({ id: item.id, user_id: userId, name: item.name, institution: item.institution, bank_id: item.bankId ?? "", balance: item.balance }));
    enqueueSync("contas", () => syncRows(
      rows,
      async () => (await client.from("accounts").upsert(rows, { onConflict: "user_id,id" })).error,
      async () => { const result = await client.from("accounts").select("id"); return { ids: result.data?.map((row) => row.id) ?? [], error: result.error }; },
      async (ids) => (await client.from("accounts").delete().in("id", ids)).error,
    ));
  }, [accounts, cloudReady, enqueueSync, userId]);

  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    const rows = cards.map((item) => ({
      id: item.id, user_id: userId, name: item.name, issuer: item.issuer, bank_id: item.bankId ?? "", last_four: item.lastFour ?? "",
      credit_limit: item.creditLimit, closing_day: item.closingDay ?? 10, due_day: item.dueDay ?? 17,
    }));
    enqueueSync("cartões", () => syncRows(
      rows,
      async () => (await client.from("credit_cards").upsert(rows, { onConflict: "user_id,id" })).error,
      async () => { const result = await client.from("credit_cards").select("id"); return { ids: result.data?.map((row) => row.id) ?? [], error: result.error }; },
      async (ids) => (await client.from("credit_cards").delete().in("id", ids)).error,
    ));
  }, [cards, cloudReady, enqueueSync, userId]);

  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    const rows = customBanks.map((item) => ({ ...item, user_id: userId }));
    enqueueSync("bancos personalizados", () => syncRows(
      rows,
      async () => (await client.from("custom_banks").upsert(rows, { onConflict: "user_id,id" })).error,
      async () => { const result = await client.from("custom_banks").select("id"); return { ids: result.data?.map((row) => row.id) ?? [], error: result.error }; },
      async (ids) => (await client.from("custom_banks").delete().in("id", ids)).error,
    ));
  }, [cloudReady, customBanks, enqueueSync, userId]);

  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    const rows = plans.map((item) => ({
      id: item.id,
      user_id: userId,
      category: item.category,
      category_id: item.categoryId ?? null,
      monthly_limit: item.limit,
    }));
    enqueueSync("planejamentos", async () => {
      await queues.current["categorias"];
      await syncRows(
        rows,
        async () => (await client.from("budgets").upsert(rows, { onConflict: "user_id,id" })).error,
        async () => { const result = await client.from("budgets").select("id"); return { ids: result.data?.map((row) => row.id) ?? [], error: result.error }; },
        async (ids) => (await client.from("budgets").delete().in("id", ids)).error,
      );
    });
  }, [cloudReady, enqueueSync, plans, userId]);

  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    const rows = goals.map((item) => ({
      id: item.id, user_id: userId, name: item.name, target: item.target, saved: item.saved, deadline: item.deadline || null,
    }));
    enqueueSync("metas", () => syncRows(
      rows,
      async () => (await client.from("financial_goals").upsert(rows, { onConflict: "user_id,id" })).error,
      async () => { const result = await client.from("financial_goals").select("id"); return { ids: result.data?.map((row) => row.id) ?? [], error: result.error }; },
      async (ids) => (await client.from("financial_goals").delete().in("id", ids)).error,
    ));
  }, [cloudReady, enqueueSync, goals, userId]);

  useEffect(() => {
    if (!cloudReady || !cashBoxSchemaReady || !userId || !supabase) return;
    const client = supabase;
    const rows = cashBoxes.map((item) => ({ id: item.id, user_id: userId, name: item.name }));
    enqueueSync("caixinhas", () => syncRows(
      rows,
      async () => (await client.from("cash_boxes").upsert(rows, { onConflict: "user_id,id" })).error,
      async () => { const result = await client.from("cash_boxes").select("id"); return { ids: result.data?.map((row) => row.id) ?? [], error: result.error }; },
      async (ids) => (await client.from("cash_boxes").delete().in("id", ids)).error,
    ));
  }, [cashBoxes, cashBoxSchemaReady, cloudReady, enqueueSync, userId]);

  useEffect(() => {
    if (!cloudReady || !cashBoxSchemaReady || !userId || !supabase) return;
    const client = supabase;
    const rows = cashBoxDeposits.map((item) => ({
      id: item.id,
      user_id: userId,
      cash_box_id: item.cashBoxId,
      account_id: item.accountId,
      amount: item.amount,
    }));
    enqueueSync("aportes às caixinhas", async () => {
      await queues.current["contas"];
      await queues.current["caixinhas"];
      await syncRows(
        rows,
        async () => (await client.from("cash_box_deposits").upsert(rows, { onConflict: "user_id,id" })).error,
        async () => { const result = await client.from("cash_box_deposits").select("id"); return { ids: result.data?.map((row) => row.id) ?? [], error: result.error }; },
        async (ids) => (await client.from("cash_box_deposits").delete().in("id", ids)).error,
      );
    });
  }, [cashBoxDeposits, cashBoxSchemaReady, cloudReady, enqueueSync, userId]);

  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    enqueueSync("preferências", async () => {
      const { error } = await client.from("user_settings").upsert({
        user_id: userId, monthly_budget: monthlyBudget, dark_mode: darkMode, dashboard_widgets: dashboardWidgets,
      }, { onConflict: "user_id" });
      if (error) throw error;
    });
  }, [cloudReady, darkMode, dashboardWidgets, enqueueSync, monthlyBudget, userId]);

  return {
    transactions, setTransactions, categories, setCategories, accounts, setAccounts, cards, setCards,
    customBanks, setCustomBanks, plans, setPlans, goals, setGoals, cashBoxes, setCashBoxes,
    cashBoxDeposits, setCashBoxDeposits, monthlyBudget, setMonthlyBudget,
    darkMode, setDarkMode, dashboardWidgets, setDashboardWidgets,
    cashBoxSchemaReady, loading: Boolean(userId && loadedUserId !== userId && !loadError), loadError,
  };
}

function normalizeDashboardWidgets(value: string[] | null | undefined): DashboardWidget[] {
  if (!Array.isArray(value)) return DEFAULT_DASHBOARD_WIDGETS;
  return value.filter((item): item is DashboardWidget => item === "cards" || item === "goals");
}

function isMissingAccountIdColumn(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { code?: unknown; message?: unknown };
  return (error.code === "PGRST204" || error.code === "42703")
    && typeof error.message === "string"
    && error.message.includes("account_id");
}

function isMissingSettledColumn(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { code?: unknown; message?: unknown };
  return (error.code === "PGRST204" || error.code === "42703")
    && typeof error.message === "string"
    && error.message.includes("is_settled");
}

function isMissingCashBoxTable(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { code?: unknown; message?: unknown };
  return (error.code === "PGRST205" || error.code === "42P01")
    && typeof error.message === "string"
    && (error.message.includes("cash_boxes") || error.message.includes("cash_box_deposits"));
}

async function syncRows(
  rows: { id: string }[],
  upsert: () => Promise<PostgrestError | null>,
  fetchIds: () => Promise<{ ids: string[]; error: PostgrestError | null }>,
  removeIds: (ids: string[]) => Promise<PostgrestError | null>,
) {
  if (rows.length) {
    const error = await upsert();
    if (error) throw error;
  }
  const current = await fetchIds();
  if (current.error) throw current.error;
  const activeIds = new Set(rows.map((row) => row.id));
  const staleIds = current.ids.filter((id) => !activeIds.has(id));
  if (staleIds.length) {
    const error = await removeIds(staleIds);
    if (error) throw error;
  }
}
