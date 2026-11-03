import { Plus, X } from "lucide-react";

// Configuração do limite de despesas que alimenta o aviso do painel.
export function BudgetModal({ budget, onClose, onRemove, onSubmit }: {
  budget: number | null;
  onClose: () => void;
  onRemove: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div><span className="eyebrow">PLANEJAMENTO DO MÊS</span><h2>Limite de despesas</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={17} /></button>
        </div>
        <p className="budget-form-copy">A onça vai avisar quando suas despesas do mês ultrapassarem este valor.</p>
        <label>Orçamento mensal<input name="monthly-budget" type="number" min="0.01" step="0.01" required defaultValue={budget ?? ""} placeholder="Ex.: 1.000,00" /></label>
        <div className="modal-actions">
          {budget !== null && <button type="button" className="button-secondary" onClick={onRemove}>Remover limite</button>}
          <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button-primary"><Plus size={14} /> Salvar limite</button>
        </div>
      </form>
    </div>
  );
}
