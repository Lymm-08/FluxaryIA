import { describe, expect, it } from "vitest";
import type { Account, CreditCardItem, Transaction } from "../src/types/finance";
import { calculateProjectedBalance, calculateTotals, getAccountBalance, getCardBillingNotice, getCardInvoiceBalance, getCardUsage, getCashBoxBalance, resetMonthlyFinance } from "../src/utils/finance";
import { localDateString, parseAmount } from "../src/utils/format";

const today = localDateString(new Date());
const account: Account = { id: "checking", name: "Conta principal", institution: "Banco", balance: 1000 };
const card: CreditCardItem = { id: "card-1", name: "Cartão", issuer: "Fluxary", creditLimit: 1000, closingDay: 10, dueDay: 17 };

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "sample",
    description: "Lançamento de teste",
    category: "Outros",
    transaction_date: today,
    amount: 0,
    type: "expense",
    ...overrides,
  };
}

describe("regras financeiras", () => {
  it("interpreta valores digitados com vírgula ou ponto decimal", () => {
    expect(parseAmount("123,45")).toBe(123.45);
    expect(parseAmount("123.45")).toBe(123.45);
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
  });

  it("não altera o saldo atual com lançamentos agendados e os inclui na projeção", () => {
    const transactions = [
      transaction({ id: "income", type: "income", amount: 500, accountId: account.id }),
      transaction({ id: "expense", amount: 200, accountId: account.id }),
      transaction({ id: "future", amount: 70, accountId: account.id, isSettled: false }),
    ];

    expect(calculateTotals(transactions, [account])).toEqual({ income: 500, expenses: 200, balance: 1300 });
    expect(calculateProjectedBalance(transactions, [account], [])).toBe(1230);
  });

  it("debita aportes do saldo atual e credita retiradas sem contar como receita ou despesa", () => {
    const deposit = transaction({
      id: "deposit-1",
      description: "Aporte: Viagem",
      category: "Caixinha",
      amount: 250,
      accountId: account.id,
      cashBoxId: "travel",
      cashBoxKind: "deposit",
    });
    const withdrawal = transaction({
      id: "withdrawal-1",
      description: "Retirada: Viagem",
      category: "Caixinha",
      type: "income",
      amount: 50,
      accountId: account.id,
      cashBoxId: "travel",
      cashBoxKind: "withdrawal",
    });

    expect(getCashBoxBalance("travel", [deposit, withdrawal])).toBe(200);
    expect(getAccountBalance(account, [deposit])).toBe(750);
    expect(getAccountBalance(account, [deposit, withdrawal])).toBe(800);
    expect(calculateTotals([deposit], [account])).toEqual({ income: 0, expenses: 0, balance: 750 });
    expect(calculateTotals([deposit, withdrawal], [account])).toEqual({ income: 0, expenses: 0, balance: 800 });
    expect(calculateProjectedBalance([deposit, withdrawal], [account], [])).toBe(800);
  });

  it("zera saldo, receitas e despesas do mês preservando histórico e movimentações de caixinhas", () => {
    const transactions = [
      transaction({ id: "history-income", transaction_date: "2025-12-15", type: "income", amount: 200, accountId: account.id }),
      transaction({ id: "history-expense", transaction_date: "2025-12-20", amount: 100, accountId: account.id }),
      transaction({ id: "month-income", type: "income", amount: 500, accountId: account.id }),
      transaction({ id: "month-expense", amount: 250, accountId: account.id }),
      transaction({ id: "month-cash-box", amount: 40, accountId: account.id, cashBoxId: "travel", cashBoxKind: "deposit" }),
    ];

    const reset = resetMonthlyFinance(transactions, [account], today.slice(0, 7), true);

    expect(reset.transactions.map((item) => item.id)).toEqual(["history-income", "history-expense", "month-cash-box"]);
    expect(calculateTotals(reset.transactions, reset.accounts)).toEqual({ income: 0, expenses: 0, balance: 0 });
  });

  it("mantém o histórico do cartão deste mês quando solicitado ao zerar o saldo", () => {
    const transactions = [
      transaction({ id: "month-income", type: "income", amount: 500, accountId: account.id }),
      transaction({ id: "month-card-purchase", amount: 200, creditCardId: card.id, creditCardKind: "purchase" }),
      transaction({ id: "month-card-payment", amount: 50, accountId: account.id, creditCardId: card.id, creditCardKind: "payment" }),
    ];

    const reset = resetMonthlyFinance(transactions, [account], today.slice(0, 7), false);

    expect(reset.transactions.map((item) => item.id)).toEqual(["month-card-purchase", "month-card-payment"]);
    expect(calculateTotals(reset.transactions, reset.accounts).balance).toBe(0);
  });

  it("apaga também o histórico do cartão deste mês quando confirmado", () => {
    const transactions = [
      transaction({ id: "month-card-purchase", amount: 200, creditCardId: card.id, creditCardKind: "purchase" }),
      transaction({ id: "month-card-payment", amount: 50, accountId: account.id, creditCardId: card.id, creditCardKind: "payment" }),
    ];

    const reset = resetMonthlyFinance(transactions, [account], today.slice(0, 7), true);

    expect(reset.transactions).toEqual([]);
    expect(calculateTotals(reset.transactions, reset.accounts).balance).toBe(0);
  });

  it("calcula limite do cartão considerando compras, pagamentos e agendamentos", () => {
    const transactions = [
      transaction({ id: "purchase", amount: 300, creditCardId: card.id, creditCardKind: "purchase" }),
      transaction({ id: "scheduled", amount: 100, creditCardId: card.id, creditCardKind: "purchase", isSettled: false }),
      transaction({ id: "payment", type: "expense", amount: 50, creditCardId: card.id, creditCardKind: "payment" }),
    ];

    expect(getCardUsage(card, transactions)).toEqual({ used: 350, available: 650, progress: 35 });
    expect(getCardInvoiceBalance(card, transactions)).toBe(250);
    const withoutScheduledPurchase = transactions.filter((item) => item.id !== "scheduled");
    expect(calculateTotals(transactions).expenses).toBe(calculateTotals(withoutScheduledPurchase).expenses);
    expect(calculateProjectedBalance(transactions, [], [card])).toBe(
      calculateProjectedBalance(withoutScheduledPurchase, [], [card]),
    );
  });

  it("avisa quando a fatura fecha na data configurada", () => {
    const closingDate = new Date(2026, 0, 10);
    const notice = getCardBillingNotice(card, [
      transaction({ id: "purchase", transaction_date: "2026-01-10", amount: 120, creditCardId: card.id, creditCardKind: "purchase" }),
    ], closingDate);

    expect(notice.title).toBe("Fatura fechou hoje");
    expect(notice.message).toContain("17/01");
  });
});
