import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanningPage } from "../src/pages/PlanningPage";
import type { BudgetPlan, Category, Transaction } from "../src/types/finance";
import { localDateString } from "../src/utils/format";

afterEach(cleanup);

const today = localDateString(new Date());
const plan: BudgetPlan = { id: "food-plan", category: "Alimentação", limit: 500 };
const category: Category = {
  id: "food",
  name: "Alimentação",
  type: "expense",
  color: "#178567",
  emoji: "🍲",
};

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "transaction",
    description: "Compra",
    category: "Alimentação",
    transaction_date: today,
    amount: 0,
    type: "expense",
    ...overrides,
  };
}

describe("planejamento mensal", () => {
  it("inclui compras no cartão na categoria e não duplica o pagamento da fatura", () => {
    render(
      <PlanningPage
        plans={[plan]}
        categories={[category]}
        transactions={[
          transaction({ id: "cash", description: "Mercado", amount: 80 }),
          transaction({ id: "card-purchase", description: "Restaurante", amount: 120, creditCardId: "card", creditCardKind: "purchase" }),
          transaction({ id: "card-payment", description: "Pagamento fatura", amount: 60, creditCardId: "card", creditCardKind: "payment" }),
        ]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Gastos totais no mês: R$ 200,00" }),
    ).toBeTruthy();
  });
});
