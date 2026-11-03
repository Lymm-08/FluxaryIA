import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { CollectionCard, CollectionPage } from "../components/CollectionPage";
import type { BudgetPlan, Transaction } from "../types/finance";
import { localDateString, money } from "../utils/format";

// Limites mensais por categoria e acompanhamento do valor já consumido.
export function PlanningPage({ plans, transactions, onAdd, onEdit, onDelete }: {
  plans: BudgetPlan[];
  transactions: Transaction[];
  onAdd: () => void;
  onEdit: (plan: BudgetPlan) => void;
  onDelete: (plan: BudgetPlan) => void;
}) {
  const month = localDateString(new Date()).slice(0, 7);
  return (
    <CollectionPage eyebrow="FLUXARY.IA · PLANEJAMENTO" title="Planejamento" description="Defina limites mensais e acompanhe suas despesas por categoria." action={onAdd} empty={plans.length === 0}>
      {plans.map((plan) => {
        const spent = transactions.filter((transaction) => transaction.type === "expense" && transaction.creditCardKind !== "purchase" && transaction.category === plan.category && transaction.transaction_date.startsWith(month)).reduce((sum, item) => sum + item.amount, 0);
        const used = plan.limit > 0 ? (spent / plan.limit) * 100 : 0;
        return (
          <CollectionCard key={plan.id} icon={<ChartNoAxesColumnIncreasing size={17} />} title={plan.category} subtitle={`Usado ${money.format(spent)} de ${money.format(plan.limit)}`} value={`${money.format(Math.max(0, plan.limit - spent))} disponível`} progress={used} onEdit={() => onEdit(plan)} onDelete={() => onDelete(plan)} />
        );
      })}
    </CollectionPage>
  );
}
