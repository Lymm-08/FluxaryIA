import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { Account, BudgetPlan, CreditCardItem, CustomBank, FinancialGoal } from "../types/finance";
import type { Category } from "../types/finance";
import { BankPicker } from "./BankLogo";
import { DatePicker } from "./DatePicker";
import { money } from "../utils/format";

export type FinanceEntryType = "account" | "card" | "plan" | "goal";
export type FinanceEntry = Account | CreditCardItem | BudgetPlan | FinancialGoal | null;

// Um formulário pequeno por tipo mantém cada fluxo claro sem duplicar o modal.
export function FinanceEntryModal({ type, entry, categories, customBanks, onCreateCustomBank, onClose, onSubmit }: {
  type: FinanceEntryType;
  entry: FinanceEntry;
  categories: Category[];
  customBanks: CustomBank[];
  onCreateCustomBank: (bank: CustomBank) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const isEdit = entry !== null;
  const headings: Record<FinanceEntryType, string> = {
    account: isEdit ? "Editar conta" : "Nova conta",
    card: isEdit ? "Editar cartão" : "Novo cartão",
    plan: isEdit ? "Editar planejamento" : "Novo planejamento",
    goal: isEdit ? "Editar meta" : "Nova meta",
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal finance-entry-modal" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div><span className="eyebrow">FLUXARY.IA · ORGANIZAÇÃO</span><h2>{headings[type]}</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </div>
        {type === "account" && <AccountFields entry={entry as Account | null} customBanks={customBanks} onCreateCustomBank={onCreateCustomBank} />}
        {type === "card" && <CardFields entry={entry as CreditCardItem | null} customBanks={customBanks} onCreateCustomBank={onCreateCustomBank} />}
        {type === "plan" && <PlanFields entry={entry as BudgetPlan | null} categories={categories} />}
        {type === "goal" && <GoalFields entry={entry as FinancialGoal | null} />}
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Plus size={14} /> Salvar</button></div>
      </form>
    </div>
  );
}

function AccountFields({ entry, customBanks, onCreateCustomBank }: {
  entry: Account | null; customBanks: CustomBank[]; onCreateCustomBank: (bank: CustomBank) => void;
}) {
  return <>
    <label>Nome da conta<input name="name" required maxLength={40} defaultValue={entry?.name} placeholder="Ex.: Conta principal" /></label>
    <label>Banco ou instituição<BankPicker initialBankId={entry?.bankId} initialBankName={entry?.institution} customBanks={customBanks} onCreateCustomBank={onCreateCustomBank} /></label>
    <label>Saldo atual<input name="balance" type="number" step="0.01" required defaultValue={entry?.balance ?? 0} placeholder="0,00" /></label>
  </>;
}

function CardFields({ entry, customBanks, onCreateCustomBank }: {
  entry: CreditCardItem | null; customBanks: CustomBank[]; onCreateCustomBank: (bank: CustomBank) => void;
}) {
  return <>
    <label>Banco emissor<BankPicker fieldName="issuer" initialBankId={entry?.bankId} initialBankName={entry?.issuer} customBanks={customBanks} onCreateCustomBank={onCreateCustomBank} /></label>
    <label>Limite do cartão<input name="creditLimit" type="number" min="0.01" step="0.01" required defaultValue={entry?.creditLimit} placeholder="0,00" /></label>
    <div className="form-grid">
      <label>Dia de fechamento<input name="closingDay" type="number" min="1" max="31" step="1" required defaultValue={entry?.closingDay ?? 10} /></label>
      <label>Dia de vencimento<input name="dueDay" type="number" min="1" max="31" step="1" required defaultValue={entry?.dueDay ?? 17} /></label>
    </div>
  </>;
}

function PlanFields({ entry, categories }: { entry: BudgetPlan | null; categories: Category[] }) {
  const expenseCategories = categories.filter((category) => category.type === "expense");
  const [selectedIds, setSelectedIds] = useState<string[]>(
    entry?.categoryId ? [entry.categoryId] : [],
  );
  return <>
    <p className="budget-form-copy">Planejamento mensal. Selecione uma ou mais categorias e defina um limite para cada uma.</p>
    <div className="plan-category-options">
      {expenseCategories.map((category) => {
        const selected = selectedIds.includes(category.id);
        return (
          <div className={`plan-category-row ${selected ? "plan-category-row-selected" : ""}`} key={category.id}>
            <label className="plan-category-choice">
              <input
                type="checkbox"
                name="category-ids"
                value={category.id}
                checked={selected}
                disabled={Boolean(entry && category.id !== entry.categoryId)}
                onChange={() => setSelectedIds((current) =>
                  selected ? current.filter((id) => id !== category.id) : [...current, category.id],
                )}
              />
              <span>{category.emoji} {category.name}</span>
            </label>
            {selected && (
              <label className="plan-category-limit">
                Limite mensal
                <input
                  name={`limit-${category.id}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={entry?.categoryId === category.id ? entry.limit : ""}
                  placeholder="R$ 0,00"
                />
              </label>
            )}
          </div>
        );
      })}
    </div>
  </>;
}

function GoalFields({ entry }: { entry: FinancialGoal | null }) {
  const [deadline, setDeadline] = useState(entry?.deadline ?? "");
  return <>
    <label>Nome da meta<input name="name" required maxLength={40} defaultValue={entry?.name} placeholder="Ex.: Viagem de férias" /></label>
    <div className="form-grid">
      <label>Valor desejado<input name="target" type="number" min="0.01" step="0.01" required defaultValue={entry?.target} placeholder="0,00" /></label>
      <label>Já guardado<input name="saved" type="number" min="0" step="0.01" required defaultValue={entry?.saved ?? 0} placeholder="0,00" /></label>
    </div>
    <label>Prazo<DatePicker name="deadline" value={deadline} onChange={setDeadline} ariaLabel="Prazo da meta" /></label>
    {entry && <p className="budget-form-copy">Progresso atual: {money.format(entry.saved)} de {money.format(entry.target)}.</p>}
  </>;
}
