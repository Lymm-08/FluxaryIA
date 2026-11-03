import { AlertTriangle, Check, X } from "lucide-react";

export function ConfirmDialog({ title, message, confirmLabel, danger = false, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <div className={`confirm-dialog-icon ${danger ? "danger" : ""}`}>{danger ? <AlertTriangle size={20} /> : <Check size={20} />}</div>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel}><X size={14} /> Cancelar</button>
          <button type="button" className={danger ? "button-danger" : "button-primary"} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
