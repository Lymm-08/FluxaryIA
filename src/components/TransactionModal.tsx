import { ArrowDownLeft, ArrowUpRight, Plus, Wallet, X } from "lucide-react";
import { useState } from "react";
import { CategoryGlyph } from "./CategoryGlyph";
import { StyledSelect } from "./StyledSelect";
import { DatePicker } from "./DatePicker";
import type { BalanceMode } from "./BalanceModal";
import type { Account, CashBoxDeposit, Category, CreditCardItem, Transaction, TransactionType } from "../types/finance";
import { getAccountBalance, getCardUsage } from "../utils/finance";
import { localDateString, money, parseAmount } from "../utils/format";

// Fluxo de lançamento com escolha de tipo e atalhos visuais para categorias.
export function TransactionModal({ categories, accounts, cards, transactions, cashBoxDeposits, selectedAccountId, selectedCardId, transaction, type, categoryId, onTypeChange, onCategoryChange, onAccountChange, onCardChange, onClose, onSubmit, onManageCategories, onManageAccounts, onBalanceAction }: {
  categories: Category[];
  accounts: Account[];
  cards: CreditCardItem[];
  transactions: Transaction[];
  cashBoxDeposits: CashBoxDeposit[];
  transaction: Transaction | null;
  selectedAccountId: string;
  selectedCardId: string;
  type: TransactionType;
  categoryId: string;
  onTypeChange: (type: TransactionType) => void;
  onCategoryChange: (id: string) => void;
  onAccountChange: (id: string) => void;
  onCardChange: (id: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onManageCategories: () => void;
  onManageAccounts: () => void;
  onBalanceAction: (mode: BalanceMode) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"account" | "card" | "payment">(
    transaction?.creditCardKind === "payment" ? "payment" : transaction?.creditCardKind === "purchase" ? "card" : "account",
  );
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [date, setDate] = useState(transaction?.transaction_date ?? localDateString(new Date()));
  const filteredCategories = categories.filter((category) => category.type === type);
  const selectedCard = cards.find((card) => card.id === selectedCardId);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const selectedAccountBalance = selectedAccount ? getAccountBalance(selectedAccount, transactions, cashBoxDeposits) : null;
  const selectedCardUsage = selectedCard ? getCardUsage(selectedCard, transactions) : null;
  const futureDate = date > localDateString(new Date());
  const pendingSchedule = futureDate || transaction?.isSettled === false;
  const numericAmount = parseAmount(amount);
  const remainingAfterPurchase = selectedCardUsage
    ? selectedCardUsage.available - (Number.isFinite(numericAmount) ? numericAmount : 0)
    : null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div><span className="eyebrow">FLUXARY.IA · {transaction ? "EDITAR LANÇAMENTO" : "NOVO LANÇAMENTO"}</span><h2>{transaction ? "Editar lançamento" : "Adicionar lançamento"}</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="transaction-type-switch" aria-label="Tipo de lançamento">
          <button type="button" className={type === "expense" ? "selected expense-selected" : ""} onClick={() => onTypeChange("expense")}><ArrowUpRight size={14} /> Despesa</button>
          <button type="button" className={type === "income" ? "selected income-selected" : ""} onClick={() => onTypeChange("income")}><ArrowDownLeft size={14} /> Receita</button>
        </div>
        <div className="balance-actions" aria-label="Ações de saldo">
          <button type="button" onClick={() => onBalanceAction("initial")}><Plus size={13} /> Adicionar saldo inicial</button>
          <button type="button" onClick={() => onBalanceAction("adjust")}><Wallet size={13} /> Modificar saldo</button>
        </div>
        {type === "expense" && (
          <div className="payment-method-fields">
            <label>Forma de pagamento
              <StyledSelect
                name="payment-method"
                value={paymentMethod}
                ariaLabel="Forma de pagamento"
                options={[
                  { value: "account", label: "Saldo/conta" },
                  { value: "card", label: "Cartão de crédito", disabled: cards.length === 0 },
                  ...(transaction?.creditCardKind === "payment" ? [{ value: "payment", label: "Pagamento de fatura" }] : []),
                ]}
                onChange={(value) => setPaymentMethod(value as "account" | "card" | "payment")}
              />
            </label>
            {paymentMethod !== "card" && accounts.length > 0 && (
              <>
                <label>{paymentMethod === "payment" ? "Conta usada para pagar a fatura" : "Conta de onde sairá a despesa"}
                  <StyledSelect
                    name="account-id"
                    value={selectedAccountId}
                    ariaLabel={paymentMethod === "payment" ? "Conta usada para pagar a fatura" : "Conta para pagar a despesa"}
                    required
                    options={accounts.map((account) => ({
                      value: account.id,
                      label: `${account.name} · ${money.format(getAccountBalance(account, transactions, cashBoxDeposits))}`,
                    }))}
                    onChange={onAccountChange}
                  />
                </label>
                {selectedAccount && selectedAccountBalance !== null && (
                  <div className="card-limit-preview">
                    <span>Saldo da conta: <strong>{money.format(selectedAccountBalance)}</strong></span>
                    <span>{pendingSchedule ? "Previsão após pagamento:" : "Após este lançamento:"} <strong>{money.format(selectedAccountBalance - (Number.isFinite(numericAmount) ? numericAmount : 0))}</strong></span>
                  </div>
                )}
              </>
            )}
            {paymentMethod !== "card" && accounts.length === 0 && (
              <div className="card-form-hint">
                Cadastre uma conta antes de lançar uma despesa fora do cartão.
                <button type="button" className="text-button" onClick={onManageAccounts}>Ir para Contas →</button>
              </div>
            )}
            {(paymentMethod === "card" || paymentMethod === "payment") && cards.length > 0 && (
              <>
                <label>{paymentMethod === "payment" ? "Cartão da fatura" : "Cartão"}
                  <StyledSelect
                    name="credit-card-id"
                    value={selectedCardId}
                    ariaLabel={paymentMethod === "payment" ? "Cartão da fatura" : "Cartão de crédito"}
                    required
                    options={cards.map((card) => {
                      const usage = getCardUsage(card, transactions);
                      return { value: card.id, label: `${card.issuer} · disponível ${money.format(usage.available)}` };
                    })}
                    onChange={onCardChange}
                  />
                </label>
                {paymentMethod === "card" && <label>Parcelas<input name="installment-count" type="number" min="1" max="24" step="1" defaultValue={transaction?.installmentCount ?? 1} disabled={Boolean(transaction?.installmentGroupId)} required /></label>}
                {paymentMethod === "card" && selectedCard && selectedCardUsage && (
                  <div className={`card-limit-preview ${remainingAfterPurchase !== null && remainingAfterPurchase < 0 ? "card-limit-preview-over" : ""}`}>
                    <span>Limite usado: <strong>{money.format(selectedCardUsage.used)}</strong></span>
                    <span>Disponível após esta compra: <strong>{money.format(remainingAfterPurchase ?? selectedCardUsage.available)}</strong></span>
                    {remainingAfterPurchase !== null && remainingAfterPurchase < 0 && <small>Ao salvar, será solicitada confirmação para ficar acima do limite.</small>}
                  </div>
                )}
              </>
            )}
            {(paymentMethod === "card" || paymentMethod === "payment") && cards.length === 0 && <p className="card-form-hint">Cadastre um cartão antes de lançar uma compra no crédito.</p>}
          </div>
        )}
        {type === "income" && (
          <div className="payment-method-fields">
            {accounts.length > 0 ? (
              <>
                <label>Conta que receberá a receita
                  <StyledSelect
                    name="account-id"
                    value={selectedAccountId}
                    ariaLabel="Conta que receberá a receita"
                    required
                    options={accounts.map((account) => ({
                      value: account.id,
                      label: `${account.name} · ${money.format(getAccountBalance(account, transactions, cashBoxDeposits))}`,
                    }))}
                    onChange={onAccountChange}
                  />
                </label>
                {selectedAccount && selectedAccountBalance !== null && (
                  <div className="card-limit-preview">
                    <span>Saldo da conta: <strong>{money.format(selectedAccountBalance)}</strong></span>
                    <span>{pendingSchedule ? "Previsão após recebimento:" : "Após esta receita:"} <strong>{money.format(selectedAccountBalance + (Number.isFinite(numericAmount) ? numericAmount : 0))}</strong></span>
                  </div>
                )}
              </>
            ) : (
              <div className="card-form-hint">
                Cadastre uma conta antes de lançar uma receita.
                <button type="button" className="text-button" onClick={onManageAccounts}>Ir para Contas →</button>
              </div>
            )}
          </div>
        )}
        <label className="amount-field">Qual é o valor?<span className="amount-input-wrap"><span>R$</span><input name="amount" required type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></span></label>
        <label>Descrição<input name="description" required maxLength={120} defaultValue={transaction?.description ?? ""} placeholder="Ex.: mercado da semana" /></label>
        <div className="category-picker-heading"><span>Categoria</span><button type="button" className="text-button" onClick={onManageCategories}>Gerenciar categorias</button></div>
        {filteredCategories.length ? (
          <div className="transaction-category-grid">
            {filteredCategories.map((category) => (
              <button type="button" key={category.id} className={`transaction-category-option ${categoryId === category.id ? "active" : ""}`} onClick={() => onCategoryChange(category.id)}>
                <span style={{ color: category.color, backgroundColor: `${category.color}1A` }}><CategoryGlyph icon={category.emoji} /></span>{category.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="card-form-hint">
            Nenhuma categoria de {type === "income" ? "receita" : "despesa"} cadastrada.
            <button type="button" className="text-button" onClick={onManageCategories}>Criar categoria →</button>
          </div>
        )}
        <label>Data<DatePicker name="transaction_date" value={date} onChange={setDate} required ariaLabel="Data do lançamento" /></label>
        {pendingSchedule && <p className="scheduled-transaction-hint">Este lançamento ficará agendado. Ele não altera seu saldo atual até você confirmá-lo nas notificações.</p>}
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Plus size={14} /> {transaction ? "Salvar alterações" : "Salvar lançamento"}</button></div>
      </form>
    </div>
  );
}
