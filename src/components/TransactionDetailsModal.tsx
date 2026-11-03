import { CalendarDays, CheckCircle2, CreditCard, Pencil, Trash2, Wallet, X } from "lucide-react";
import type { Account, CreditCardItem, Transaction } from "../types/finance";
import { formatShortDate, money } from "../utils/format";

export function TransactionDetailsModal({ transaction, account, card, showValues, onClose, onEdit, onDelete, onSettle }: {
  transaction: Transaction;
  account?: Account;
  card?: CreditCardItem;
  showValues: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSettle: () => void;
}) {
  const isPending = transaction.isSettled === false;
  const actionLabel = transaction.type === "income" ? "Marcar como recebida" : "Marcar como paga";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="transaction-modal transaction-details-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-details-title">
        <div className="modal-heading">
          <div><span className="eyebrow">FLUXARY.IA · MOVIMENTAÇÃO</span><h2 id="transaction-details-title">Detalhes do lançamento</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="transaction-details-card">
          <span className={`transaction-icon ${transaction.type === "income" ? "income" : "expense"}`}>
            {transaction.type === "income" ? <CheckCircle2 size={17} /> : transaction.creditCardKind === "purchase" ? <CreditCard size={17} /> : <Wallet size={17} />}
          </span>
          <div>
            <strong>{transaction.description}</strong>
            <span>{transaction.category}</span>
          </div>
          <b className={transaction.type === "income" ? "amount-positive" : ""}>
            {showValues ? `${transaction.type === "income" ? "+" : "−"} ${money.format(transaction.amount)}` : "R$ •••••"}
          </b>
        </div>
        <dl className="transaction-details-list">
          <div><dt><CalendarDays size={14} /> Data</dt><dd>{formatShortDate(transaction.transaction_date)}</dd></div>
          <div><dt><Wallet size={14} /> Conta</dt><dd>{account?.name ?? (transaction.creditCardKind === "purchase" ? "Cartão de crédito" : "Não vinculada")}</dd></div>
          {card && <div><dt><CreditCard size={14} /> Cartão</dt><dd>{card.issuer}</dd></div>}
          <div><dt>Status</dt><dd>{isPending ? "Pendente" : "Realizada"}</dd></div>
        </dl>
        <div className="transaction-details-actions">
          {isPending && <button type="button" className="button-primary" onClick={onSettle}><CheckCircle2 size={14} /> {actionLabel}</button>}
          <button type="button" className="button-secondary" onClick={onEdit}><Pencil size={14} /> Editar</button>
          <button type="button" className="button-secondary transaction-detail-delete" onClick={onDelete}><Trash2 size={14} /> Excluir</button>
        </div>
      </section>
    </div>
  );
}
