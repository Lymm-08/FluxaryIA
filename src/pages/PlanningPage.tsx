import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { CollectionCard, CollectionPage } from "../components/CollectionPage";
import type { BudgetPlan, Category, Transaction } from "../types/finance";
import { localDateString, money } from "../utils/format";

// Planejamento mensal por categoria com acompanhamento visual dos gastos.
export function PlanningPage({ plans, transactions, categories, onAdd, onEdit, onDelete }: {
  plans: BudgetPlan[];
  transactions: Transaction[];
  categories: Category[];
  onAdd: () => void;
  onEdit: (plan: BudgetPlan) => void;
  onDelete: (plan: BudgetPlan) => void;
}) {
  const month = localDateString(new Date()).slice(0, 7);
  const monthExpenses = plans.map((plan) => ({
    plan,
    category: categories.find((item) => item.id === plan.categoryId) ?? categories.find((item) => item.name === plan.category),
    spent: transactions
      .filter((transaction) => transaction.type === "expense"
        && !transaction.cashBoxKind
        && transaction.isSettled !== false
        && transaction.creditCardKind !== "payment"
        && transaction.creditCardKind !== "purchase"
        && transaction.category === plan.category
        && transaction.transaction_date.startsWith(month))
      .reduce((sum, item) => sum + item.amount, 0),
  }));
  const totalSpent = monthExpenses.reduce((sum, item) => sum + item.spent, 0);
  const totalLimit = plans.reduce((sum, plan) => sum + plan.limit, 0);
  let chartEnd = 0;
  const chartStops = monthExpenses
    .filter((item) => item.spent > 0)
    .map((item) => {
      const start = chartEnd;
      chartEnd += totalSpent > 0 ? item.spent / totalSpent * 100 : 0;
      return `${item.category?.color ?? "#178567"} ${start}% ${chartEnd}%`;
    });
  const donutStyle = chartStops.length
    ? `conic-gradient(${chartStops.join(", ")})`
    : "conic-gradient(#e7f2eb 0% 100%)";
  return (
    <CollectionPage eyebrow="FLUXARY.IA · PLANEJAMENTO MENSAL" title="Planejamento mensal" description="Organize o que pretende gastar em várias categorias e acompanhe o realizado no mês." action={onAdd} empty={plans.length === 0}>
      {plans.length > 0 && (
        <section className="panel planning-summary" aria-label="Resumo de despesas planejadas por categoria">
          <div className="planning-summary-heading">
            <div><span className="eyebrow">GASTOS DO MÊS</span><h2>Onde você gastou</h2></div>
            <span className="planning-month-label">{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date())}</span>
          </div>
          <div className="planning-summary-content">
            <div className="planning-donut" style={{ background: donutStyle }} role="img" aria-label={`Gastos totais no mês: ${money.format(totalSpent)}`}>
              <div><small>Gasto</small><strong>{money.format(totalSpent)}</strong></div>
            </div>
            <div className="planning-legend">
              {monthExpenses.map(({ plan, category, spent }) => (
                <div className="planning-legend-row" key={plan.id}>
                  <span className="planning-legend-dot" style={{ backgroundColor: category?.color ?? "#178567" }} />
                  <span className="planning-legend-name">{plan.category}</span>
                  <strong>{money.format(spent)}</strong>
                </div>
              ))}
              <div className="planning-summary-total"><span>Limite total</span><strong>{money.format(totalLimit)}</strong></div>
            </div>
          </div>
        </section>
      )}
      {plans.map((plan) => {
        const spent = monthExpenses.find((item) => item.plan.id === plan.id)?.spent ?? 0;
        const used = plan.limit > 0 ? (spent / plan.limit) * 100 : 0;
        return (
          <CollectionCard key={plan.id} icon={<ChartNoAxesColumnIncreasing size={17} />} title={plan.category} subtitle={`Usado ${money.format(spent)} de ${money.format(plan.limit)}`} value={`${money.format(Math.max(0, plan.limit - spent))} disponível`} progress={used} onEdit={() => onEdit(plan)} onDelete={() => onDelete(plan)} />
        );
      })}
    </CollectionPage>
  );
}
