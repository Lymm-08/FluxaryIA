import { ArrowDownLeft, ArrowUpRight, Plus, Wallet, X } from "lucide-react";
import { useState } from "react";
import { CategoryGlyph } from "./CategoryGlyph";
import type { BalanceMode } from "./BalanceModal";
import type { Category, CreditCardItem, Transaction, TransactionType } from "../types/finance";
import { getCardUsage } from "../utils/finance";
import { localDateString, money } from "../utils/format";

// Fluxo de lançamento com escolha de tipo e atalhos visuais para categorias.
export function TransactionModal({ categories, cards, transactions, selectedCardId, type, categoryId, onTypeChange, onCategoryChange, onCardChange, onClose, onSubmit, onManageCategories, onBalanceAction }: {
  categories: Category[];
  cards: CreditCardItem[];
  transactions: Transaction[];
  selectedCardId: string;
  type: TransactionType;
  categoryId: string;
  onTypeChange: (type: TransactionType) => void;
  onCategoryChange: (id: string) => void;
  onCardChange: (id: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onManageCategories: () => void;
  onBalanceAction: (mode: BalanceMode) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"account" | "card">("account");
  const filteredCategories = categories.filter((category) => category.type === type);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div><span className="eyebrow">FLUXARY.IA · NOVO LANÇAMENTO</span><h2>Adicionar lançamento</h2></div>
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
              <select name="payment-method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "account" | "card")}>
                <option value="account">Saldo/conta</option>
                <option value="card" disabled={cards.length === 0}>Cartão de crédito</option>
              </select>
            </label>
            {paymentMethod === "card" && cards.length > 0 && (
              <>
                <label>Cartão
                  <select name="credit-card-id" required value={selectedCardId} onChange={(event) => onCardChange(event.target.value)}>
                    {cards.map((card) => {
                      const usage = getCardUsage(card, transactions);
                      return <option key={card.id} value={card.id}>{card.issuer} · disponível {money.format(usage.available)}</option>;
                    })}
                  </select>
                </label>
                <label>Parcelas<input name="installment-count" type="number" min="1" max="24" step="1" defaultValue="1" required /></label>
              </>
            )}
            {paymentMethod === "card" && cards.length === 0 && <p className="card-form-hint">Cadastre um cartão antes de lançar uma compra no crédito.</p>}
          </div>
        )}
        <label className="amount-field">Qual é o valor?<span className="amount-input-wrap"><span>R$</span><input name="amount" required type="number" min="0.01" step="0.01" placeholder="0,00" /></span></label>
        <label>Descrição<input name="description" required maxLength={120} placeholder="Ex.: mercado da semana" /></label>
        <div className="category-picker-heading"><span>Categoria</span><button type="button" className="text-button" onClick={onManageCategories}>Gerenciar categorias</button></div>
        <div className="transaction-category-grid">
          {filteredCategories.map((category) => (
            <button type="button" key={category.id} className={`transaction-category-option ${categoryId === category.id ? "active" : ""}`} onClick={() => onCategoryChange(category.id)}>
              <span style={{ color: category.color, backgroundColor: `${category.color}1A` }}><CategoryGlyph icon={category.emoji} /></span>{category.name}
            </button>
          ))}
        </div>
        <label>Data<input name="transaction_date" type="date" required defaultValue={localDateString(new Date())} /></label>
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Plus size={14} /> Salvar lançamento</button></div>
      </form>
    </div>
  );
}
