import { Sparkles } from "lucide-react";
import { CategoriesPage } from "../pages/CategoriesPage";
import { AccountsPage } from "../pages/AccountsPage";
import { CardsPage } from "../pages/CardsPage";
import { GoalsPage } from "../pages/GoalsPage";
import { CashBoxesPage } from "../pages/CashBoxesPage";
import { PlanningPage } from "../pages/PlanningPage";
import { ChatPage } from "../pages/ChatPage";
import type { Account, BudgetPlan, CashBox, Category, CreditCardItem, CustomBank, FinancialGoal, Transaction } from "../types/finance";

// Encaminha cada seção para sua página isolada.
export function SectionRouter({ page, userId, transactions, categories, accounts, cards, customBanks, plans, goals, cashBoxes, accountBalances, cashBoxSchemaReady, handlers }: {
  page: string;
  userId: string;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  cards: CreditCardItem[];
  customBanks: CustomBank[];
  plans: BudgetPlan[];
  goals: FinancialGoal[];
  cashBoxes: CashBox[];
  accountBalances: Record<string, number>;
  cashBoxSchemaReady: boolean;
  handlers: {
    addTransaction: () => void;
    addCategory: (type: Transaction["type"]) => void;
    editCategory: (category: Category) => void;
    deleteCategory: (category: Category) => void;
    addAccount: () => void;
    editAccount: (account: Account) => void;
    deleteAccount: (account: Account) => void;
    addCard: () => void;
    editCard: (card: CreditCardItem) => void;
    deleteCard: (card: CreditCardItem) => void;
    payCard: (card: CreditCardItem) => void;
    addPlan: () => void;
    editPlan: (plan: BudgetPlan) => void;
    deletePlan: (plan: BudgetPlan) => void;
    addGoal: () => void;
    editGoal: (goal: FinancialGoal) => void;
    deleteGoal: (goal: FinancialGoal) => void;
    addCashBox: (name: string) => boolean;
    depositCashBox: (cashBox: CashBox, accountId: string, amount: number, kind: "deposit" | "withdrawal") => boolean;
  };
}) {
  switch (page) {
    case "Categorias":
      return <CategoriesPage categories={categories} transactions={transactions} onAdd={handlers.addCategory} onEdit={handlers.editCategory} onDelete={handlers.deleteCategory} />;
    case "Contas":
      return <AccountsPage accounts={accounts} customBanks={customBanks} transactions={transactions} onAdd={handlers.addAccount} onEdit={handlers.editAccount} onDelete={handlers.deleteAccount} />;
    case "Cartões":
      return <CardsPage cards={cards} customBanks={customBanks} transactions={transactions} onAdd={handlers.addCard} onEdit={handlers.editCard} onDelete={handlers.deleteCard} onPayCard={handlers.payCard} />;
    case "Planejamento":
      return <PlanningPage plans={plans} transactions={transactions} categories={categories} onAdd={handlers.addPlan} onEdit={handlers.editPlan} onDelete={handlers.deletePlan} />;
    case "Metas":
      return <GoalsPage goals={goals} onAdd={handlers.addGoal} onEdit={handlers.editGoal} onDelete={handlers.deleteGoal} />;
    case "Caixinhas":
      return <CashBoxesPage
        cashBoxes={cashBoxes}
        transactions={transactions}
        accounts={accounts}
        accountBalances={accountBalances}
        schemaReady={cashBoxSchemaReady}
        onCreate={handlers.addCashBox}
        onDeposit={handlers.depositCashBox}
      />;
    case "Chat Fluxary":
      return <ChatPage key={userId} userId={userId} />;
    default:
      return <section className="panel coming-soon-panel"><div className="goal-illustration"><Sparkles size={18} /></div><h2>Estamos preparando este espaço para você.</h2><p>Seus dados continuarão seguros e privados.</p></section>;
  }
}
