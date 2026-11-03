import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Transaction } from "../types/finance";
import { formatShortDate, money } from "../utils/format";

// Linha compacta reutilizada no resumo e no histórico de movimentações.
export function TransactionRow({ transaction, showValues }: { transaction: Transaction; showValues: boolean }) {
  const isIncome = transaction.type === "income";
  const paymentType = transaction.creditCardKind === "purchase"
    ? `Compra no cartão${transaction.installmentNumber && transaction.installmentCount ? ` (${transaction.installmentNumber}/${transaction.installmentCount})` : ""}`
    : transaction.creditCardKind === "payment" ? "Pagamento de cartão" : transaction.category;
  return (
    <div className="transaction-row">
      <span className={`transaction-icon ${isIncome ? "income" : "expense"}`}>
        {isIncome ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
      </span>
      <div className="transaction-description">
        <strong>{transaction.description}</strong>
        <span>{paymentType} · {formatShortDate(transaction.transaction_date)}</span>
      </div>
      <strong className={`transaction-amount ${isIncome ? "amount-positive" : ""}`}>
        {showValues ? `${isIncome ? "+" : "−"} ${money.format(transaction.amount)}` : "R$ •••••"}
      </strong>
    </div>
  );
}
