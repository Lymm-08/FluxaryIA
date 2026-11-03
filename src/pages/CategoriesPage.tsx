import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { CategoryGlyph } from "../components/CategoryGlyph";
import { StyledSelect } from "../components/StyledSelect";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "../data/categories";
import type { Category, Transaction, TransactionType } from "../types/finance";

// Gerencia categorias de receita e despesa, mantendo o histórico financeiro.
export function CategoriesPage({
  categories, transactions, onAdd, onEdit, onDelete,
}: {
  categories: Category[];
  transactions: Transaction[];
  onAdd: (type: TransactionType) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}) {
  const [activeType, setActiveType] = useState<TransactionType>("expense");
  const displayedCategories = categories.filter((category) => category.type === activeType);
  return (
    <section className="section-page">
      <span className="eyebrow">FLUXARY.IA · ORGANIZAÇÃO</span>
      <div className="category-page-heading">
        <div><h1>Categorias</h1><p className="section-description">Deixe cada lançamento com a sua cara e mantenha tudo em ordem.</p></div>
        <button className="button-primary" onClick={() => onAdd(activeType)}><Plus size={14} /> Nova categoria</button>
      </div>
      <div className="category-summary">
        <Summary icon={<ArrowUpRight size={14} />} count={categories.filter((item) => item.type === "expense").length} label="categorias de despesa" tone="expense-summary" />
        <Summary icon={<ArrowDownLeft size={14} />} count={categories.filter((item) => item.type === "income").length} label="categorias de receita" tone="income-summary" />
      </div>
      <div className="panel category-panel">
        <div className="category-tabs" role="tablist" aria-label="Tipo de categoria">
          <button role="tab" aria-selected={activeType === "expense"} className={activeType === "expense" ? "active" : ""} onClick={() => setActiveType("expense")}><ArrowUpRight size={13} /> Despesas</button>
          <button role="tab" aria-selected={activeType === "income"} className={activeType === "income" ? "active" : ""} onClick={() => setActiveType("income")}><ArrowDownLeft size={13} /> Receitas</button>
        </div>
        <div className="category-list">
          {displayedCategories.map((category) => {
            const count = transactions.filter((item) => item.category === category.name && item.type === category.type).length;
            return (
              <article className="category-row" key={category.id}>
                <span className="category-row-icon" style={{ color: category.color, backgroundColor: `${category.color}1A` }}>
                  <CategoryGlyph icon={category.emoji} />
                </span>
                <div className="category-row-name"><strong>{category.name}</strong><span>{count} {count === 1 ? "lançamento" : "lançamentos"}</span></div>
                <div className="category-row-actions">
                  <button type="button" className="category-action" aria-label={`Editar ${category.name}`} onClick={() => onEdit(category)}><Pencil size={13} /></button>
                  <button type="button" className="category-action delete" aria-label={`Excluir ${category.name}`} onClick={() => onDelete(category)}><Trash2 size={13} /></button>
                </div>
              </article>
            );
          })}
          {displayedCategories.length === 0 && (
            <div className="category-empty">
              <span className="category-row-icon"><Tags size={16} /></span>
              <strong>Nenhuma categoria por aqui ainda</strong>
              <p>Crie uma categoria para organizar seus lançamentos.</p>
              <button className="button-soft" onClick={() => onAdd(activeType)}>Criar categoria</button>
            </div>
          )}
        </div>
      </div>
      <p className="category-footnote">Ao excluir uma categoria que já tem lançamentos, eles serão mantidos em “Outros” ou na primeira categoria disponível.</p>
    </section>
  );
}

function Summary({ icon, count, label, tone }: { icon: React.ReactNode; count: number; label: string; tone: string }) {
  return (
    <div><span className={`category-summary-icon ${tone}`}>{icon}</span><span><strong>{count}</strong><small>{label}</small></span></div>
  );
}

// Formulário independente para criar e editar uma categoria.
export function CategoryModal({ category, initialType, onClose, onSubmit }: {
  category: Category | null;
  initialType: TransactionType;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [categoryType, setCategoryType] = useState(category?.type ?? initialType);
  const iconChoices = [...new Set([...(category ? [category.emoji] : []), ...CATEGORY_ICONS])];
  const colorChoices = [...new Set([...(category ? [category.color] : []), ...CATEGORY_COLORS])];

  useEffect(() => {
    setCategoryType(category?.type ?? initialType);
  }, [category?.id, category?.type, initialType]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="transaction-modal category-modal" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div><span className="eyebrow">PERSONALIZE SEU FLUXO</span><h2>{category ? "Editar categoria" : "Nova categoria"}</h2></div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>×</button>
        </div>
        <label>Nome da categoria<input name="category-name" required maxLength={32} defaultValue={category?.name ?? ""} placeholder="Ex.: Pets" autoFocus /></label>
        <label>Tipo
          <StyledSelect
            name="category-type"
            value={categoryType}
            ariaLabel="Tipo de categoria"
            options={[
              { value: "expense", label: "Despesa" },
              { value: "income", label: "Receita" },
            ]}
            onChange={(value) => setCategoryType(value as TransactionType)}
          />
        </label>
        <fieldset className="category-choice-field">
          <legend>Escolha um ícone</legend>
          <div className="emoji-choices">
            {iconChoices.map((icon) => (
              <label key={icon} className="emoji-choice">
                <input type="radio" name="category-emoji" value={icon} defaultChecked={category ? category.emoji === icon : icon === "🍽️"} required />
                <span><CategoryGlyph icon={icon} /></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="category-choice-field">
          <legend>Cor da categoria</legend>
          <div className="color-choices">
            {colorChoices.map((color, index) => (
              <label key={color} className="color-choice">
                <input type="radio" name="category-color" value={color} defaultChecked={category ? category.color === color : index === 0} required />
                <span style={{ backgroundColor: color }} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Plus size={14} /> {category ? "Salvar alterações" : "Criar categoria"}</button></div>
      </form>
    </div>
  );
}
