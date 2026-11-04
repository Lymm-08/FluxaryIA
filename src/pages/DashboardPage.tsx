import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Plus,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { MascotCompanion, type MascotExpression } from "../components/MascotCompanion";
import { TransactionRow } from "../components/TransactionRow";
import { BankLogo } from "../components/BankLogo";
import type { CreditCardItem, CustomBank, DashboardWidget, FinancialGoal, Totals, Transaction, TransactionType } from "../types/finance";
import { getCardInvoiceBalance, getCardUsage } from "../utils/finance";
import { money } from "../utils/format";

// Página inicial: saldo, resumo mensal, lançamentos e atalhos para metas.
export function DashboardPage({
  transactions, cardTransactions, totals, projectedBalance, monthlyBudget, showValues, mascotExpression, mascotMessage, cards, customBanks, goals, dashboardWidgets,
  onToggleValues, onAdd, onAddGoal, onSetBudget, onNavigate,
  onOpenMovements, onPayCard, cloudAccount,
  onOpenTransaction, onOpenTransactions,
}: {
  transactions: Transaction[];
  cardTransactions: Transaction[];
  cards: CreditCardItem[];
  customBanks: CustomBank[];
  goals: FinancialGoal[];
  dashboardWidgets: DashboardWidget[];
  totals: Totals;
  projectedBalance: number;
  monthlyBudget: number | null;
  showValues: boolean;
  mascotExpression: MascotExpression;
  mascotMessage: string;
  onToggleValues: () => void;
  onAdd: () => void;
  onAddGoal: () => void;
  onSetBudget: () => void;
  onNavigate: (page: string) => void;
  onOpenMovements: (type: TransactionType) => void;
  onPayCard: (card: CreditCardItem) => void;
  onOpenTransaction: (transaction: Transaction) => void;
  onOpenTransactions: () => void;
  cloudAccount: boolean;
}) {
  const formatted = (value: number) => showValues ? money.format(value) : "R$ •••••";
  return (
    <>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase()}</span>
          <h1>Bom dia! <span className="wave">✳</span></h1>
          <p>Seu dinheiro, mais leve. Vamos ver como estão as coisas?</p>
        </div>
        <button className="button-primary" onClick={onAdd}><Plus size={16} /> Novo lançamento</button>
      </div>
      <section className="balance-banner">
        <div className="balance-main">
          <div className="balance-label">
            SALDO ATUAL <span className="live-dot" />
            <button className="visibility-toggle" onClick={onToggleValues} aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}>
              {showValues ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          <div className="balance-value">{formatted(totals.balance)}</div>
          <div className="balance-caption">
            <span className="trend-positive"><Wallet size={10} /> Saldo previsto</span>
            <strong>{formatted(projectedBalance)}</strong>
          </div>
        </div>
        <MascotCompanion expression={mascotExpression} message={mascotMessage} />
        <div className={`balance-tip ${mascotExpression === "alert" ? "balance-tip-alert" : ""}`}>
          <span className="tip-icon">{mascotExpression === "alert" ? <AlertTriangle size={12} /> : <Sparkles size={12} />}</span>
          <span>{mascotMessage}</span>
        </div>
      </section>
      <section className="metrics-grid">
        <MetricCard title="Receitas do mês" value={formatted(totals.income)} icon={<ArrowDownLeft size={15} />} tone="green" foot="Entradas neste mês" onClick={() => onOpenMovements("income")} />
        <MetricCard
          title="Despesas do mês"
          value={formatted(totals.expenses)}
          icon={<ArrowUpRight size={15} />}
          tone="coral"
          onClick={() => onOpenMovements("expense")}
          foot={monthlyBudget === null ? (
            <button className="budget-inline-button" onClick={(event) => { event.stopPropagation(); onSetBudget(); }}>Definir limite mensal <span>→</span></button>
          ) : (
            <div className="budget-metric-footer">
              <div className="budget-meta">
                <span>Limite: {money.format(monthlyBudget)}</span>
                <button className="budget-inline-button" onClick={(event) => { event.stopPropagation(); onSetBudget(); }}>Editar</button>
              </div>
              <div className="budget-track" aria-label={`${Math.min(100, Math.round((totals.expenses / monthlyBudget) * 100))}% do orçamento usado`}>
                <i className={totals.expenses > monthlyBudget ? "budget-over" : ""} style={{ width: `${Math.min(100, (totals.expenses / monthlyBudget) * 100)}%` }} />
              </div>
            </div>
          )}
        />
      </section>
      {dashboardWidgets.includes("cards") && (
        <section className="panel dashboard-cards-panel" aria-labelledby="dashboard-cards-heading">
          <div className="panel-heading">
            <div><span className="eyebrow">ACOMPANHE SEU CRÉDITO</span><h2 id="dashboard-cards-heading">Limite dos cartões</h2></div>
            <button className="text-button" onClick={() => onNavigate("Cartões")}>Ver cartões <span>→</span></button>
          </div>
          {cards.length ? (
            <div className="dashboard-card-list">
              {cards.map((card, index) => {
                const usage = getCardUsage(card, cardTransactions);
                const invoiceBalance = getCardInvoiceBalance(card, cardTransactions);
                const cardLabel = `${card.issuer}${cards.filter((item) => item.issuer === card.issuer).length > 1 ? ` · ${index + 1}` : ""}`;
                return (
                  <article className="dashboard-credit-card" key={card.id}>
                    <BankLogo bankId={card.bankId} customBanks={customBanks} size={32} />
                    <div className="dashboard-credit-card-main">
                      <div className="dashboard-credit-card-heading"><strong>{cardLabel}</strong><span>{usage.available < 0 ? `Acima do limite ${money.format(Math.abs(usage.available))}` : `Disponível ${money.format(usage.available)}`}</span></div>
                      <div className="card-limit-track" role="progressbar" aria-label={`${cardLabel}: limite utilizado`} aria-valuenow={Math.round(usage.progress)} aria-valuemin={0} aria-valuemax={100}>
                        <i className={usage.progress >= 90 ? "card-limit-near" : ""} style={{ width: `${usage.progress}%` }} />
                      </div>
                      <small>{money.format(usage.used)} de {money.format(card.creditLimit)} utilizados</small>
                    </div>
                    <button className="button-soft dashboard-pay-card" type="button" disabled={invoiceBalance <= 0} onClick={() => onPayCard(card)}>Pagar</button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-card-empty">
              <span>Nenhum cartão cadastrado ainda.</span>
              <button className="text-button" onClick={() => onNavigate("Cartões")}>Adicionar cartão <span>→</span></button>
            </div>
          )}
        </section>
      )}
      <section className={`content-grid ${dashboardWidgets.includes("goals") ? "" : "content-grid-single"}`}>
        <div className="panel transactions-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">ACOMPANHE DE PERTO</span><h2>Últimas movimentações</h2></div>
            <button type="button" className="text-button" onClick={onOpenTransactions}>Ver todas <span>→</span></button>
          </div>
          {transactions.length ? (
            <div className="transaction-list">{transactions.slice(0, 5).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} showValues={showValues} onOpen={onOpenTransaction} />)}</div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon"><ArrowLeftRight size={16} /></span>
              <strong>Seu começo merece ser celebrado</strong>
              <span>Adicione uma receita ou despesa para acompanhar sua vida financeira por aqui.</span>
              <button className="text-button" onClick={onAdd}>Adicionar primeira movimentação <span>→</span></button>
            </div>
          )}
        </div>
        {dashboardWidgets.includes("goals") && <div className="panel goals-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">UM OBJETIVO DE CADA VEZ</span><h2>Suas metas</h2></div>
            <button className="round-add" aria-label="Adicionar meta" onClick={onAddGoal}><Plus size={14} /></button>
          </div>
          {goals.length ? (
            <div className="dashboard-goal-list">
              {goals.slice(0, 3).map((goal) => {
                const progress = Math.min(100, goal.target > 0 ? (goal.saved / goal.target) * 100 : 0);
                return (
                  <article className="dashboard-goal-item" key={goal.id}>
                    <span className="dashboard-goal-icon"><Target size={15} /></span>
                    <div className="dashboard-goal-main">
                      <div className="dashboard-goal-heading"><strong>{goal.name}</strong><span>{Math.round(progress)}%</span></div>
                      <div className="goal-progress"><span style={{ width: `${progress}%` }} /></div>
                      <small>{money.format(goal.saved)} de {money.format(goal.target)}</small>
                    </div>
                  </article>
                );
              })}
              {goals.length > 3 && <button className="text-button dashboard-goals-more" onClick={() => onNavigate("Metas")}>Ver todas as metas <span>→</span></button>}
            </div>
          ) : (
            <div className="goal-empty">
              <div className="goal-illustration"><Target size={18} /><span><Sparkles size={10} /></span></div>
              <strong>Qual é o seu próximo sonho?</strong>
              <p>Uma viagem, uma reserva ou algo especial. Comece a planejar.</p>
            </div>
          )}
        </div>}
      </section>
      <div className="security-note">{cloudAccount ? "Seus dados estão sincronizados com segurança na sua conta." : "Seus dados ficam salvos apenas neste navegador e dispositivo."}</div>
    </>
  );
}

function MetricCard({ title, value, icon, tone, foot, onClick }: {
  title: string; value: string; icon: React.ReactNode; tone: string; foot: React.ReactNode; onClick: () => void;
}) {
  return (
    <article className="metric-card metric-card-clickable" role="button" tabIndex={0} onClick={onClick} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); }
    }} aria-label={`${title}. Abrir lançamentos do mês.`}>
      <div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}>{icon}</span></div>
      <strong>{value}</strong><div className="metric-foot">{foot}</div>
    </article>
  );
}
