import { CreditCard, X } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { Account, CreditCardItem, CustomBank, Transaction } from "../types/finance";
import { money } from "../utils/format";
import { getAccountBalance } from "../utils/finance";
import { BankLogo } from "./BankLogo";
import { StyledSelect } from "./StyledSelect";

export function CardPaymentModal({ card, used, customBanks, accounts, transactions, selectedAccountId, onAccountChange, onClose, onSubmit }: {
  card: CreditCardItem;
  used: number;
  customBanks: CustomBank[];
  accounts: Account[];
  transactions: Transaction[];
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
  onClose: () => void;
  onSubmit: (amount: number, accountId: string) => void;
}) {
  const [validationError, setValidationError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("payment-amount"));
    const accountId = String(form.get("payment-account-id") ?? "");
    if (!Number.isFinite(amount) || amount <= 0 || amount > used) {
      setValidationError("Informe um valor válido, igual ou menor que o total em aberto.");
      return;
    }
    if (!accounts.some((account) => account.id === accountId)) {
      setValidationError("Selecione a conta usada para pagar a fatura.");
      return;
    }
    setValidationError("");
    onSubmit(amount, accountId);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal card-payment-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">FLUXARY.IA · FATURA</span>
            <h2>Pagar fatura do cartão</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="card-payment-summary">
          <BankLogo bankId={card.bankId} customBanks={customBanks} />
          <span><strong>{card.issuer}</strong><small>Valor em aberto: {money.format(used)}</small></span>
        </div>
        <label className="amount-field">
          Valor pago
          <span className="amount-input-wrap">
            <span>R$</span>
            <input name="payment-amount" type="number" min="0.01" max={used} step="0.01" required autoFocus placeholder="0,00" />
          </span>
        </label>
        {accounts.length > 0 ? (
          <label>Conta usada para pagar a fatura
            <StyledSelect
              name="payment-account-id"
              value={selectedAccountId}
              ariaLabel="Conta usada para pagar a fatura"
              required
              options={accounts.map((account) => ({
                value: account.id,
                label: `${account.name} · ${money.format(getAccountBalance(account, transactions))}`,
              }))}
              onChange={(id) => {
                setValidationError("");
                onAccountChange(id);
              }}
            />
          </label>
        ) : (
          <p className="card-payment-note">Cadastre uma conta em Contas para escolher de onde sairá o pagamento da fatura.</p>
        )}
        {validationError && <p className="card-payment-error" role="alert">{validationError}</p>}
        <p className="card-payment-note"><CreditCard size={14} /> O pagamento será debitado da conta selecionada e reduzirá o valor em aberto do cartão.</p>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button-primary" disabled={accounts.length === 0}><CreditCard size={14} /> Registrar pagamento</button>
        </div>
      </form>
    </div>
  );
}
