import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import type { Transaction } from "../types/finance";
import { formatShortDate, money } from "../utils/format";

// Linha compacta reutilizada no resumo e no histórico de movimentações.
export function TransactionRow({ transaction, showValues, onEdit, onDelete, onOpen, onSettle }: {
  transaction: Transaction;
  showValues: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onOpen?: (transaction: Transaction) => void;
  onSettle?: (transaction: Transaction) => void;
}) {
  const isIncome = transaction.type === "income";
  const paymentType = transaction.creditCardKind === "purchase"
    ? `Compra no cartão${transaction.installmentNumber && transaction.installmentCount ? ` (${transaction.installmentNumber}/${transaction.installmentCount})` : ""}`
    : transaction.creditCardKind === "payment" ? "Pagamento de cartão" : transaction.category;
  return (
    <div
      className={`transaction-row ${onOpen ? "transaction-row-openable" : ""}`}
      role={onOpen ? "group" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(transaction) : undefined}
      onKeyDown={onOpen ? (event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(transaction);
        }
      } : undefined}
      aria-label={onOpen ? `Lançamento ${transaction.description}` : undefined}
    >
      <span className={`transaction-icon ${isIncome ? "income" : "expense"}`}>
        {isIncome ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
      </span>
      <div className="transaction-description">
        <strong>{transaction.description}</strong>
        <span>{transaction.isSettled === false ? "Agendado · " : ""}{paymentType} · {formatShortDate(transaction.transaction_date)}</span>
      </div>
      <strong className={`transaction-amount ${isIncome ? "amount-positive" : ""}`}>
        {showValues ? `${isIncome ? "+" : "−"} ${money.format(transaction.amount)}` : "R$ •••••"}
      </strong>
      {(onSettle && transaction.isSettled === false || onEdit || onDelete) && (
        <div className="transaction-row-actions">
          {onSettle && transaction.isSettled === false && (
            <button type="button" className="button-soft transaction-settle-button" onClick={(event) => {
              event.stopPropagation();
              onSettle(transaction);
            }}>
              <CheckCircle2 size={13} />
              {isIncome ? "Marcar recebida" : "Marcar paga"}
            </button>
          )}
          {onEdit && <button type="button" className="category-action" aria-label={`Editar ${transaction.description}`} onClick={(event) => {
            event.stopPropagation();
            onEdit(transaction);
          }}><Pencil size={13} /></button>}
          {onDelete && <button type="button" className="category-action delete" aria-label={`Excluir ${transaction.description}`} onClick={(event) => {
            event.stopPropagation();
            onDelete(transaction);
          }}><Trash2 size={13} /></button>}
        </div>
      )}
    </div>
  );
}
