import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionDetailsModal } from "../src/components/TransactionDetailsModal";
import { TransactionRow } from "../src/components/TransactionRow";
import { MovementsPage } from "../src/pages/MovementsPage";
import type { Transaction } from "../src/types/finance";

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

  it("abre o detalhe da movimentação por teclado", () => {
    const onOpen = vi.fn();
    render(<TransactionRow transaction={pendingExpense} showValues onOpen={onOpen} />);
    const row = screen.getByRole("button", { name: "Abrir lançamento Aluguel" });
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
        initialMonth="2026-12"
        initialType="all"
      />,
    );

    expect(screen.getByText("Tênis (2/3)")).toBeTruthy();
    expect(screen.queryByText("Tênis (3/3)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir lançamento Tênis (2/3)" }));

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
});
