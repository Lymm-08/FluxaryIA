import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TransactionRow } from "../components/TransactionRow";
import type { Transaction, TransactionType } from "../types/finance";
import { money } from "../utils/format";

// Histórico mensal com filtros de receita/despesa e navegação entre períodos.
export function MovementsPage({ transactions, showValues, onAdd, onEdit, onDelete, onOpenTransaction, onSettle, initialMonth, initialType }: {
  transactions: Transaction[];
  showValues: boolean;
  onAdd: () => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onOpenTransaction: (transaction: Transaction) => void;
  onSettle: (transaction: Transaction) => void;
  initialMonth: string;
  initialType: TransactionType | "all";
}) {
  const [month, setMonth] = useState(initialMonth);
  const [type, setType] = useState<TransactionType | "all" | "transfers">(initialType);
  const monthTransactions = transactions.filter((transaction) => transaction.transaction_date.startsWith(month));
  const visibleTransactions = monthTransactions.filter((transaction) =>
    type === "all"
    || (type === "transfers" ? Boolean(transaction.cashBoxKind) : !transaction.cashBoxKind && transaction.type === type),
  );
  const settledTransactions = monthTransactions.filter((transaction) => transaction.isSettled !== false && !transaction.cashBoxKind);
  const income = settledTransactions.filter((transaction) => transaction.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = settledTransactions.filter((transaction) => transaction.type === "expense").reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="section-page">
      <span className="eyebrow">FLUXARY.IA · SEU HISTÓRICO</span>
      <div className="collection-heading">
        <div><h1>Movimentações</h1><p className="section-description">Acompanhe suas entradas e saídas em um só lugar.</p></div>
        <button className="button-primary" onClick={onAdd}><Plus size={14} /> Novo lançamento</button>
      </div>
      <div className="movement-period-toolbar">
        <div className="month-switcher" aria-label="Selecionar mês">
          <button className="icon-button" aria-label="Mês anterior" onClick={() => setMonth((value) => shiftMonth(value, -1))}><ChevronLeft size={17} /></button>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Mês das movimentações" />
          <button className="icon-button" aria-label="Próximo mês" onClick={() => setMonth((value) => shiftMonth(value, 1))}><ChevronRight size={17} /></button>
        </div>
        <div className="movement-period-totals">
          <span>Receitas <strong className="amount-positive">{showValues ? money.format(income) : "R$ •••••"}</strong></span>
          <span>Despesas <strong>{showValues ? money.format(expenses) : "R$ •••••"}</strong></span>
        </div>
      </div>
      <div className="panel section-panel">
        <div className="movement-tabs" role="tablist" aria-label="Filtrar movimentações">
          <button role="tab" aria-selected={type === "all"} className={type === "all" ? "active" : ""} onClick={() => setType("all")}>Todas <span>{monthTransactions.length}</span></button>
          <button role="tab" aria-selected={type === "income"} className={type === "income" ? "active" : ""} onClick={() => setType("income")}>Receitas <span>{monthTransactions.filter((item) => item.type === "income" && !item.cashBoxKind).length}</span></button>
          <button role="tab" aria-selected={type === "expense"} className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>Despesas <span>{monthTransactions.filter((item) => item.type === "expense" && !item.cashBoxKind).length}</span></button>
          <button role="tab" aria-selected={type === "transfers"} className={type === "transfers" ? "active" : ""} onClick={() => setType("transfers")}>Caixinhas <span>{monthTransactions.filter((item) => item.cashBoxKind).length}</span></button>
        </div>
        {visibleTransactions.length
          ? <div className="transaction-list">{visibleTransactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              showValues={showValues}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpen={onOpenTransaction}
              onSettle={onSettle}
            />
          ))}</div>
          : <div className="empty-state">Nenhuma movimentação neste mês. <button className="text-button" onClick={onAdd}>Adicionar lançamento →</button></div>}
      </div>
    </section>
  );
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
