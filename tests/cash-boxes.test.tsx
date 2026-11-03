import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CashBoxesPage } from "../src/pages/CashBoxesPage";
import type { Account, CashBox, CashBoxDeposit } from "../src/types/finance";

afterEach(cleanup);

const account: Account = {
  id: "checking-1",
  name: "Conta principal",
  institution: "Banco Fluxary",
  balance: 500,
};

const cashBox: CashBox = { id: "trip-1", name: "Viagem" };
const existingDeposit: CashBoxDeposit = {
  id: "deposit-1",
  cashBoxId: cashBox.id,
  accountId: account.id,
  amount: 125,
  createdAt: "2026-11-03T12:00:00.000Z",
};

describe("caixinhas", () => {
  it("permite escolher a conta de origem e fazer um aporte", () => {
    const onDeposit = vi.fn().mockReturnValue(true);
    render(
      <CashBoxesPage
        cashBoxes={[cashBox]}
        deposits={[existingDeposit]}
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

    expect(onDeposit).toHaveBeenCalledWith(cashBox, account.id, 75.5);
  });

  it("solicita a migration no Supabase sem desativar as outras telas", () => {
    render(
      <CashBoxesPage
        cashBoxes={[]}
        deposits={[]}
        accounts={[]}
        accountBalances={{}}
        schemaReady={false}
        onCreate={vi.fn()}
        onDeposit={vi.fn()}
      />,
    );

    expect(screen.getByText(/20261103020000_cash_boxes\.sql/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nova caixinha" })).toHaveProperty("disabled", true);
  });
});
