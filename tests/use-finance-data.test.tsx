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
  backend.rpc.mockImplementation((functionName: string, args: { p_cash_box_id: string }) => {
    backend.operations.push({ table: functionName, kind: "rpc" });
    if (functionName !== "delete_cash_box_preserving_history") {
      return Promise.resolve({ error: { code: "42883", message: "function not found" } });
    }
    if (!backend.authenticatedUserId) {
      return Promise.resolve({ error: { code: "42501", message: "Authentication required" } });
    }
    const boxIndex = backend.tables.cash_boxes.findIndex((row) =>
      row.user_id === backend.authenticatedUserId && row.id === args.p_cash_box_id,
    );
    if (boxIndex < 0) {
      return Promise.resolve({ error: { code: "P0002", message: "Cash box not found or not owned" } });
    }
    const error = backend.nextWriteError;
    backend.nextWriteError = null;
    if (error) return Promise.resolve({ error });

    const name = backend.tables.cash_boxes[boxIndex].name;
    backend.tables.transactions = backend.tables.transactions.map((row) => row.user_id === backend.authenticatedUserId
      && row.cash_box_id === args.p_cash_box_id
      ? {
        ...row,
        cash_box_id_snapshot: row.cash_box_id,
        cash_box_name_snapshot: name,
        cash_box_id: null,
      }
      : row);
    backend.tables.cash_box_deposits = backend.tables.cash_box_deposits.map((row) =>
      row.user_id === backend.authenticatedUserId && row.cash_box_id === args.p_cash_box_id
        ? {
          ...row,
          cash_box_id_snapshot: row.cash_box_id,
          cash_box_name_snapshot: name,
          cash_box_id: null,
        }
        : row,
    );
    backend.tables.cash_boxes.splice(boxIndex, 1);
    return Promise.resolve({ data: null, error: null });
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useFinanceData cash box persistence", () => {
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
