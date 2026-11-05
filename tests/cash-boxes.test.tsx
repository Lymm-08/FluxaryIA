import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashBoxesPage } from "../src/pages/CashBoxesPage";
import { DashboardPage } from "../src/pages/DashboardPage";
import { MovementsPage } from "../src/pages/MovementsPage";
import { ResetFinanceDialog } from "../src/components/ResetFinanceDialog";
import type { Account, CashBox, CreditCardItem, Transaction } from "../src/types/finance";
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
  it("permite escolher a conta de origem e fazer um aporte", async () => {
    const onDeposit = vi.fn().mockReturnValue(true);
    render(
      <CashBoxesPage
        cashBoxes={[cashBox]}
        transactions={[existingDeposit]}
        accounts={[account]}
        accountBalances={{ [account.id]: 375 }}
        schemaReady
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onDeposit={onDeposit}
      />,
    );

    expect(screen.getByText(/125,00/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar dinheiro" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Conta de origem do aporte" }));
    fireEvent.click(screen.getByRole("option", { name: /Conta principal/ }));
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "75,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar dinheiro" }));

    await waitFor(() => expect(onDeposit).toHaveBeenCalledWith(cashBox, account.id, 75.5, "deposit", expect.any(String)));
  });

  describe("confirmação ao zerar os dados financeiros", () => {
    it("oferece manter ou apagar o histórico do cartão, além de cancelar", () => {
      const onKeepCardHistory = vi.fn();
      const onDeleteCardHistory = vi.fn();
      const onCancel = vi.fn();
      render(
        <ResetFinanceDialog
          onKeepCardHistory={onKeepCardHistory}
          onDeleteCardHistory={onDeleteCardHistory}
          onCancel={onCancel}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Não, manter cartão/ }));
      fireEvent.click(screen.getByRole("button", { name: /Sim, apagar tudo/ }));
      fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));

      expect(onKeepCardHistory).toHaveBeenCalledOnce();
      expect(onDeleteCardHistory).toHaveBeenCalledOnce();
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  it("permite retirar dinheiro e escolher a conta de destino", async () => {
    const onDeposit = vi.fn().mockReturnValue(true);
    render(
      <CashBoxesPage
        cashBoxes={[cashBox]}
        transactions={[existingDeposit]}
        accounts={[account]}
        accountBalances={{ [account.id]: 375 }}
        schemaReady
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onDeposit={onDeposit}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Retirar dinheiro" })[0]);
    fireEvent.click(screen.getByRole("combobox", { name: "Conta de destino da retirada" }));
    fireEvent.click(screen.getByRole("option", { name: /Conta principal/ }));
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "25,50" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Retirar dinheiro" })[1]);

    await waitFor(() => expect(onDeposit).toHaveBeenCalledWith(cashBox, account.id, 25.5, "withdrawal", expect.any(String)));
  });

  it("reusa o identificador da operação ao repetir um aporte que falhou", async () => {
    const onDeposit = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(
      <CashBoxesPage
        cashBoxes={[cashBox]}
        transactions={[]}
        accounts={[account]}
        accountBalances={{ [account.id]: 500 }}
        schemaReady
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onDeposit={onDeposit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Adicionar dinheiro" }));
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "20,00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar dinheiro" }));
    await waitFor(() => expect(onDeposit).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Guardar dinheiro" }));
    await waitFor(() => expect(onDeposit).toHaveBeenCalledTimes(2));

    expect(onDeposit.mock.calls[0][4]).toBe(onDeposit.mock.calls[1][4]);
  });

  it("permite editar o nome e solicitar a exclusão da caixinha", () => {
    const onRename = vi.fn().mockReturnValue(true);
    const onDelete = vi.fn();
    render(
      <CashBoxesPage
        cashBoxes={[cashBox]}
        transactions={[]}
        accounts={[account]}
        accountBalances={{ [account.id]: 500 }}
        schemaReady
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={onDelete}
        onDeposit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome da caixinha" }), { target: { value: "Férias" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(onRename).toHaveBeenCalledWith(cashBox, "Férias");

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onDelete).toHaveBeenCalledWith(cashBox);
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
        cardTransactions={transactions}
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

  it("usa todas as movimentações para reservar compras agendadas no limite do cartão", () => {
    const card: CreditCardItem = {
      id: "card-1",
      name: "Cartão",
      issuer: "Banco Fluxary",
      creditLimit: 1000,
    };
    const scheduledPurchase: Transaction = {
      id: "future-card-purchase",
      description: "Compra agendada",
      category: "Compras",
      transaction_date: "2099-01-15",
      amount: 125,
      type: "expense",
      isSettled: false,
      creditCardId: card.id,
      creditCardKind: "purchase",
    };
    render(
      <DashboardPage
        transactions={[]}
        cardTransactions={[scheduledPurchase]}
        totals={{ income: 0, expenses: 0, balance: 0 }}
        projectedBalance={0}
        monthlyBudget={null}
        showValues
        mascotExpression="encouragement"
        mascotMessage="Vamos acompanhar seu saldo."
        cards={[card]}
        customBanks={[]}
        goals={[]}
        dashboardWidgets={["cards"]}
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

    expect(screen.getByText(/125,00 de .* utilizados/)).toBeTruthy();
    expect(screen.getByText(/Disponível .*875,00/)).toBeTruthy();
    expect(screen.getByText(/Seu começo merece ser celebrado/)).toBeTruthy();
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
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onDeposit={vi.fn()}
      />,
    );

    expect(screen.getByText(/20261103030000_cash_box_withdrawals\.sql/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nova caixinha" })).toHaveProperty("disabled", true);
  });
});
