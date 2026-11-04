import { AlertTriangle, CreditCard, Trash2, X } from "lucide-react";

export function ResetFinanceDialog({ onKeepCardHistory, onDeleteCardHistory, onCancel }: {
  onKeepCardHistory: () => void;
  onDeleteCardHistory: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-finance-title" aria-describedby="reset-finance-message">
        <div className="confirm-dialog-icon danger"><AlertTriangle size={20} /></div>
        <h2 id="reset-finance-title">Zerar os dados financeiros do mês?</h2>
        <p id="reset-finance-message">
          As movimentações deste mês serão excluídas e o saldo será zerado. Se escolher apagar o cartão também, todo o histórico de compras e pagamentos dos cartões será removido. Caso contrário, o histórico dos cartões será mantido.
        </p>
        <div className="modal-actions reset-finance-actions">
          <button type="button" className="button-secondary" onClick={onCancel}><X size={14} /> Cancelar</button>
          <button type="button" className="button-secondary" onClick={onKeepCardHistory}><CreditCard size={14} /> Não, manter cartão</button>
          <button type="button" className="button-danger" onClick={onDeleteCardHistory}><Trash2 size={14} /> Sim, apagar tudo</button>
        </div>
      </section>
    </div>
  );
}
