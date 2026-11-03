import { PiggyBank, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { CashBoxModal } from "../components/CashBoxModal";
import type { Account, CashBox, CashBoxDeposit } from "../types/finance";
import { getCashBoxBalance } from "../utils/finance";
import { money } from "../utils/format";

export function CashBoxesPage({ cashBoxes, deposits, accounts, accountBalances, schemaReady, onCreate, onDeposit }: {
  cashBoxes: CashBox[];
  deposits: CashBoxDeposit[];
  accounts: Account[];
  accountBalances: Record<string, number>;
  schemaReady: boolean;
  onCreate: (name: string) => boolean;
  onDeposit: (cashBox: CashBox, accountId: string, amount: number) => boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [cashBoxToFund, setCashBoxToFund] = useState<CashBox | null>(null);

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
          <p>Execute <code>supabase/migrations/20261103020000_cash_boxes.sql</code> no SQL Editor para criar as tabelas com proteção RLS.</p>
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
              <strong className="collection-value">{money.format(getCashBoxBalance(cashBox.id, deposits))}</strong>
              <button type="button" className="button-soft cash-box-deposit-button" onClick={() => setCashBoxToFund(cashBox)} disabled={!accounts.some((account) => (accountBalances[account.id] ?? 0) > 0) || !schemaReady}>
                <Wallet size={14} /> Adicionar dinheiro
              </button>
            </article>
          ))}
        </div>
      )}
      {(createOpen || cashBoxToFund) && (
        <CashBoxModal
          cashBox={cashBoxToFund}
          accounts={accounts}
          accountBalances={accountBalances}
          onClose={() => {
            setCreateOpen(false);
            setCashBoxToFund(null);
          }}
          onCreate={onCreate}
          onDeposit={onDeposit}
        />
      )}
    </section>
  );
}
