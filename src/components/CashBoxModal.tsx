import { Check, Plus, Wallet, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import type { Account, CashBox } from "../types/finance";
import { parseAmount } from "../utils/format";
import { StyledSelect } from "./StyledSelect";

export function CashBoxModal({ cashBox, accounts, accountBalances, onClose, onCreate, onRename, onDeposit, movementKind, editing = false }: {
  cashBox: CashBox | null;
  accounts: Account[];
  accountBalances: Record<string, number>;
  onClose: () => void;
  onCreate: (name: string, operationId: string) => boolean | Promise<boolean>;
  onRename: (cashBox: CashBox, name: string) => boolean | Promise<boolean>;
  movementKind: "deposit" | "withdrawal";
  editing?: boolean;
  onDeposit: (cashBox: CashBox, accountId: string, amount: number, kind: "deposit" | "withdrawal", operationId: string) => boolean | Promise<boolean>;
}) {
  const availableAccounts = movementKind === "deposit"
    ? accounts.filter((account) => (accountBalances[account.id] ?? 0) > 0)
    : accounts;
  const [accountId, setAccountId] = useState(availableAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState(cashBox?.name ?? "");
  const [operationId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const submittingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (editing && cashBox) {
      setSubmitting(true);
      try {
        if (await onRename(cashBox, name.trim())) onClose();
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }
    if (!cashBox) {
      setSubmitting(true);
      try {
        if (await onCreate(String(form.get("cash-box-name") ?? "").trim(), operationId)) onClose();
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    const value = parseAmount(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Informe um valor positivo válido.");
      submittingRef.current = false;
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      if (await onDeposit(cashBox, accountId, value, movementKind, operationId)) onClose();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (!submitting && event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal cash-box-modal" onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">FLUXARY.IA · ORGANIZAÇÃO</span>
            <h2>{editing ? "Editar caixinha" : cashBox ? movementKind === "deposit" ? `Guardar na ${cashBox.name}` : `Retirar da ${cashBox.name}` : "Criar caixinha"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={submitting}><X size={18} /></button>
        </div>
        {editing && cashBox ? (
          <>
            <p className="cash-box-form-copy">Altere o nome sem modificar os aportes, retiradas ou o histórico desta caixinha.</p>
            <label>Nome da caixinha<input name="cash-box-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} autoFocus /></label>
          </>
        ) : cashBox ? (
          <>
            <p className="cash-box-form-copy">
              {movementKind === "deposit"
                ? "Escolha a conta bancária de onde o valor será transferido. Aporte não é registrado como despesa."
                : "Escolha a conta que receberá o dinheiro retirado da caixinha."}
            </p>
            {availableAccounts.length ? (
              <>
                <label>{movementKind === "deposit" ? "Conta de origem" : "Conta de destino"}
                  <StyledSelect
                    name="cash-box-account"
                    value={accountId}
                    ariaLabel={movementKind === "deposit" ? "Conta de origem do aporte" : "Conta de destino da retirada"}
                    required
                    options={availableAccounts.map((account) => {
                      const balance = accountBalances[account.id] ?? 0;
                      return {
                        value: account.id,
                        label: `${account.name} · disponível R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                        disabled: movementKind === "deposit" && balance <= 0,
                      };
                    })}
                    onChange={setAccountId}
                  />
                </label>
                <label className="amount-field">{movementKind === "deposit" ? "Valor do aporte" : "Valor da retirada"}
                  <span className="amount-input-wrap"><span>R$</span><input name="cash-box-amount" type="text" inputMode="decimal" placeholder="0,00" required value={amount} onChange={(event) => {
                    setAmount(event.target.value);
                    setFormError("");
                  }} /></span>
                </label>
              </>
            ) : <p className="cash-box-form-copy">
              {movementKind === "withdrawal"
                ? "Cadastre uma conta em “Contas” antes de escolher onde receber a retirada."
                : accounts.length
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
        {formError && <p className="cash-box-form-copy" role="alert">{formError}</p>}
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="submit" className="button-primary" disabled={submitting || Boolean(cashBox && !editing && availableAccounts.length === 0)}>
            {editing
              ? <><Check size={14} /> Salvar alterações</>
              : cashBox
              ? <><Wallet size={14} /> {movementKind === "deposit" ? "Guardar dinheiro" : "Retirar dinheiro"}</>
              : <><Plus size={14} /> Criar caixinha</>}
          </button>
        </div>
      </form>
    </div>
  );
}
