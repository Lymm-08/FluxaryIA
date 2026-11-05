import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CATEGORIES } from "../data/categories";
import { supabase } from "../lib/supabase";
import type { Account, BudgetPlan, CashBox, Category, CreditCardItem, CustomBank, DashboardWidget, FinancialGoal, Transaction } from "../types/finance";
import type { PostgrestError } from "@supabase/supabase-js";
import { formatErrorDetails } from "../utils/errors";

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
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(DEFAULT_DASHBOARD_WIDGETS);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [cashBoxSchemaReady, setCashBoxSchemaReady] = useState(true);
  const queues = useRef<Record<string, Promise<void>>>({});
  const currentUserId = useRef(userId);
  const syncedCashBoxMovementIds = useRef(new Set<string>());
  const skipNextTransactionSync = useRef(false);
  currentUserId.current = userId;

  useEffect(() => {
    if (!userId || !supabase) return;
    let active = true;
    setLoadError("");
    syncedCashBoxMovementIds.current.clear();
    const client = supabase;
    void (async () => {
      const transactionRows = await loadAllTransactions(client);
      const results = await Promise.all([
        client.from("categories").select("*").order("name"),
        client.from("accounts").select("*").order("created_at", { ascending: false }),
        client.from("credit_cards").select("*").order("created_at", { ascending: false }),
        client.from("custom_banks").select("*").order("name"),
        client.from("budgets").select("*").order("category"),
        client.from("financial_goals").select("*").order("created_at", { ascending: false }),
        client.from("cash_boxes").select("*").order("created_at", { ascending: false }),
        client.from("transactions").select("cash_box_id,cash_box_kind").limit(1),
        client.from("user_settings").select("*").maybeSingle(),
      ]);
      const cashBoxSchemaMissing = Boolean(results[6].error && isMissingCashBoxTable(results[6].error))
        || Boolean(results[7].error && isMissingCashBoxMovementColumns(results[7].error));
      const failed = results.find((result, index) =>
        result.error && !(cashBoxSchemaMissing && (index === 6 || index === 7)),
      );
      if (failed?.error) throw failed.error;
      if (!active) return;
      const [categoryRows, accountRows, cardRows, bankRows, budgetRows, goalRows, cashBoxRows, , settingsRows] = results;
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
        ...(row.cash_box_id && row.cash_box_kind ? { cashBoxId: row.cash_box_id, cashBoxKind: row.cash_box_kind } : {}),
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
      setMonthlyBudget(settingsRows.data?.monthly_budget === null || settingsRows.data?.monthly_budget === undefined
        ? null
        : Number(settingsRows.data.monthly_budget));
      setDarkMode(settingsRows.data?.dark_mode ?? false);
      setDashboardWidgets(normalizeDashboardWidgets(settingsRows.data?.dashboard_widgets));
      setLoadedUserId(userId);
    })().catch((reason: unknown) => {
      if (!active) return;
      const message = formatErrorDetails(reason, "Não foi possível carregar os dados da conta.");
      setLoadError(message);
      onError(`Falha ao carregar os dados da nuvem: ${message}`);
    });
    return () => { active = false; };
  }, [userId, onError, setAccounts, setCards, setCategories, setCashBoxes, setCustomBanks, setGoals, setPlans, setTransactions]);

  const schedule = useCallback((key: string, operation: () => Promise<void>) => {
    const previous = queues.current[key] ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(operation);
    queues.current[key] = next.then(() => undefined, () => undefined);
    return next;
  }, []);

  const enqueueSync = useCallback((key: string, operation: () => Promise<void>) => {
    void schedule(key, operation).catch((reason: unknown) => {
      const detail = formatErrorDetails(reason, "erro desconhecido");
      if (key === "movimentações" && isMissingSettledColumn(reason)) {
        onError(
          "A movimentação não foi salva na nuvem porque falta a coluna is_settled no Supabase. "
          + "Execute supabase/migrations/20261103010000_future_transactions_settlement.sql no SQL Editor e tente novamente. "
          + `Detalhes: ${detail}`,
        );
        return;
      }
      if (
        key === "movimentações"
        && isMissingAccountIdColumn(reason)
      ) {
        onError(
          "A movimentação não foi salva na nuvem porque falta a coluna account_id no Supabase. "
          + "Execute supabase/migrations/20261103000000_transactions_account_source.sql no SQL Editor e tente novamente. "
          + `Detalhes: ${detail}`,
        );
        return;
      }
      if (key === "movimentações" && isMissingCashBoxMovementColumns(reason)) {
        onError(
          "A movimentação não foi salva na nuvem porque faltam as colunas de Caixinhas em transactions. "
          + "Execute supabase/migrations/20261103030000_cash_box_withdrawals.sql no SQL Editor. "
          + `Detalhes: ${detail}`,
        );
        return;
      }
      onError(`Não foi possível sincronizar ${key} com a nuvem: ${detail}`);
    });
  }, [onError, schedule]);

  const cloudReady = Boolean(userId && loadedUserId === userId && !loadError && supabase);
  useEffect(() => {
    if (!cloudReady || !userId || !supabase) return;
    if (skipNextTransactionSync.current) {
      skipNextTransactionSync.current = false;
      return;
    }
    const client = supabase;
    const rows = transactions
      .filter((item) => !syncedCashBoxMovementIds.current.has(item.id))
      .map((item) => transactionRow(item, userId, cashBoxSchemaReady));
    enqueueSync("movimentações", async () => {
      await queues.current["categorias"];
      await queues.current["contas"];
      await queues.current["cartões"];
      await queues.current["caixinhas"];
      await upsertRows(rows, async () => (await client.from("transactions").upsert(rows, { onConflict: "user_id,id" })).error);
    });
  }, [cashBoxSchemaReady, cloudReady, enqueueSync, transactions, userId, syncedCashBoxMovementIds]);

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
    if (!cloudReady || !userId || !supabase) return;
    const client = supabase;
    enqueueSync("preferências", async () => {
      const { error } = await client.from("user_settings").upsert({
        user_id: userId, monthly_budget: monthlyBudget, dark_mode: darkMode, dashboard_widgets: dashboardWidgets,
      }, { onConflict: "user_id" });
      if (error) throw error;
    });
  }, [cloudReady, darkMode, dashboardWidgets, enqueueSync, monthlyBudget, userId]);

  const saveCashBox = useCallback(async (cashBox: CashBox) => {
    if (!cloudReady || !userId || !supabase || !cashBoxSchemaReady) {
      throw new Error("As caixinhas ainda não estão prontas para sincronização.");
    }
    const client = supabase;
    await schedule("caixinhas", async () => {
      const { error } = await client.from("cash_boxes").upsert(
        { id: cashBox.id, user_id: userId, name: cashBox.name },
        { onConflict: "user_id,id" },
      );
      if (error) throw error;
      if (currentUserId.current === userId) {
        setCashBoxes((current) => upsert(current, cashBox));
      }
    });
  }, [cashBoxSchemaReady, cloudReady, schedule, userId]);

  const deleteCashBox = useCallback(async (cashBoxId: string) => {
    if (!cloudReady || !userId || !supabase || !cashBoxSchemaReady) {
      throw new Error("As caixinhas ainda não estão prontas para sincronização.");
    }
    const client = supabase;
    await schedule("caixinhas", async () => {
      const { error } = await client.from("cash_boxes").delete().eq("id", cashBoxId);
      if (error) throw error;
      if (currentUserId.current === userId) {
        setCashBoxes((current) => current.filter((cashBox) => cashBox.id !== cashBoxId));
      }
    });
  }, [cashBoxSchemaReady, cloudReady, schedule, userId]);

  const saveCashBoxMovement = useCallback(async (transaction: Transaction) => {
    if (!cloudReady || !userId || !supabase || !cashBoxSchemaReady) {
      throw new Error("As caixinhas ainda não estão prontas para sincronização.");
    }
    validateCashBoxMovement(transaction);
    const client = supabase;
    await schedule("movimentações", async () => {
      await queues.current["caixinhas"];
      const { error } = await client.from("transactions").upsert(
        transactionRow(transaction, userId),
        { onConflict: "user_id,id" },
      );
      if (error) throw error;
      if (currentUserId.current === userId) {
        syncedCashBoxMovementIds.current.add(transaction.id);
        skipNextTransactionSync.current = true;
        setTransactions((current) => upsert(current, transaction));
      }
    });
  }, [cashBoxSchemaReady, cloudReady, schedule, userId]);

  const deleteTransactions = useCallback(async (transactionIds: string[]) => {
    const ids = [...new Set(transactionIds)];
    if (!ids.length) return;
    if (!cloudReady || !userId || !supabase) {
      throw new Error("As movimentações ainda não estão prontas para sincronização.");
    }
    const client = supabase;
    await schedule("movimentações", async () => {
      const { error } = await client.from("transactions").delete().in("id", ids);
      if (error) throw error;
      if (currentUserId.current === userId) {
        ids.forEach((id) => syncedCashBoxMovementIds.current.delete(id));
        skipNextTransactionSync.current = true;
        setTransactions((current) => current.filter((transaction) => !ids.includes(transaction.id)));
      }
    });
  }, [cloudReady, schedule, userId]);

  return {
    transactions, setTransactions, categories, setCategories, accounts, setAccounts, cards, setCards,
    customBanks, setCustomBanks, plans, setPlans, goals, setGoals, cashBoxes, setCashBoxes,
    monthlyBudget, setMonthlyBudget,
    darkMode, setDarkMode, dashboardWidgets, setDashboardWidgets,
    cashBoxSchemaReady, loading: Boolean(userId && loadedUserId !== userId && !loadError), loadError,
    saveCashBox, deleteCashBox, saveCashBoxMovement, deleteTransactions,
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
    && error.message.includes("cash_boxes");
}

function isMissingCashBoxMovementColumns(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const error = reason as { code?: unknown; message?: unknown };
  return (error.code === "PGRST204" || error.code === "42703")
    && typeof error.message === "string"
    && (error.message.includes("cash_box_id") || error.message.includes("cash_box_kind"));
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

async function upsertRows(
  rows: { id: string }[],
  upsert: () => Promise<PostgrestError | null>,
) {
  if (!rows.length) return;
  const error = await upsert();
  if (error) throw error;
}

async function loadAllTransactions(client: NonNullable<typeof supabase>) {
  const pageSize = 500;
  const rows: Awaited<ReturnType<typeof fetchTransactionPage>> = [];
  for (let from = 0; ; ) {
    const page = await fetchTransactionPage(client, from, from + pageSize - 1);
    if (!page.length) return { data: rows, error: null };
    rows.push(...page);
    from += page.length;
  }
}

async function fetchTransactionPage(
  client: NonNullable<typeof supabase>,
  from: number,
  to: number,
) {
  const { data, error } = await client.from("transactions")
    .select("*")
    .order("transaction_date", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return data ?? [];
}

function transactionRow(transaction: Transaction, userId: string, includeCashBoxColumns = true) {
  return {
    id: transaction.id,
    user_id: userId,
    description: transaction.description,
    category: transaction.category,
    category_id: transaction.categoryId ?? null,
    transaction_date: transaction.transaction_date,
    amount: transaction.amount,
    type: transaction.type,
    is_settled: transaction.isSettled ?? true,
    account_id: transaction.accountId ?? null,
    credit_card_id: transaction.creditCardId ?? null,
    credit_card_kind: transaction.creditCardKind ?? null,
    ...(includeCashBoxColumns ? {
      cash_box_id: transaction.cashBoxId ?? null,
      cash_box_kind: transaction.cashBoxKind ?? null,
    } : {}),
    installment_group_id: transaction.installmentGroupId ?? null,
    installment_number: transaction.installmentNumber ?? null,
    installment_count: transaction.installmentCount ?? null,
  };
}

function validateCashBoxMovement(transaction: Transaction) {
  if (
    !transaction.id
    || !transaction.cashBoxId
    || !transaction.accountId
    || !transaction.cashBoxKind
    || transaction.isSettled === false
    || !Number.isFinite(transaction.amount)
    || transaction.amount <= 0
    || Math.round(transaction.amount * 100) !== transaction.amount * 100
    || transaction.amount > 999999999999.99
    || (transaction.cashBoxKind === "deposit" && transaction.type !== "expense")
    || (transaction.cashBoxKind === "withdrawal" && transaction.type !== "income")
    || transaction.creditCardId
    || transaction.creditCardKind
  ) {
    throw new Error("Os dados da movimentação da caixinha são inválidos.");
  }
}

function upsert<T extends { id: string }>(items: T[], next: T) {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => item.id === next.id ? next : item)
    : [next, ...items];
}
