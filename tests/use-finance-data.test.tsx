import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFinanceData } from "../src/hooks/useFinanceData";
import type { Transaction } from "../src/types/finance";
import { getAccountBalance, getCashBoxBalance } from "../src/utils/finance";

const backend = vi.hoisted(() => ({
  authenticatedUserId: "user-1",
  tables: {} as Record<string, Record<string, unknown>[]>,
  operations: [] as { table: string; kind: string; rows?: Record<string, unknown>[] }[],
  nextWriteError: null as Record<string, string> | null,
  commitBeforeNextWriteError: false,
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: { from: backend.from, rpc: backend.rpc },
}));

const account = {
  id: "account-1",
  name: "Conta principal",
  institution: "Banco",
  bank_id: "",
  balance: 1000,
  user_id: "user-1",
};

const cashBox = { id: "box-1", name: "Reserva", user_id: "user-1" };

function createBuilder(table: string) {
  let action: "select" | "delete" = "select";
  let start = 0;
  let end = Number.POSITIVE_INFINITY;
  let filters: { column: string; values: unknown[] }[] = [];
  const builder = {
    select() {
      action = "select";
      return builder;
    },
    order() {
      return builder;
    },
    range(from: number, to: number) {
      start = from;
      end = to;
      return builder;
    },
    limit(limit: number) {
      end = Math.min(end, limit - 1);
      return builder;
    },
    maybeSingle() {
      const rows = visibleRows(table);
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    upsert(input: Record<string, unknown> | Record<string, unknown>[]) {
      const rows = Array.isArray(input) ? input : [input];
      backend.operations.push({ table, kind: "upsert", rows });
      const error = backend.nextWriteError;
      backend.nextWriteError = null;
      if (!error || backend.commitBeforeNextWriteError) {
        const tableRows = backend.tables[table] ?? [];
        for (const row of rows) {
          if (row.user_id !== backend.authenticatedUserId) {
            return Promise.resolve({ error: { code: "42501", message: "row-level security policy violation" } });
          }
          const index = tableRows.findIndex((saved) =>
            saved.user_id === row.user_id && saved.id === row.id,
          );
          if (index >= 0) tableRows[index] = { ...row };
          else tableRows.push({ ...row });
        }
        backend.tables[table] = tableRows;
      }
      backend.commitBeforeNextWriteError = false;
      return Promise.resolve({ error });
    },
    delete() {
      action = "delete";
      return builder;
    },
    in(column: string, values: unknown[]) {
      filters.push({ column, values });
      return executeDelete();
    },
    eq(column: string, value: unknown) {
      filters.push({ column, values: [value] });
      return executeDelete();
    },
    then(resolve: (result: { data: Record<string, unknown>[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      if (action !== "select") return Promise.reject(new Error("Unexpected query action")).then(resolve, reject);
      const rows = visibleRows(table).slice(start, end + 1);
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };

  function executeDelete() {
    backend.operations.push({ table, kind: "delete" });
    const error = backend.nextWriteError;
    backend.nextWriteError = null;
    if (error) return Promise.resolve({ error });
    const tableRows = backend.tables[table] ?? [];
    backend.tables[table] = tableRows.filter((row) =>
      row.user_id !== backend.authenticatedUserId
      || filters.some(({ column, values }) => !values.includes(row[column])),
    );
    filters = [];
    return Promise.resolve({ error: null });
  }

  return builder;
}

function visibleRows(table: string) {
  return (backend.tables[table] ?? []).filter((row) => row.user_id === backend.authenticatedUserId);
}

function deposit(id = "deposit-1"): Transaction {
  return {
    id,
    description: "Aporte: Reserva",
    category: "Caixinha",
    transaction_date: "2026-11-05",
    amount: 20,
    type: "expense",
    isSettled: true,
    accountId: account.id,
    cashBoxId: cashBox.id,
    cashBoxKind: "deposit",
  };
}

async function renderFinanceHook(userId = "user-1") {
  const reportError = vi.fn();
  const hook = renderHook(() => useFinanceData(reportError, userId));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  backend.authenticatedUserId = "user-1";
  backend.tables = {
    accounts: [{ ...account }],
    cash_boxes: [{ ...cashBox }],
    transactions: [],
    cash_box_deposits: [],
    categories: [],
    credit_cards: [],
    custom_banks: [],
    budgets: [],
    financial_goals: [],
    user_settings: [],
  };
  backend.operations = [];
  backend.nextWriteError = null;
  backend.commitBeforeNextWriteError = false;
  backend.from.mockImplementation((table: string) => createBuilder(table));
  backend.rpc.mockImplementation((functionName: string, args: Record<string, string>) => {
    backend.operations.push({ table: functionName, kind: "rpc" });
    if (
      functionName !== "delete_cash_box_preserving_history"
      && functionName !== "delete_account_preserving_history"
    ) {
      return Promise.resolve({ error: { code: "42883", message: "function not found" } });
    }
    if (!backend.authenticatedUserId) {
      return Promise.resolve({ error: { code: "42501", message: "Authentication required" } });
    }
    const isAccount = functionName === "delete_account_preserving_history";
    const table = isAccount ? "accounts" : "cash_boxes";
    const id = isAccount ? args.p_account_id : args.p_cash_box_id;
    const index = backend.tables[table].findIndex((row) =>
      row.user_id === backend.authenticatedUserId && row.id === id,
    );
    if (index < 0) {
      return Promise.resolve({ error: { code: "P0002", message: `${isAccount ? "Account" : "Cash box"} not found or not owned` } });
    }
    const error = backend.nextWriteError;
    backend.nextWriteError = null;
    if (error) return Promise.resolve({ error });

    const name = backend.tables[table][index].name;
    if (isAccount) {
      backend.tables.transactions = backend.tables.transactions.map((row) =>
        row.user_id === backend.authenticatedUserId && row.account_id === id
          ? {
            ...row,
            account_id_snapshot: row.account_id,
            account_name_snapshot: name,
            account_id: null,
          }
          : row);
      backend.tables.cash_box_deposits = backend.tables.cash_box_deposits.map((row) =>
        row.user_id === backend.authenticatedUserId && row.account_id === id
          ? {
            ...row,
            account_id_snapshot: row.account_id,
            account_name_snapshot: name,
            account_id: null,
          }
          : row,
      );
    } else {
      backend.tables.transactions = backend.tables.transactions.map((row) => row.user_id === backend.authenticatedUserId
        && row.cash_box_id === id
        ? {
        ...row,
        cash_box_id_snapshot: row.cash_box_id,
        cash_box_name_snapshot: name,
        cash_box_id: null,
      }
      : row);
      backend.tables.cash_box_deposits = backend.tables.cash_box_deposits.map((row) =>
        row.user_id === backend.authenticatedUserId && row.cash_box_id === id
          ? {
            ...row,
            cash_box_id_snapshot: row.cash_box_id,
            cash_box_name_snapshot: name,
            cash_box_id: null,
          }
          : row,
      );
    }
    backend.tables[table].splice(index, 1);
    return Promise.resolve({ data: null, error: null });
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useFinanceData cash box persistence", () => {
  it("deletes an account without movements", async () => {
    const hook = await renderFinanceHook();

    await act(async () => {
      await hook.result.current.deleteAccount(account.id);
    });

    expect(backend.tables.accounts).toEqual([]);
    expect(backend.tables.transactions).toEqual([]);
    expect(hook.result.current.accounts).toEqual([]);
    hook.unmount();
  });

  it("preserves an income transaction and its original values after account deletion and reload", async () => {
    const hook = await renderFinanceHook();
    const income: Transaction = {
      id: "income-1",
      description: "Salário",
      category: "Salário",
      transaction_date: "2026-10-12",
      amount: 1250,
      type: "income",
      accountId: account.id,
    };
    act(() => hook.result.current.setTransactions([income]));
    await waitFor(() => expect(backend.tables.transactions).toHaveLength(1));

    await act(async () => {
      await hook.result.current.deleteAccount(account.id);
    });

    expect(backend.tables.accounts).toEqual([]);
    expect(backend.tables.transactions[0]).toMatchObject({
      id: income.id,
      amount: income.amount,
      type: income.type,
      description: income.description,
      transaction_date: income.transaction_date,
      account_id: null,
      account_id_snapshot: account.id,
      account_name_snapshot: account.name,
    });
    expect(hook.result.current.transactions[0]).toMatchObject({
      ...income,
      accountId: undefined,
      accountIdSnapshot: account.id,
      accountNameSnapshot: account.name,
    });
    hook.unmount();

    const reloaded = await renderFinanceHook();
    expect(reloaded.result.current.accounts).toEqual([]);
    expect(reloaded.result.current.transactions[0]).not.toHaveProperty("accountId");
    expect(reloaded.result.current.transactions[0]).toMatchObject({
      id: income.id,
      amount: income.amount,
      type: income.type,
      description: income.description,
      transaction_date: income.transaction_date,
      accountIdSnapshot: account.id,
      accountNameSnapshot: account.name,
    });
    reloaded.unmount();
  });

  it("preserves an expense without changing the balance of another account", async () => {
    const otherAccount = { ...account, id: "account-2", name: "Poupança", balance: 800 };
    backend.tables.accounts.push({ ...otherAccount });
    const hook = await renderFinanceHook();
    const expense: Transaction = {
      id: "expense-1",
      description: "Mercado",
      category: "Alimentação",
      transaction_date: "2026-11-05",
      amount: 75.5,
      type: "expense",
      accountId: account.id,
    };
    act(() => hook.result.current.setTransactions([expense]));
    await waitFor(() => expect(backend.tables.transactions).toHaveLength(1));
    const otherAccountBalance = getAccountBalance(otherAccount, hook.result.current.transactions);

    await act(async () => {
      await hook.result.current.deleteAccount(account.id);
    });

    expect(backend.tables.transactions[0]).toMatchObject({
      id: expense.id,
      amount: expense.amount,
      type: expense.type,
      description: expense.description,
      transaction_date: expense.transaction_date,
      account_id: null,
      account_id_snapshot: account.id,
      account_name_snapshot: account.name,
    });
    expect(hook.result.current.accounts).toEqual([expect.objectContaining({ id: otherAccount.id })]);
    expect(getAccountBalance(hook.result.current.accounts[0], hook.result.current.transactions)).toBe(otherAccountBalance);
    hook.unmount();
  });

  it("preserves an income after deleting its bank account", async () => {
    const hook = await renderFinanceHook();
    const income: Transaction = {
      id: "income-1",
      description: "Pagamento",
      category: "Salário",
      transaction_date: "2026-11-04",
      amount: 2400,
      type: "income",
      accountId: account.id,
    };
    act(() => hook.result.current.setTransactions([income]));
    await waitFor(() => expect(backend.tables.transactions).toHaveLength(1));

    await act(async () => {
      await hook.result.current.deleteAccount(account.id);
    });

    expect(backend.tables.accounts).toEqual([]);
    expect(backend.tables.transactions[0]).toMatchObject({
      id: income.id,
      amount: income.amount,
      type: "income",
      description: income.description,
      transaction_date: income.transaction_date,
      account_id: null,
      account_id_snapshot: account.id,
      account_name_snapshot: account.name,
    });
    hook.unmount();
  });

  it("deletes an account with a zero balance and both income and expense history", async () => {
    const zeroBalanceAccount = { ...account, balance: 0 };
    backend.tables.accounts = [{ ...zeroBalanceAccount }];
    const hook = await renderFinanceHook();
    const transactions: Transaction[] = [
      {
        id: "zero-income",
        description: "Reembolso",
        category: "Outros",
        transaction_date: "2026-11-02",
        amount: 40,
        type: "income",
        accountId: account.id,
      },
      {
        id: "zero-expense",
        description: "Tarifa",
        category: "Outros",
        transaction_date: "2026-11-03",
        amount: 40,
        type: "expense",
        accountId: account.id,
      },
    ];
    act(() => hook.result.current.setTransactions(transactions));
    await waitFor(() => expect(backend.tables.transactions).toHaveLength(2));
    expect(getAccountBalance(zeroBalanceAccount, hook.result.current.transactions)).toBe(0);

    await act(async () => {
      await hook.result.current.deleteAccount(account.id);
    });

    expect(backend.tables.accounts).toEqual([]);
    expect(backend.tables.transactions).toHaveLength(2);
    expect(backend.tables.transactions.map((row) => row.id)).toEqual(["zero-income", "zero-expense"]);
    expect(backend.tables.transactions.every((row) =>
      row.account_id === null
      && row.account_id_snapshot === account.id
      && row.account_name_snapshot === account.name,
    )).toBe(true);
    hook.unmount();
  });

  it("preserves linked cash box history in both history models when its bank account is removed", async () => {
    const hook = await renderFinanceHook();
    const cashBoxDeposit = deposit("account-cash-box-deposit");
    await act(async () => {
      await hook.result.current.saveCashBoxMovement(cashBoxDeposit);
    });
    backend.tables.cash_box_deposits.push({
      id: "legacy-account-movement",
      user_id: "user-1",
      cash_box_id: cashBox.id,
      account_id: account.id,
      amount: 20,
      direction: "deposit",
    });

    await act(async () => {
      await hook.result.current.deleteAccount(account.id);
    });

    expect(backend.tables.transactions[0]).toMatchObject({
      account_id: null,
      account_id_snapshot: account.id,
      account_name_snapshot: account.name,
      cash_box_id: cashBox.id,
      cash_box_kind: "deposit",
    });
    expect(backend.tables.cash_box_deposits[0]).toMatchObject({
      account_id: null,
      account_id_snapshot: account.id,
      account_name_snapshot: account.name,
      cash_box_id: cashBox.id,
    });
    expect(getCashBoxBalance(cashBox.id, hook.result.current.transactions)).toBe(20);
    hook.unmount();
  });

  it("keeps all account and historical rows when the RPC fails", async () => {
    const hook = await renderFinanceHook();
    const transaction = {
      id: "rollback-income",
      description: "Salário",
      category: "Salário",
      transaction_date: "2026-11-05",
      amount: 200,
      type: "income" as const,
      accountId: account.id,
    };
    act(() => hook.result.current.setTransactions([transaction]));
    await waitFor(() => expect(backend.tables.transactions).toHaveLength(1));
    backend.nextWriteError = { code: "08006", message: "injected database failure" };

    await expect(act(async () => {
      await hook.result.current.deleteAccount(account.id);
    })).rejects.toMatchObject({ code: "08006" });

    expect(backend.tables.accounts).toHaveLength(1);
    expect(backend.tables.transactions[0]).toMatchObject({ account_id: account.id });
    expect(backend.tables.transactions[0].account_id_snapshot).toBeNull();
    expect(hook.result.current.accounts).toHaveLength(1);
    expect(hook.result.current.transactions[0]).toMatchObject(transaction);
    hook.unmount();
  });

  it("does not allow deleting another user's bank account", async () => {
    backend.tables.accounts.push({ ...account, id: "foreign-account", user_id: "user-2" });
    const hook = await renderFinanceHook();

    await expect(act(async () => {
      await hook.result.current.deleteAccount("foreign-account");
    })).rejects.toMatchObject({ code: "P0002" });

    expect(backend.tables.accounts).toContainEqual(expect.objectContaining({
      id: "foreign-account",
      user_id: "user-2",
    }));
    hook.unmount();
  });

  it("continues creating, editing, and saving transactions for bank accounts", async () => {
    const hook = await renderFinanceHook();
    await act(async () => {
      hook.result.current.setAccounts((current) => [...current, {
        id: "new-account",
        name: "Conta nova",
        institution: "Banco",
        balance: 250,
      }]);
    });
    await waitFor(() => expect(backend.tables.accounts).toContainEqual(expect.objectContaining({
      id: "new-account",
      name: "Conta nova",
    })));

    await act(async () => {
      hook.result.current.setAccounts((current) => current.map((item) =>
        item.id === "new-account" ? { ...item, name: "Conta atualizada", balance: 300 } : item,
      ));
    });
    await waitFor(() => expect(backend.tables.accounts).toContainEqual(expect.objectContaining({
      id: "new-account",
      name: "Conta atualizada",
      balance: 300,
    })));

    const transaction: Transaction = {
      id: "new-account-expense",
      description: "Compra",
      category: "Outros",
      transaction_date: "2026-11-05",
      amount: 15,
      type: "expense",
      accountId: "new-account",
    };
    act(() => hook.result.current.setTransactions([transaction]));
    await waitFor(() => expect(backend.tables.transactions).toContainEqual(expect.objectContaining({
      id: transaction.id,
      account_id: "new-account",
    })));
    hook.unmount();
  });

  it("deletes a cash box without movements", async () => {
    const hook = await renderFinanceHook();

    await act(async () => {
      await hook.result.current.deleteCashBox(cashBox.id);
    });

    expect(backend.tables.cash_boxes).toEqual([]);
    expect(backend.tables.transactions).toEqual([]);
    expect(backend.operations).toContainEqual({
      table: "delete_cash_box_preserving_history",
      kind: "rpc",
    });
    hook.unmount();
  });

  it("deletes a cash box with a deposit while preserving its historical values", async () => {
    const hook = await renderFinanceHook();
    await act(async () => {
      await hook.result.current.saveCashBoxMovement(deposit());
    });
    const accountBalanceBeforeDelete = getAccountBalance(hook.result.current.accounts[0], hook.result.current.transactions);

    await act(async () => {
      await hook.result.current.deleteCashBox(cashBox.id);
    });

    expect(backend.tables.cash_boxes).toEqual([]);
    expect(backend.tables.transactions).toHaveLength(1);
    expect(backend.tables.transactions[0]).toMatchObject({
      id: "deposit-1",
      amount: 20,
      type: "expense",
      description: "Aporte: Reserva",
      transaction_date: "2026-11-05",
      cash_box_id: null,
      cash_box_id_snapshot: cashBox.id,
      cash_box_name_snapshot: cashBox.name,
    });
    expect(getAccountBalance(hook.result.current.accounts[0], hook.result.current.transactions)).toBe(accountBalanceBeforeDelete);

    hook.unmount();
    const reloaded = await renderFinanceHook();
    expect(reloaded.result.current.cashBoxes).toEqual([]);
    expect(reloaded.result.current.transactions[0]).not.toHaveProperty("cashBoxId");
    expect(reloaded.result.current.transactions[0]).toMatchObject({
      cashBoxIdSnapshot: cashBox.id,
      cashBoxNameSnapshot: cashBox.name,
      cashBoxKind: "deposit",
      amount: 20,
    });
    expect(getAccountBalance(reloaded.result.current.accounts[0], reloaded.result.current.transactions)).toBe(accountBalanceBeforeDelete);
    reloaded.unmount();
  });

  it("deletes a cash box with both deposit and withdrawal, preserving transaction and legacy histories", async () => {
    const hook = await renderFinanceHook();
    const withdrawal: Transaction = {
      ...deposit("withdrawal-1"),
      description: "Retirada: Reserva",
      amount: 5,
      type: "income",
      cashBoxKind: "withdrawal",
    };
    await act(async () => {
      await hook.result.current.saveCashBoxMovement(deposit());
      await hook.result.current.saveCashBoxMovement(withdrawal);
    });
    backend.tables.cash_box_deposits.push({
      id: "legacy-deposit",
      user_id: "user-1",
      cash_box_id: cashBox.id,
      account_id: account.id,
      amount: 10,
      direction: "deposit",
    });
    const accountBalanceBeforeDelete = getAccountBalance(hook.result.current.accounts[0], hook.result.current.transactions);

    await act(async () => {
      await hook.result.current.deleteCashBox(cashBox.id);
    });

    expect(backend.tables.transactions).toHaveLength(2);
    expect(backend.tables.transactions.map((row) => ({
      id: row.id,
      amount: row.amount,
      type: row.type,
      description: row.description,
      transaction_date: row.transaction_date,
      cash_box_id: row.cash_box_id,
      cash_box_id_snapshot: row.cash_box_id_snapshot,
      cash_box_name_snapshot: row.cash_box_name_snapshot,
    }))).toEqual([
      {
        id: "deposit-1",
        amount: 20,
        type: "expense",
        description: "Aporte: Reserva",
        transaction_date: "2026-11-05",
        cash_box_id: null,
        cash_box_id_snapshot: cashBox.id,
        cash_box_name_snapshot: "Reserva",
      },
      {
        id: "withdrawal-1",
        amount: 5,
        type: "income",
        description: "Retirada: Reserva",
        transaction_date: "2026-11-05",
        cash_box_id: null,
        cash_box_id_snapshot: cashBox.id,
        cash_box_name_snapshot: "Reserva",
      },
    ]);
    expect(backend.tables.cash_box_deposits).toHaveLength(1);
    expect(backend.tables.cash_box_deposits[0]).toMatchObject({
      id: "legacy-deposit",
      cash_box_id: null,
      cash_box_id_snapshot: cashBox.id,
      cash_box_name_snapshot: "Reserva",
    });
    expect(getAccountBalance(hook.result.current.accounts[0], hook.result.current.transactions)).toBe(accountBalanceBeforeDelete);
    hook.unmount();

    const reloaded = await renderFinanceHook();
    expect(reloaded.result.current.transactions).toHaveLength(2);
    expect(getCashBoxBalance(cashBox.id, reloaded.result.current.transactions)).toBe(0);
    expect(reloaded.result.current.transactions.map((row) => row.cashBoxNameSnapshot)).toEqual(["Reserva", "Reserva"]);
    expect(getAccountBalance(reloaded.result.current.accounts[0], reloaded.result.current.transactions)).toBe(accountBalanceBeforeDelete);
    reloaded.unmount();
  });

  it("rolls back the entire cash box deletion when the RPC fails", async () => {
    const hook = await renderFinanceHook();
    await act(async () => {
      await hook.result.current.saveCashBoxMovement(deposit());
    });
    backend.nextWriteError = { code: "08006", message: "network connection lost" };

    await expect(act(async () => {
      await hook.result.current.deleteCashBox(cashBox.id);
    })).rejects.toMatchObject({ code: "08006" });

    expect(backend.tables.cash_boxes).toHaveLength(1);
    expect(backend.tables.transactions[0]).toMatchObject({ cash_box_id: cashBox.id });
    expect(hook.result.current.cashBoxes).toEqual([{ id: cashBox.id, name: cashBox.name }]);
    expect(hook.result.current.transactions[0].cashBoxId).toBe(cashBox.id);
    hook.unmount();
  });

  it("retries creation with one ID, saves edits, and deletes only after the remote operation succeeds", async () => {
    const hook = await renderFinanceHook();
    const savedCashBox = { id: "stable-box-id", name: "Viagem" };
    backend.nextWriteError = { code: "08006", message: "network connection lost" };
    backend.commitBeforeNextWriteError = true;

    await expect(act(async () => {
      await hook.result.current.saveCashBox(savedCashBox);
    })).rejects.toMatchObject({ code: "08006" });
    expect(hook.result.current.cashBoxes).toEqual([{ id: cashBox.id, name: cashBox.name }]);

    await act(async () => {
      await hook.result.current.saveCashBox(savedCashBox);
    });
    expect(backend.tables.cash_boxes?.filter((row) => row.id === savedCashBox.id)).toHaveLength(1);
    await act(async () => {
      await hook.result.current.saveCashBox({ ...savedCashBox, name: "Férias" });
    });
    expect(hook.result.current.cashBoxes).toContainEqual({ ...savedCashBox, name: "Férias" });

    await act(async () => {
      await hook.result.current.deleteCashBox(savedCashBox.id);
    });
    expect(hook.result.current.cashBoxes).not.toContainEqual(expect.objectContaining({ id: savedCashBox.id }));
    expect(backend.tables.cash_boxes).not.toContainEqual(expect.objectContaining({ id: savedCashBox.id }));
    hook.unmount();
  });

  it("persists deposits and withdrawals once, and reloads balances from transactions", async () => {
    const hook = await renderFinanceHook();

    await act(async () => {
      await hook.result.current.saveCashBox({ id: "new-box", name: "Viagem" });
    });
    expect(backend.tables.cash_boxes).toContainEqual({ id: "new-box", name: "Viagem", user_id: "user-1" });

    await act(async () => {
      await hook.result.current.saveCashBoxMovement(deposit());
    });
    const withdrawal: Transaction = {
      ...deposit("withdrawal-1"),
      description: "Retirada: Reserva",
      amount: 5,
      type: "income",
      cashBoxKind: "withdrawal",
    };
    await act(async () => {
      await hook.result.current.saveCashBoxMovement(withdrawal);
    });

    expect(backend.tables.transactions).toHaveLength(2);
    expect(getAccountBalance(hook.result.current.accounts[0], hook.result.current.transactions)).toBe(985);
    expect(getCashBoxBalance(cashBox.id, hook.result.current.transactions)).toBe(15);
    const persistedRows = backend.tables.transactions;
    hook.unmount();

    const reloaded = await renderFinanceHook();
    expect(reloaded.result.current.transactions).toHaveLength(2);
    expect(getAccountBalance(reloaded.result.current.accounts[0], reloaded.result.current.transactions)).toBe(985);
    expect(getCashBoxBalance(cashBox.id, reloaded.result.current.transactions)).toBe(15);
    expect(persistedRows).toHaveLength(2);
    reloaded.unmount();
  });

  it("does not update local balances on failure and safely retries the same operation ID", async () => {
    const hook = await renderFinanceHook();
    const transaction = deposit("stable-operation-id");
    backend.nextWriteError = { code: "08006", message: "network connection lost" };
    backend.commitBeforeNextWriteError = true;

    await expect(act(async () => {
      await hook.result.current.saveCashBoxMovement(transaction);
    })).rejects.toMatchObject({ code: "08006" });
    expect(hook.result.current.transactions).toEqual([]);
    expect(backend.tables.transactions).toHaveLength(1);

    await act(async () => {
      await hook.result.current.saveCashBoxMovement(transaction);
    });
    expect(hook.result.current.transactions).toEqual([transaction]);
    expect(backend.tables.transactions).toHaveLength(1);
    hook.unmount();
  });

  it("keeps local data when remote deletion fails and deletes only after confirmation", async () => {
    const hook = await renderFinanceHook();
    await act(async () => {
      await hook.result.current.saveCashBoxMovement(deposit());
    });
    backend.nextWriteError = { code: "42501", message: "permission denied" };

    await expect(act(async () => {
      await hook.result.current.deleteTransactions(["deposit-1"]);
    })).rejects.toMatchObject({ code: "42501" });
    expect(hook.result.current.transactions).toHaveLength(1);

    await act(async () => {
      await hook.result.current.deleteTransactions(["deposit-1"]);
    });
    expect(hook.result.current.transactions).toEqual([]);
    expect(backend.tables.transactions).toEqual([]);
    hook.unmount();
  });

  it("does not allow the authenticated user to delete another user's cash box", async () => {
    backend.tables.cash_boxes.push({ id: "foreign-box", name: "Private", user_id: "user-2" });
    const hook = await renderFinanceHook("user-1");

    await expect(act(async () => {
      await hook.result.current.deleteCashBox("foreign-box");
    })).rejects.toMatchObject({ code: "P0002" });

    expect(backend.tables.cash_boxes).toContainEqual({ id: "foreign-box", name: "Private", user_id: "user-2" });
    hook.unmount();
  });

  it("continues syncing ordinary financial movements", async () => {
    const hook = await renderFinanceHook();
    const ordinary: Transaction = {
      id: "ordinary-expense",
      description: "Mercado",
      category: "Alimentação",
      transaction_date: "2026-11-05",
      amount: 30,
      type: "expense",
      accountId: account.id,
    };

    act(() => hook.result.current.setTransactions([ordinary]));
    await waitFor(() => expect(backend.tables.transactions).toContainEqual(expect.objectContaining({
      id: ordinary.id,
      user_id: "user-1",
      amount: 30,
    })));
    hook.unmount();
  });
});
