import { ArrowDownToLine, Wallet, X } from "lucide-react";
import type { FormEvent } from "react";

export type BalanceMode = "initial" | "adjust";

export function BalanceModal({ mode, currentBalance, onClose, onSubmit }: {
  mode: BalanceMode;
  currentBalance: number;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(Number(form.get("balance-amount")));
  }

  const isInitial = mode === "initial";
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal balance-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">FLUXARY.IA · SALDO</span>
            <h2>{isInitial ? "Adicionar saldo inicial" : "Modificar saldo"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={17} /></button>
        </div>
        <p className="balance-modal-copy">
          {isInitial
            ? "Informe o valor que deseja adicionar ao saldo deste mês."
            : `Saldo atual deste mês: ${currentBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Informe o novo saldo desejado.`}
        </p>
        <label className="amount-field">
          {isInitial ? "Valor do saldo inicial" : "Novo saldo"}
          <span className="amount-input-wrap">
            <span>R$</span>
            <input
              name="balance-amount"
              type="number"
              min={isInitial ? "0.01" : undefined}
              step="0.01"
              required
              autoFocus
              defaultValue={isInitial ? "" : currentBalance.toFixed(2)}
              placeholder="0,00"
            />
          </span>
        </label>
        <div className="balance-modal-note">
          {isInitial ? <ArrowDownToLine size={15} /> : <Wallet size={15} />}
          <span>O ajuste será registrado no histórico financeiro de hoje.</span>
        </div>
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="button-primary"><Wallet size={14} />{isInitial ? "Adicionar saldo" : "Salvar saldo"}</button>
        </div>
      </form>
    </div>
  );
}
