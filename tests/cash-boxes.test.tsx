import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashBoxesPage } from "../src/pages/CashBoxesPage";
import { DashboardPage } from "../src/pages/DashboardPage";
import { MovementsPage } from "../src/pages/MovementsPage";
import type { Account, CashBox, Transaction } from "../src/types/finance";
import { calculateTotals } from "../src/utils/finance";

afterEach(cleanup);

const account: Account = {
  id: "checking-1",
  name: "Conta principal",
  institution: "Banco Fluxary",
  balance: 500,
};

const cashBox: CashBox = { id: "trip-1", name: "Viagem" };
const existingDeposit: Transaction = {
  id: "deposit-1",
  description: "Aporte: Viagem",
  category: "Caixinha",
  transaction_date: "2026-11-03",
  type: "expense",
  cashBoxId: cashBox.id,
  cashBoxKind: "deposit",
  accountId: account.id,
  amount: 125,
};

describe("caixinhas", () => {
  it("permite escolher a conta de origem e fazer um aporte", () => {
    const onDeposit = vi.fn().mockReturnValue(true);
    render(
      <CashBoxesPage
        cashBoxes={[cashBox]}
        transactions={[existingDeposit]}
        accounts={[account]}
        accountBalances={{ [account.id]: 375 }}
        schemaReady
        onCreate={vi.fn()}
        onDeposit={onDeposit}
      />,
    );

    expect(screen.getByText(/125,00/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar dinheiro" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Conta de origem do aporte" }));
    fireEvent.click(screen.getByRole("option", { name: /Conta principal/ }));
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "75,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar dinheiro" }));

    expect(onDeposit).toHaveBeenCalledWith(cashBox, account.id, 75.5, "deposit");
  });

  it("permite retirar dinheiro e escolher a conta de destino", () => {
    const onDeposit = vi.fn().mockReturnValue(true);
    render(
      <CashBoxesPage
        cashBoxes={[cashBox]}
        transactions={[existingDeposit]}
        accounts={[account]}
        accountBalances={{ [account.id]: 375 }}
        schemaReady
        onCreate={vi.fn()}
        onDeposit={onDeposit}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Retirar dinheiro" })[0]);
    fireEvent.click(screen.getByRole("combobox", { name: "Conta de destino da retirada" }));
    fireEvent.click(screen.getByRole("option", { name: /Conta principal/ }));
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "25,50" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Retirar dinheiro" })[1]);

    expect(onDeposit).toHaveBeenCalledWith(cashBox, account.id, 25.5, "withdrawal");
  });

  it("mostra aportes e retiradas em Movimentações sem tratá-los como despesa ou receita", () => {
    const withdrawal: Transaction = {
      ...existingDeposit,
      id: "withdrawal-1",
      description: "Retirada: Viagem",
      type: "income",
      cashBoxKind: "withdrawal",
      amount: 25,
    };
    render(
      <MovementsPage
        transactions={[existingDeposit, withdrawal]}
        showValues
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenTransaction={vi.fn()}
        onSettle={vi.fn()}
        initialMonth={existingDeposit.transaction_date.slice(0, 7)}
        initialType="all"
      />,
    );

    expect(screen.getByText("Aporte: Viagem")).toBeTruthy();
    expect(screen.getByText(/Aporte na caixinha · Viagem/)).toBeTruthy();
    expect(screen.getByText("Retirada: Viagem")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Caixinhas/ }));
    expect(screen.getByText("Aporte: Viagem")).toBeTruthy();
    expect(screen.getByText("Retirada: Viagem")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Despesas/ }));
    expect(screen.queryByText("Aporte: Viagem")).toBeNull();
    expect(screen.queryByText("Retirada: Viagem")).toBeNull();
  });

  it("mostra o aporte nas últimas movimentações junto com o saldo já debitado", () => {
    const deposit: Transaction = {
      ...existingDeposit,
      transaction_date: new Date().toISOString().slice(0, 10),
    };
    const transactions = [deposit];
    render(
      <DashboardPage
        transactions={transactions}
        totals={calculateTotals(transactions, [account])}
        projectedBalance={375}
        monthlyBudget={null}
        showValues
        mascotExpression="encouragement"
        mascotMessage="Vamos acompanhar seu saldo."
        cards={[]}
        customBanks={[]}
        goals={[]}
        dashboardWidgets={[]}
        onToggleValues={vi.fn()}
        onAdd={vi.fn()}
        onAddGoal={vi.fn()}
        onSetBudget={vi.fn()}
        onNavigate={vi.fn()}
        onOpenMovements={vi.fn()}
        onPayCard={vi.fn()}
        cloudAccount
        onOpenTransaction={vi.fn()}
        onOpenTransactions={vi.fn()}
      />,
    );

    expect(screen.getByText("Últimas movimentações")).toBeTruthy();
    expect(screen.getByText("Aporte: Viagem")).toBeTruthy();
    expect(screen.getByText(/125,00/)).toBeTruthy();
    expect(calculateTotals(transactions, [account]).balance).toBe(375);
  });

  it("solicita a migration no Supabase sem desativar as outras telas", () => {
    render(
      <CashBoxesPage
        cashBoxes={[]}
        transactions={[]}
        accounts={[]}
        accountBalances={{}}
        schemaReady={false}
        onCreate={vi.fn()}
        onDeposit={vi.fn()}
      />,
    );

    expect(screen.getByText(/20261103030000_cash_box_withdrawals\.sql/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nova caixinha" })).toHaveProperty("disabled", true);
  });
});
