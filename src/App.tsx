import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { AppShell, ErrorNotice } from "./components/AppShell";
import { BudgetModal } from "./components/BudgetModal";
import { BalanceModal, type BalanceMode } from "./components/BalanceModal";
import { CardPaymentModal } from "./components/CardPaymentModal";
import { CategoryModal } from "./pages/CategoriesPage";
import { FinanceEntryModal, type FinanceEntry, type FinanceEntryType } from "./components/FinanceEntryModal";
import { SectionRouter } from "./components/SectionRouter";
import { TransactionModal } from "./components/TransactionModal";
import { useFinanceData } from "./hooks/useFinanceData";
import { AuthPage } from "./auth/AuthPage";
import { useAuth } from "./auth/AuthProvider";
import { SettingsPage } from "./pages/SettingsPage";
import type {
  Account, BudgetPlan, Category, CreditCardItem, FinancialGoal, Transaction, TransactionType,
} from "./types/finance";
import { calculateTotals, getCardUsage } from "./utils/finance";
import { localDateString } from "./utils/format";
import { money } from "./utils/format";
import type { MascotExpression } from "./components/MascotCompanion";
import { MovementsPage } from "./pages/MovementsPage";

type MascotFeedback = { expression: MascotExpression; message: string };

// Decide entre conta autenticada, recuperação de senha e modo local.
function App() {
  const auth = useAuth();

  if (auth.loading) return <div className="screen-state">Carregando sua conta...</div>;
  if (auth.passwordRecovery) {
    return <AuthPage
      key="password-recovery"
      configured={auth.configured} recovery onSignIn={auth.signIn} onSignUp={auth.signUp}
      onGoogleSignIn={auth.signInWithGoogle} onSendPasswordReset={auth.sendPasswordReset}
      onUpdatePassword={auth.updatePassword} onRecoveryComplete={auth.finishPasswordRecovery}
    />;
  }
  if (!auth.user) {
    return <AuthPage
      key="sign-in"
      configured={auth.configured} recovery={false} onSignIn={auth.signIn} onSignUp={auth.signUp}
      onGoogleSignIn={auth.signInWithGoogle} onSendPasswordReset={auth.sendPasswordReset}
      onUpdatePassword={auth.updatePassword} onRecoveryComplete={auth.finishPasswordRecovery}
    />;
  }
  return <FinanceWorkspace
    userId={auth.user?.id ?? null} userEmail={auth.user?.email ?? null}
    onSignOut={async () => {
      await auth.signOut();
    }}
    onUpdatePassword={auth.updatePassword}
  />;
}

// Estado financeiro isolado da tela de autenticação para não misturar dados entre contas.
function FinanceWorkspace({ userId, userEmail, onSignOut, onUpdatePassword }: {
  userId: string | null;
  userEmail: string | null;
  onSignOut: () => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const reportError = useCallback((message: string) => setError(message), []);
  const finance = useFinanceData(reportError, userId);
  const [page, setPage] = useState("Visão geral");
  const [showValues, setShowValues] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [movementFilter, setMovementFilter] = useState<{ month: string; type: TransactionType | "all" }>({
    month: localDateString(new Date()).slice(0, 7), type: "all",
  });
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [balanceMode, setBalanceMode] = useState<BalanceMode | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryFormType, setCategoryFormType] = useState<TransactionType>("expense");
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCreditCardId, setSelectedCreditCardId] = useState("");
  const [cardPaymentTarget, setCardPaymentTarget] = useState<CreditCardItem | null>(null);
  const [entryType, setEntryType] = useState<FinanceEntryType | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<FinanceEntry>(null);
  const [mascotFeedback, setMascotFeedback] = useState<MascotFeedback | null>(null);

  const totals = useMemo(
    () => calculateTotals(finance.transactions, finance.accounts),
    [finance.accounts, finance.transactions],
  );
  const monthlyBudget = finance.monthlyBudget;
  const budgetExceeded = monthlyBudget !== null && totals.expenses > monthlyBudget;
  const mascotExpression: MascotExpression = budgetExceeded ? "alert" : mascotFeedback?.expression ?? "neutral";
  const mascotMessage = budgetExceeded
    ? `As despesas do mês passaram do limite de ${money.format(monthlyBudget)}.`
    : mascotFeedback?.message ?? "Estou por aqui para acompanhar seu mês.";

  useEffect(() => {
    document.documentElement.dataset.theme = finance.darkMode ? "dark" : "light";
  }, [finance.darkMode]);

  useEffect(() => {
    if (!mascotFeedback) return;
    const timeout = window.setTimeout(() => setMascotFeedback(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [mascotFeedback]);

  if (finance.loading) return <div className="screen-state">Carregando seus dados financeiros...</div>;
  if (finance.loadError) return (
    <div className="screen-state cloud-error-state">
      <strong>Não foi possível carregar sua conta.</strong>
      <span>{finance.loadError}</span>
      <button className="button-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
    </div>
  );

  // Navegação e inicialização de formulários.
  function navigateToPage(nextPage: string) {
    if (nextPage === "Visão geral" && page !== "Visão geral") {
      setMascotFeedback({ expression: "welcome", message: "Que bom ter você por aqui! Vamos cuidar do seu mês?" });
    }
    setPage(nextPage);
    setMobileMenuOpen(false);
  }

  function openTransactionForm() {
    setTransactionType("expense");
    setSelectedCategoryId(finance.categories.find((category) => category.type === "expense")?.id ?? "");
    setSelectedCreditCardId(finance.cards[0]?.id ?? "");
    setBalanceMode(null);
    setShowTransactionForm(true);
  }

  function openBalanceForm(mode: BalanceMode) {
    setShowTransactionForm(false);
    setBalanceMode(mode);
  }

  function saveBalance(amount: number, mode: BalanceMode, action: "initial" | "adjust" | "reset" = mode) {
    if (!Number.isFinite(amount) || (mode === "initial" && amount <= 0)) {
      setError("Informe um valor válido para o saldo.");
      return;
    }

    const difference = mode === "initial" ? amount : amount - totals.balance;
    if (difference === 0) {
      setBalanceMode(null);
      setError("");
      setMascotFeedback({
        expression: "approval",
        message: action === "reset" ? "O saldo deste mês já está zerado." : "O saldo já está neste valor.",
      });
      return;
    }

    const type: TransactionType = difference > 0 ? "income" : "expense";
    const category = finance.categories.find((item) => item.type === type);
    if (!category) {
      setError("Crie uma categoria de receita e despesa antes de ajustar o saldo.");
      return;
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      description: action === "initial" ? "Saldo inicial" : action === "reset" ? "Zeragem de saldo" : "Ajuste de saldo",
      category: category.name,
      categoryId: category.id,
      transaction_date: localDateString(new Date()),
      amount: Math.abs(difference),
      type,
    };
    finance.setTransactions((current) =>
      [transaction, ...current].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
    );
    setBalanceMode(null);
    setError("");
    setMascotFeedback({
      expression: "approval",
      message: action === "initial" ? "Saldo inicial adicionado." : action === "reset" ? "Saldo do mês zerado; seu histórico foi preservado." : "Saldo atualizado.",
    });
  }

  function resetMonthlyBalance() {
    if (!window.confirm("Zerar o saldo do mês atual?\n\nSeus lançamentos e o histórico serão preservados; um ajuste será registrado para deixar o saldo em R$ 0,00.")) return;
    saveBalance(0, "adjust", "reset");
  }

  function openMonthlyMovements(type: TransactionType) {
    setMovementFilter({ month: localDateString(new Date()).slice(0, 7), type });
    navigateToPage("Movimentações");
  }

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 820px)").matches) setMobileMenuOpen((open) => !open);
    else setSidebarCollapsed((collapsed) => !collapsed);
  }

  function openCategoryForm(type: TransactionType = "expense") {
    setCategoryToEdit(null);
    setCategoryFormType(type);
    setShowCategoryForm(true);
  }

  function openFinanceEntry(type: FinanceEntryType, entry: FinanceEntry = null) {
    setEntryType(type);
    setEntryToEdit(entry);
  }

  function closeFinanceEntry() {
    setEntryType(null);
    setEntryToEdit(null);
  }

  // Lançamentos, categorias e limites mensais.
  function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const category = finance.categories.find((item) => item.id === selectedCategoryId && item.type === transactionType);
    const amount = Number(formData.get("amount"));
    const usesCard = transactionType === "expense" && formData.get("payment-method") === "card";
    const card = usesCard ? finance.cards.find((item) => item.id === String(formData.get("credit-card-id"))) : undefined;
    const installmentCount = usesCard ? Number(formData.get("installment-count")) : 1;
    if (!category || !Number.isFinite(amount) || amount <= 0) {
      setError("Escolha uma categoria válida e informe um valor maior que zero.");
      return;
    }
    if (usesCard && !card) {
      setError("Selecione um cartão cadastrado para esta compra.");
      return;
    }
    if (usesCard && (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 24)) {
      setError("Informe entre 1 e 24 parcelas.");
      return;
    }
    if (card && amount > getCardUsage(card, finance.transactions).available) {
      setError("A compra ultrapassa o limite disponível deste cartão.");
      return;
    }
    const description = String(formData.get("description")).trim();
    const date = String(formData.get("transaction_date"));
    const installmentGroupId = card && installmentCount > 1 ? crypto.randomUUID() : undefined;
    const installmentAmounts = splitAmount(amount, installmentCount);
    const newTransactions: Transaction[] = installmentAmounts.map((installmentAmount, index) => {
      const installmentNumber = index + 1;
      return {
        id: crypto.randomUUID(),
        description,
        category: category.name,
        categoryId: category.id,
        transaction_date: addMonthsToDate(date, index),
        amount: installmentAmount,
        type: transactionType,
        ...(card ? {
          creditCardId: card.id,
          creditCardKind: "purchase" as const,
          ...(installmentGroupId ? { installmentGroupId } : {}),
          ...(installmentCount > 1 ? { installmentNumber, installmentCount } : {}),
        } : {}),
      };
    });
    const nextTransactions = [...newTransactions, ...finance.transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    const nextTotals = calculateTotals(nextTransactions, finance.accounts);
    finance.setTransactions(nextTransactions);
    setShowTransactionForm(false);
    setError("");
    if (monthlyBudget !== null && nextTotals.expenses > monthlyBudget) setMascotFeedback(null);
    else if (newTransactions[0]?.type === "income" && nextTotals.balance > 0) {
      setMascotFeedback({ expression: "celebration", message: "Boa! As receitas superaram as despesas deste mês." });
    } else {
      setMascotFeedback({ expression: "approval", message: "Lançamento registrado com sucesso!" });
    }
  }

  function recordCardPayment(amount: number) {
    const card = cardPaymentTarget;
    if (!card || !Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido para o pagamento.");
      return;
    }
    const usage = getCardUsage(card, finance.transactions);
    if (amount > usage.used) {
      setError("O pagamento não pode ser maior que o valor em aberto neste cartão.");
      return;
    }
    const category = finance.categories.find((item) => item.type === "expense");
    if (!category) {
      setError("Crie uma categoria de despesa antes de registrar o pagamento.");
      return;
    }
    const payment: Transaction = {
      id: crypto.randomUUID(),
      description: `Pagamento da fatura - ${card.issuer}`,
      category: category.name,
      categoryId: category.id,
      transaction_date: localDateString(new Date()),
      amount,
      type: "expense",
      creditCardId: card.id,
      creditCardKind: "payment",
    };
    finance.setTransactions((current) => [payment, ...current].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)));
    setCardPaymentTarget(null);
    setError("");
    setMascotFeedback({ expression: "approval", message: "Pagamento registrado; o limite do cartão foi atualizado." });
  }

  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("category-name")).trim();
    const type = String(formData.get("category-type")) as TransactionType;
    const emoji = String(formData.get("category-emoji"));
    const color = String(formData.get("category-color"));
    if (!name || (type !== "income" && type !== "expense")) {
      setError("Informe um nome e um tipo válido para a categoria.");
      return;
    }
    const duplicate = finance.categories.some((category) =>
      category.type === type
      && category.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0
      && category.id !== categoryToEdit?.id,
    );
    if (duplicate) {
      setError("Já existe uma categoria com esse nome para este tipo.");
      return;
    }
    if (categoryToEdit) {
      const linkedPlan = finance.plans.find((plan) => plan.category === categoryToEdit.name);
      if (linkedPlan && type !== "expense") {
        setError("Ajuste ou remova o planejamento mensal antes de transformar esta categoria em receita.");
        return;
      }
      if (linkedPlan && finance.plans.some((plan) => plan.category === name && plan.id !== linkedPlan.id)) {
        setError("Já existe um planejamento para a nova categoria.");
        return;
      }
      finance.setCategories((current) => current.map((category) =>
        category.id === categoryToEdit.id ? { ...category, name, type, emoji, color } : category,
      ));
      if (categoryToEdit.name !== name || categoryToEdit.type !== type) {
        finance.setTransactions((current) => current.map((transaction) =>
          transaction.category === categoryToEdit.name && transaction.type === categoryToEdit.type
            ? { ...transaction, category: name, categoryId: categoryToEdit.id, type }
            : transaction,
        ));
      }
      if (linkedPlan && linkedPlan.category !== name) {
        finance.setPlans((current) => current.map((plan) =>
          plan.id === linkedPlan.id ? { ...plan, category: name } : plan,
        ));
      }
    } else {
      finance.setCategories((current) => [...current, { id: crypto.randomUUID(), name, type, emoji, color }]);
    }
    setShowCategoryForm(false);
    setCategoryToEdit(null);
    setError("");
  }

  function deleteCategory(category: Category) {
    const remaining = finance.categories.filter((item) => item.type === category.type && item.id !== category.id);
    if (remaining.length === 0) {
      setError("Mantenha pelo menos uma categoria para cada tipo de lançamento.");
      return;
    }
    const related = finance.transactions.filter((item) => item.category === category.name && item.type === category.type);
    const fallback = remaining.find((item) => item.name === "Outros") ?? remaining[0];
    const prompt = related.length
      ? `Excluir "${category.name}"? ${related.length} lançamento(s) serão movidos para "${fallback.name}".`
      : `Excluir a categoria "${category.name}"?`;
    if (!window.confirm(prompt)) return;
    finance.setCategories((current) => current.filter((item) => item.id !== category.id));
    finance.setTransactions((current) => current.map((item) =>
      item.category === category.name && item.type === category.type
        ? { ...item, category: fallback.name, categoryId: fallback.id }
        : item,
    ));
    finance.setPlans((current) => {
      const removedPlan = current.find((plan) => plan.category === category.name);
      if (!removedPlan) return current;
      const fallbackPlan = current.find((plan) => plan.category === fallback.name);
      if (!fallbackPlan) {
        return current.map((plan) => plan.id === removedPlan.id
          ? { ...plan, category: fallback.name, categoryId: fallback.id }
          : plan);
      }
      return current
        .filter((plan) => plan.id !== removedPlan.id)
        .map((plan) => plan.id === fallbackPlan.id ? { ...plan, limit: plan.limit + removedPlan.limit } : plan);
    });
    setError("");
  }

  function saveMonthlyBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const budget = Number(new FormData(event.currentTarget).get("monthly-budget"));
    if (!Number.isFinite(budget) || budget <= 0) {
      setError("Informe um limite mensal maior que zero.");
      return;
    }
    finance.setMonthlyBudget(budget);
    setShowBudgetForm(false);
    setError("");
    setMascotFeedback({ expression: "approval", message: "Seu limite mensal foi atualizado." });
  }

  // Criação e edição tipada para contas, cartões, planos e metas.
  function saveFinanceEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entryType) return;
    const form = new FormData(event.currentTarget);
    const id = (entryToEdit as { id: string } | null)?.id ?? crypto.randomUUID();
    const name = String(form.get("name") ?? "").trim();

    switch (entryType) {
      case "account": {
        const balance = Number(form.get("balance"));
        const bankId = String(form.get("bankId"));
        if (!bankId || !String(form.get("institution")).trim()) return setError("Selecione um banco ou cadastre uma instituição personalizada.");
        const entry: Account = { id, name, institution: String(form.get("institution")).trim(), bankId, balance };
        if (!entry.name || !entry.institution || !Number.isFinite(balance)) return setError("Preencha os dados da conta corretamente.");
        finance.setAccounts((current) => upsert(current, entry));
        break;
      }
      case "card": {
        const bankId = String(form.get("bankId"));
        if (!bankId || !String(form.get("issuer")).trim()) return setError("Selecione um banco emissor ou cadastre uma instituição personalizada.");
        const issuer = String(form.get("issuer")).trim();
        const entry: CreditCardItem = {
          id, name: `Cartão ${issuer}`, issuer, bankId, lastFour: "",
          creditLimit: Number(form.get("creditLimit")), closingDay: 10, dueDay: 17,
        };
        if (!entry.issuer || !Number.isFinite(entry.creditLimit) || entry.creditLimit <= 0) return setError("Selecione o banco e informe um limite maior que zero.");
        finance.setCards((current) => upsert(current, entry));
        break;
      }
      case "plan": {
        const category = finance.categories.find((item) =>
          item.type === "expense" && item.name === String(form.get("category")),
        );
        const entry: BudgetPlan = {
          id, category: String(form.get("category")), categoryId: category?.id, limit: Number(form.get("limit")),
        };
        if (!entry.category || !entry.categoryId || !Number.isFinite(entry.limit) || entry.limit <= 0) return setError("Escolha uma categoria e um limite válido.");
        const duplicate = finance.plans.some((plan) => plan.category === entry.category && plan.id !== entry.id);
        if (duplicate) return setError("Já existe um planejamento para essa categoria.");
        finance.setPlans((current) => upsert(current, entry));
        break;
      }
      case "goal": {
        const entry: FinancialGoal = {
          id, name, target: Number(form.get("target")), saved: Number(form.get("saved")), deadline: String(form.get("deadline")),
        };
        if (!entry.name || !Number.isFinite(entry.target) || entry.target <= 0 || !Number.isFinite(entry.saved) || entry.saved < 0) {
          return setError("Informe nome, valor da meta e valor guardado corretamente.");
        }
        finance.setGoals((current) => upsert(current, entry));
        break;
      }
    }
    closeFinanceEntry();
    setError("");
  }

  function removeEntry(type: FinanceEntryType, item: FinanceEntry) {
    if (!item) return;
    if (type === "card" && finance.transactions.some((transaction) => transaction.creditCardId === item.id)) {
      setError("Este cartão tem compras ou pagamentos no histórico. Remova os lançamentos vinculados antes de excluí-lo.");
      return;
    }
    if (!window.confirm(`Excluir "${"name" in item ? item.name : "category" in item ? item.category : ""}"?`)) return;
    if (type === "account") finance.setAccounts((current) => current.filter((entry) => entry.id !== item.id));
    if (type === "card") finance.setCards((current) => current.filter((entry) => entry.id !== item.id));
    if (type === "plan") finance.setPlans((current) => current.filter((entry) => entry.id !== item.id));
    if (type === "goal") finance.setGoals((current) => current.filter((entry) => entry.id !== item.id));
  }

  return (
    <AppShell
      page={page}
      mobileMenuOpen={mobileMenuOpen}
      sidebarCollapsed={sidebarCollapsed}
      userEmail={userEmail}
      onNavigate={navigateToPage}
      onToggleSidebar={toggleSidebar}
      onMenuClose={() => setMobileMenuOpen(false)}
      onNotify={() => setError("Você está em dia! Nenhuma notificação nova.")}
      onSignOut={() => {
        void onSignOut().catch((reason: unknown) => {
          reportError(reason instanceof Error ? reason.message : "Não foi possível sair da conta.");
        });
      }}
    >
      <ErrorNotice message={error} onClose={() => setError("")} />
      {page === "Visão geral" ? (
        <DashboardPage
          transactions={finance.transactions} totals={totals} monthlyBudget={monthlyBudget} showValues={showValues}
          cards={finance.cards} customBanks={finance.customBanks} dashboardWidgets={finance.dashboardWidgets}
          mascotExpression={mascotExpression} mascotMessage={mascotMessage}
          onToggleValues={() => setShowValues((value) => !value)}
          onAdd={openTransactionForm} onSetBudget={() => setShowBudgetForm(true)} onNavigate={navigateToPage}
          onOpenMovements={openMonthlyMovements} onPayCard={setCardPaymentTarget} cloudAccount={Boolean(userId)}
        />
      ) : page === "Movimentações" ? (
        <MovementsPage
          transactions={finance.transactions} showValues={showValues} onAdd={openTransactionForm}
          initialMonth={movementFilter.month} initialType={movementFilter.type}
        />
      ) : page === "Configurações" ? (
        <SettingsPage
          email={userEmail} darkMode={finance.darkMode}
          onToggleDarkMode={() => finance.setDarkMode((value) => !value)}
          dashboardWidgets={finance.dashboardWidgets}
          onToggleDashboardWidget={(widget) => finance.setDashboardWidgets((current) =>
            current.includes(widget) ? current.filter((item) => item !== widget) : [...current, widget],
          )}
          onUpdatePassword={onUpdatePassword}
          onResetBalance={resetMonthlyBalance}
        />
      ) : (
        <SectionRouter
          page={page} transactions={finance.transactions} categories={finance.categories} accounts={finance.accounts}
          cards={finance.cards} customBanks={finance.customBanks} plans={finance.plans} goals={finance.goals}
          handlers={{
            addTransaction: openTransactionForm,
            addCategory: openCategoryForm,
            editCategory: (category) => { setCategoryToEdit(category); setCategoryFormType(category.type); setShowCategoryForm(true); },
            deleteCategory,
            addAccount: () => openFinanceEntry("account"),
            editAccount: (entry) => openFinanceEntry("account", entry),
            deleteAccount: (entry) => removeEntry("account", entry),
            addCard: () => openFinanceEntry("card"),
            editCard: (entry) => openFinanceEntry("card", entry),
            deleteCard: (entry) => removeEntry("card", entry),
            payCard: setCardPaymentTarget,
            addPlan: () => openFinanceEntry("plan"),
            editPlan: (entry) => openFinanceEntry("plan", entry),
            deletePlan: (entry) => removeEntry("plan", entry),
            addGoal: () => openFinanceEntry("goal"),
            editGoal: (entry) => openFinanceEntry("goal", entry),
            deleteGoal: (entry) => removeEntry("goal", entry),
          }}
        />
      )}
      {showTransactionForm && (
        <TransactionModal
          categories={finance.categories} cards={finance.cards} transactions={finance.transactions}
          selectedCardId={selectedCreditCardId} type={transactionType} categoryId={selectedCategoryId}
          onTypeChange={(type) => {
            setTransactionType(type);
            setSelectedCategoryId(finance.categories.find((category) => category.type === type)?.id ?? "");
          }}
          onCategoryChange={setSelectedCategoryId}
          onCardChange={setSelectedCreditCardId}
          onClose={() => setShowTransactionForm(false)}
          onSubmit={createTransaction}
          onManageCategories={() => { setShowTransactionForm(false); navigateToPage("Categorias"); }}
          onBalanceAction={openBalanceForm}
        />
      )}
      {cardPaymentTarget && (
        <CardPaymentModal
          card={cardPaymentTarget}
          used={getCardUsage(cardPaymentTarget, finance.transactions).used}
          customBanks={finance.customBanks}
          onClose={() => setCardPaymentTarget(null)}
          onSubmit={recordCardPayment}
        />
      )}
      {balanceMode && (
        <BalanceModal
          mode={balanceMode}
          currentBalance={totals.balance}
          onClose={() => setBalanceMode(null)}
          onSubmit={(amount) => saveBalance(amount, balanceMode)}
        />
      )}
      {showBudgetForm && (
        <BudgetModal
          budget={monthlyBudget}
          onClose={() => setShowBudgetForm(false)}
          onRemove={() => { finance.setMonthlyBudget(null); setShowBudgetForm(false); }}
          onSubmit={saveMonthlyBudget}
        />
      )}
      {showCategoryForm && (
        <CategoryModal
          category={categoryToEdit} initialType={categoryFormType}
          onClose={() => { setShowCategoryForm(false); setCategoryToEdit(null); }}
          onSubmit={saveCategory}
        />
      )}
      {entryType && (
        <FinanceEntryModal
          type={entryType} entry={entryToEdit} categories={finance.categories}
          customBanks={finance.customBanks} onCreateCustomBank={(bank) => finance.setCustomBanks((current) => [...current, bank])}
          onClose={closeFinanceEntry} onSubmit={saveFinanceEntry}
        />
      )}
    </AppShell>
  );
}

// Reaproveita a operação de inclusão/edição para cada lista persistida.
function upsert<T extends { id: string }>(items: T[], next: T) {
  return items.some((item) => item.id === next.id)
    ? items.map((item) => item.id === next.id ? next : item)
    : [next, ...items];
}

function splitAmount(amount: number, parts: number): number[] {
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / parts);
  const extraCents = totalCents - baseCents * parts;
  return Array.from({ length: parts }, (_, index) => (baseCents + (index < extraCents ? 1 : 0)) / 100);
}

function addMonthsToDate(dateValue: string, monthOffset: number): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const targetMonth = new Date(year, month - 1 + monthOffset, 1);
  const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(day, lastDay));
  return localDateString(targetMonth);
}

export default App;
