import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionDetailsModal } from "../src/components/TransactionDetailsModal";
import { TransactionRow } from "../src/components/TransactionRow";
import { MovementsPage } from "../src/pages/MovementsPage";
import type { Transaction } from "../src/types/finance";

afterEach(cleanup);

const pendingExpense: Transaction = {
  id: "rent-1",
  description: "Aluguel",
  category: "Moradia",
  transaction_date: "2026-05-04",
  amount: 1200,
  type: "expense",
  isSettled: false,
};

describe("detalhes de movimentação", () => {
  it("exibe os dados e oferece ações para um lançamento pendente", () => {
    const onSettle = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TransactionDetailsModal
        transaction={pendingExpense}
        showValues
        onClose={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onSettle={onSettle}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Detalhes do lançamento" })).toBeTruthy();
    expect(screen.getByText("Aluguel")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como paga" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(onSettle).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("oculta o valor quando a privacidade está ativada", () => {
    render(
      <TransactionDetailsModal
        transaction={pendingExpense}
        showValues={false}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSettle={vi.fn()}
      />,
    );

    expect(screen.getByText("R$ •••••")).toBeTruthy();
  });

  it("identifica a conta original nos detalhes de uma movimentação arquivada", () => {
    render(
      <TransactionDetailsModal
        transaction={{
          ...pendingExpense,
          accountIdSnapshot: "closed-account",
          accountNameSnapshot: "Conta encerrada",
        }}
        showValues
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSettle={vi.fn()}
      />,
    );

    expect(screen.getByText("Conta encerrada")).toBeTruthy();
  });

  it("abre o detalhe da movimentação por teclado", () => {
    const onOpen = vi.fn();
    render(<TransactionRow transaction={pendingExpense} showValues onOpen={onOpen} />);
    const row = screen.getByRole("group", { name: "Lançamento Aluguel" });
    fireEvent.keyDown(row, { key: "Enter" });

    expect(onOpen).toHaveBeenCalledWith(pendingExpense);
  });

  it("mostra somente os lançamentos do mês escolhido e abre detalhes pela linha", () => {
    const onOpenTransaction = vi.fn();
    const nextInstallment: Transaction = {
      ...pendingExpense,
      id: "rent-2",
      description: "Tênis (2/3)",
      transaction_date: "2026-12-03",
    };
    const lastInstallment: Transaction = {
      ...pendingExpense,
      id: "rent-3",
      description: "Tênis (3/3)",
      transaction_date: "2027-01-03",
    };
    render(
      <MovementsPage
        transactions={[pendingExpense, nextInstallment, lastInstallment]}
        showValues
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onOpenTransaction={onOpenTransaction}
        onSettle={vi.fn()}
        initialMonth="2026-12"
        initialType="all"
      />,
    );

    expect(screen.getByText("Tênis (2/3)")).toBeTruthy();
    expect(screen.queryByText("Tênis (3/3)")).toBeNull();
    fireEvent.click(screen.getByRole("group", { name: "Lançamento Tênis (2/3)" }));

    expect(onOpenTransaction).toHaveBeenCalledWith(nextInstallment);
  });

  it("não abre detalhes junto com a ação de editar na linha", () => {
    const onOpen = vi.fn();
    const onEdit = vi.fn();
    render(<TransactionRow transaction={pendingExpense} showValues onOpen={onOpen} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar Aluguel" }));

    expect(onEdit).toHaveBeenCalledWith(pendingExpense);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("permite marcar uma despesa agendada como paga direto na movimentação", () => {
    const onSettle = vi.fn();
    render(<TransactionRow transaction={pendingExpense} showValues onSettle={onSettle} onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar paga" }));

    expect(onSettle).toHaveBeenCalledWith(pendingExpense);
  });

  it("permite marcar uma receita agendada como recebida direto na movimentação", () => {
    const pendingIncome: Transaction = { ...pendingExpense, id: "income-1", type: "income" };
    const onSettle = vi.fn();
    render(<TransactionRow transaction={pendingIncome} showValues onSettle={onSettle} onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar recebida" }));

    expect(onSettle).toHaveBeenCalledWith(pendingIncome);
  });
});
