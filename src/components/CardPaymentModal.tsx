import { CreditCard, X } from "lucide-react";
import type { FormEvent } from "react";
import type { CreditCardItem, CustomBank } from "../types/finance";
import { money } from "../utils/format";
import { BankLogo } from "./BankLogo";

export function CardPaymentModal({ card, used, customBanks, onClose, onSubmit }: {
  card: CreditCardItem;
  used: number;
  customBanks: CustomBank[];
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(new FormData(event.currentTarget).get("payment-amount"));
    if (!Number.isFinite(amount) || amount <= 0 || amount > used) return;
    onSubmit(amount);
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
        <p className="card-payment-note"><CreditCard size={14} /> O pagamento será registrado como despesa e reduzirá o saldo atual.</p>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button-primary"><CreditCard size={14} /> Registrar pagamento</button>
        </div>
      </form>
    </div>
  );
}
