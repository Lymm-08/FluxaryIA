import type { ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

// Estrutura reutilizada pelas páginas de contas, cartões, planejamento e metas.
export function CollectionPage({ eyebrow, title, description, action, children, empty }: {
  eyebrow: string;
  title: string;
  description: string;
  action: () => void;
  children: ReactNode;
  empty: boolean;
}) {
  return (
    <section className="section-page">
      <span className="eyebrow">{eyebrow}</span>
      <div className="collection-heading">
        <div><h1>{title}</h1><p className="section-description">{description}</p></div>
        <button className="button-primary" onClick={action}><Plus size={14} /> Adicionar</button>
      </div>
      {empty ? <div className="panel collection-empty"><strong>Nada por aqui ainda</strong><p>Adicione seu primeiro item para acompanhar tudo em um só lugar.</p><button className="button-soft" onClick={action}>Adicionar primeiro item</button></div> : <div className="collection-grid">{children}</div>}
    </section>
  );
}

// Card com menu de ações consistente entre as áreas financeiras.
export function CollectionCard({ icon, title, subtitle, value, progress, progressLabel, action, onEdit, onDelete }: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: string;
  progress?: number;
  progressLabel?: string;
  action?: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="panel collection-card">
      <div className="collection-card-top"><span className="collection-icon">{icon}</span><div className="collection-actions">
        <button className="category-action" aria-label={`Editar ${title}`} onClick={onEdit}><Pencil size={13} /></button>
        <button className="category-action delete" aria-label={`Excluir ${title}`} onClick={onDelete}><Trash2 size={13} /></button>
      </div></div>
      <strong className="collection-title">{title}</strong>
      <span className="collection-subtitle">{subtitle}</span>
      <strong className="collection-value">{value}</strong>
      {progress !== undefined && <div className="goal-progress"><span style={{ width: `${Math.min(100, Math.max(progress, 0))}%` }} /></div>}
      {progress !== undefined && <small className="collection-progress-label">{progressLabel ?? `${Math.round(progress)}% concluído`}</small>}
      {action}
    </article>
  );
}
