import { Target } from "lucide-react";
import { CollectionCard, CollectionPage } from "../components/CollectionPage";
import type { FinancialGoal } from "../types/finance";
import { formatShortDate, money } from "../utils/format";

// Metas financeiras e percentual acumulado até o valor planejado.
export function GoalsPage({ goals, onAdd, onEdit, onDelete }: {
  goals: FinancialGoal[];
  onAdd: () => void;
  onEdit: (goal: FinancialGoal) => void;
  onDelete: (goal: FinancialGoal) => void;
}) {
  return (
    <CollectionPage eyebrow="FLUXARY.IA · OBJETIVOS" title="Metas" description="Transforme seus planos em objetivos possíveis, um passo por vez." action={onAdd} empty={goals.length === 0}>
      {goals.map((goal) => {
        const progress = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0;
        const deadline = goal.deadline ? formatShortDate(goal.deadline) : "Sem prazo definido";
        return (
          <CollectionCard key={goal.id} icon={<Target size={17} />} title={goal.name} subtitle={`Prazo: ${deadline}`} value={`${money.format(goal.saved)} de ${money.format(goal.target)}`} progress={progress} onEdit={() => onEdit(goal)} onDelete={() => onDelete(goal)} />
        );
      })}
    </CollectionPage>
  );
}
