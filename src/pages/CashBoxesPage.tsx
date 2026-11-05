import { Pencil, PiggyBank, Plus, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { CashBoxModal } from "../components/CashBoxModal";
import type { Account, CashBox, Transaction } from "../types/finance";
import { getCashBoxBalance } from "../utils/finance";
import { money } from "../utils/format";

export function CashBoxesPage({ cashBoxes, transactions, accounts, accountBalances, schemaReady, onCreate, onRename, onDelete, onDeposit }: {
  cashBoxes: CashBox[];
  transactions: Transaction[];
  accounts: Account[];
  accountBalances: Record<string, number>;
  schemaReady: boolean;
  onCreate: (name: string, operationId: string) => boolean | Promise<boolean>;
  onRename: (cashBox: CashBox, name: string) => boolean | Promise<boolean>;
  onDelete: (cashBox: CashBox) => void;
  onDeposit: (cashBox: CashBox, accountId: string, amount: number, kind: "deposit" | "withdrawal", operationId: string) => boolean | Promise<boolean>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [cashBoxToFund, setCashBoxToFund] = useState<CashBox | null>(null);
  const [cashBoxToEdit, setCashBoxToEdit] = useState<CashBox | null>(null);
  const [movementKind, setMovementKind] = useState<"deposit" | "withdrawal">("deposit");

  return (
    <section className="section-page">
      <span className="eyebrow">FLUXARY.IA · SEU DINHEIRO</span>
      <div className="collection-heading">
        <div><h1>Caixinhas</h1><p className="section-description">Separe dinheiro dos seus saldos e acompanhe quanto guardou.</p></div>
        <button className="button-primary" onClick={() => setCreateOpen(true)} disabled={!schemaReady}><Plus size={14} /> Nova caixinha</button>
      </div>
      {!schemaReady ? (
        <div className="panel collection-empty cash-box-schema-notice" role="status">
          <strong>Ative as caixinhas no Supabase</strong>
          <p>Execute <code>supabase/migrations/20261103020000_cash_boxes.sql</code> e depois <code>supabase/migrations/20261103030000_cash_box_withdrawals.sql</code> no SQL Editor do seu Supabase existente.</p>
        </div>
      ) : cashBoxes.length === 0 ? (
        <div className="panel collection-empty">
          <strong>Comece a guardar do seu jeito</strong>
          <p>Crie uma caixinha e escolha de qual conta sairá cada aporte.</p>
          <button className="button-soft" onClick={() => setCreateOpen(true)}>Criar primeira caixinha</button>
        </div>
      ) : (
        <div className="collection-grid">
          {cashBoxes.map((cashBox) => (
            <article className="panel collection-card cash-box-card" key={cashBox.id}>
              <span className="collection-icon"><PiggyBank size={17} /></span>
              <strong className="collection-title">{cashBox.name}</strong>
              <span className="collection-subtitle">Dinheiro separado do saldo das contas</span>
              <strong className="collection-value">{money.format(getCashBoxBalance(cashBox.id, transactions))}</strong>
              <div className="cash-box-actions">
                <button type="button" className="button-secondary cash-box-deposit-button" onClick={() => setCashBoxToEdit(cashBox)} disabled={!schemaReady}>
                  <Pencil size={14} /> Editar
                </button>
                <button type="button" className="button-secondary cash-box-deposit-button" onClick={() => onDelete(cashBox)} disabled={!schemaReady}>
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
              <div className="cash-box-actions">
                <button type="button" className="button-soft cash-box-deposit-button" onClick={() => {
                  setMovementKind("deposit");
                  setCashBoxToFund(cashBox);
                }} disabled={!accounts.some((account) => (accountBalances[account.id] ?? 0) > 0) || !schemaReady}>
                  <Wallet size={14} /> Adicionar dinheiro
                </button>
                <button type="button" className="button-secondary cash-box-deposit-button" onClick={() => {
                  setMovementKind("withdrawal");
                  setCashBoxToFund(cashBox);
                }} disabled={getCashBoxBalance(cashBox.id, transactions) <= 0 || !accounts.length || !schemaReady}>
                  Retirar dinheiro
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {(createOpen || cashBoxToFund || cashBoxToEdit) && (
        <CashBoxModal
          key={cashBoxToEdit ? `edit-${cashBoxToEdit.id}` : cashBoxToFund ? `fund-${cashBoxToFund.id}-${movementKind}` : "create"}
          cashBox={cashBoxToEdit ?? cashBoxToFund}
          editing={Boolean(cashBoxToEdit)}
          movementKind={movementKind}
          accounts={accounts}
          accountBalances={accountBalances}
          onClose={() => {
            setCreateOpen(false);
            setCashBoxToFund(null);
            setCashBoxToEdit(null);
          }}
          onCreate={onCreate}
          onRename={onRename}
          onDeposit={onDeposit}
        />
      )}
    </section>
  );
}
