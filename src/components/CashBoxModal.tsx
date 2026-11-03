import { Plus, Wallet, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Account, CashBox } from "../types/finance";
import { parseAmount } from "../utils/format";
import { StyledSelect } from "./StyledSelect";

export function CashBoxModal({ cashBox, accounts, accountBalances, onClose, onCreate, onDeposit }: {
  cashBox: CashBox | null;
  accounts: Account[];
  accountBalances: Record<string, number>;
  onClose: () => void;
  onCreate: (name: string) => boolean;
  onDeposit: (cashBox: CashBox, accountId: string, amount: number) => boolean;
}) {
  const fundableAccounts = accounts.filter((account) => (accountBalances[account.id] ?? 0) > 0);
  const [accountId, setAccountId] = useState(fundableAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!cashBox) {
      if (onCreate(String(form.get("cash-box-name") ?? "").trim())) onClose();
      return;
    }

    const value = parseAmount(amount);
    if (Number.isFinite(value) && onDeposit(cashBox, accountId, value)) onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal cash-box-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">FLUXARY.IA · ORGANIZAÇÃO</span>
            <h2>{cashBox ? `Guardar na ${cashBox.name}` : "Criar caixinha"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={18} /></button>
        </div>
        {cashBox ? (
          <>
            <p className="cash-box-form-copy">Escolha a conta bancária de onde o valor será transferido. Aporte não é registrado como despesa.</p>
            {fundableAccounts.length ? (
              <>
                <label>Conta de origem
                  <StyledSelect
                    name="cash-box-account"
                    value={accountId}
                    ariaLabel="Conta de origem do aporte"
                    required
                    options={fundableAccounts.map((account) => {
                      const balance = accountBalances[account.id] ?? 0;
                      return {
                        value: account.id,
                        label: `${account.name} · disponível R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                        disabled: balance <= 0,
                      };
                    })}
                    onChange={setAccountId}
                  />
                </label>
                <label className="amount-field">Valor do aporte
                  <span className="amount-input-wrap"><span>R$</span><input name="cash-box-amount" type="text" inputMode="decimal" placeholder="0,00" required value={amount} onChange={(event) => setAmount(event.target.value)} /></span>
                </label>
              </>
            ) : <p className="cash-box-form-copy">
              {accounts.length
                ? "Nenhuma conta tem saldo disponível para fazer um aporte."
                : "Cadastre uma conta em “Contas” antes de colocar dinheiro na caixinha."}
            </p>}
          </>
        ) : (
          <>
            <p className="cash-box-form-copy">Crie um espaço para separar dinheiro. Você escolhe a conta de origem em cada aporte.</p>
            <label>Nome da caixinha<input name="cash-box-name" required maxLength={60} autoFocus placeholder="Ex.: Viagem, reserva, casa..." /></label>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button-primary" disabled={Boolean(cashBox && fundableAccounts.length === 0)}>
            {cashBox ? <><Wallet size={14} /> Guardar dinheiro</> : <><Plus size={14} /> Criar caixinha</>}
          </button>
        </div>
      </form>
    </div>
  );
}
