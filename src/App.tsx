import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  Account, BudgetPlan, CashBox, CashBoxDeposit, Category, CreditCardItem, FinanceNotification, FinancialGoal, Transaction, TransactionType,
} from "./types/finance";
import { calculateProjectedBalance, calculateTotals, getAccountBalance, getCardBillingNotice, getCardUsage } from "./utils/finance";
import { localDateString, parseAmount } from "./utils/format";
import { money } from "./utils/format";
import type { MascotExpression } from "./components/MascotCompanion";
import { MovementsPage } from "./pages/MovementsPage";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { TransactionDetailsModal } from "./components/TransactionDetailsModal";

type ConfirmationRequest = { title: string; message: string; confirmLabel: string; danger: boolean };
// Decide entre conta autenticada, recuperação de senha e modo local.
function App() {
  const auth = useAuth();

  if (auth.loading) return <div className="screen-state">Carregando sua conta...</div>;
  if (auth.passwordRecovery) {
    return <AuthPage
      key="password-recovery"
      configured={auth.configured} recovery recoveryEmail={auth.recoveryEmail} recoveryStep={auth.recoveryStep}
      onSignIn={auth.signIn} onSignUp={auth.signUp}
      onGoogleSignIn={auth.signInWithGoogle} onSendPasswordReset={auth.sendPasswordReset}
      onVerifyEmailCode={auth.verifyEmailCode} onResendEmailCode={auth.resendEmailCode}
      onUpdatePassword={auth.updatePassword} onRecoveryComplete={auth.finishPasswordRecovery}
    />;
  }

  if (!auth.user) {
    return <AuthPage
      key="sign-in"
      configured={auth.configured} recovery={false} recoveryEmail="" recoveryStep="code"
      onSignIn={auth.signIn} onSignUp={auth.signUp}
      onGoogleSignIn={auth.signInWithGoogle} onSendPasswordReset={auth.sendPasswordReset}
      onVerifyEmailCode={auth.verifyEmailCode} onResendEmailCode={auth.resendEmailCode}
      onUpdatePassword={auth.updatePassword} onRecoveryComplete={auth.finishPasswordRecovery}
    />;
  }
  return <FinanceWorkspace
    userId={auth.user?.id ?? null} userEmail={auth.user?.email ?? null}
    onSendPasswordReset={auth.sendPasswordReset}
    onSignOut={async () => {
      await auth.signOut();
    }}
  />;
}

// Estado financeiro isolado da tela de autenticação para não misturar dados entre contas.
function FinanceWorkspace({ userId, userEmail, onSendPasswordReset, onSignOut }: {
  userId: string | null;
  userEmail: string | null;
  onSendPasswordReset: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(null);
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
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [incomeCelebration, setIncomeCelebration] = useState(false);
  const incomeCelebrationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [balanceMode, setBalanceMode] = useState<BalanceMode | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | null>(null);
  const [categoryFormType, setCategoryFormType] = useState<TransactionType>("expense");
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCreditCardId, setSelectedCreditCardId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [cardPaymentTarget, setCardPaymentTarget] = useState<CreditCardItem | null>(null);
  const [entryType, setEntryType] = useState<FinanceEntryType | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<FinanceEntry>(null);

  function askConfirmation(request: ConfirmationRequest): Promise<boolean> {
    return new Promise((resolve) => {
      confirmationResolver.current?.(false);
      confirmationResolver.current = resolve;
      setConfirmation(request);
    });
  }

  function settleConfirmation(confirmed: boolean) {
    const resolve = confirmationResolver.current;
    confirmationResolver.current = null;
    setConfirmation(null);
    resolve?.(confirmed);
  }

  useEffect(() => {
    const currentState = window.history.state;
    if (!currentState?.fluxaryApp) {
      window.history.replaceState({ ...currentState, fluxaryApp: true, page }, "", window.location.href);
    }

    function restorePage(event: PopStateEvent) {
      const state = event.state as { fluxaryApp?: boolean; page?: string; movementFilter?: typeof movementFilter } | null;
      if (!state?.fluxaryApp || !state.page) return;
      setPage(state.page);
      if (state.movementFilter) setMovementFilter(state.movementFilter);
      setMobileMenuOpen(false);
    }

    window.addEventListener("popstate", restorePage);
    return () => window.removeEventListener("popstate", restorePage);
  }, []);

  const totals = useMemo(
    () => calculateTotals(finance.transactions, finance.accounts, finance.cashBoxDeposits),
    [finance.accounts, finance.cashBoxDeposits, finance.transactions],
  );
  const projectedBalance = useMemo(
    () => calculateProjectedBalance(finance.transactions, finance.accounts, finance.cards, finance.cashBoxDeposits),
    [finance.accounts, finance.cards, finance.cashBoxDeposits, finance.transactions],
  );
  const accountBalances = Object.fromEntries(finance.accounts.map((account) => [
    account.id,
    getAccountBalance(account, finance.transactions, finance.cashBoxDeposits),
  ]));
  const today = localDateString(new Date());
  const monthlyBudget = finance.monthlyBudget;
  const budgetExceeded = monthlyBudget !== null && totals.expenses > monthlyBudget;
  const creditUsage = finance.cards.reduce((total, card) => total + getCardUsage(card, finance.transactions).used, 0);
  const creditLimit = finance.cards.reduce((total, card) => total + card.creditLimit, 0);
  const creditUtilization = creditLimit > 0 ? creditUsage / creditLimit : 0;
  const dashboardTransactions = finance.transactions.filter((item) => item.transaction_date.startsWith(today.slice(0, 7)));
  const selectedTransaction = finance.transactions.find((item) => item.id === selectedTransactionId) ?? null;
  const notifications = useMemo((): FinanceNotification[] => {
    const plannedTransactions = finance.transactions
      .filter((transaction) => transaction.isSettled === false)
      .sort((left, right) => left.transaction_date.localeCompare(right.transaction_date))
      .map((transaction): FinanceNotification => ({
        id: `transaction-${transaction.id}`,
        title: `${transaction.transaction_date < today ? (transaction.type === "income" ? "Receita pendente" : "Despesa pendente") : transaction.type === "income" ? "Receita prevista" : "Despesa agendada"} · ${transaction.description}`,
        message: `${showValues ? money.format(transaction.amount) : "Valor oculto"} em ${formatNotificationDate(transaction.transaction_date)}`,
        tone: transaction.type === "income" ? "success" : "warning",
        transactionId: transaction.id,
        actionLabel: transaction.type === "income" ? "Marcar como recebida" : "Marcar como paga",
      }));
    const financeAlerts: FinanceNotification[] = [];
    if (totals.balance < 0) {
      financeAlerts.push({ id: "balance-negative", title: "Saldo atual negativo", message: "Revise suas contas e movimentações pendentes.", tone: "danger" });
    }
    if (budgetExceeded) {
      financeAlerts.push({ id: "budget-exceeded", title: "Limite mensal ultrapassado", message: "As despesas realizadas passaram do planejamento mensal.", tone: "warning" });
    }
    if (creditUtilization >= 0.85) {
      financeAlerts.push({ id: "credit-near-limit", title: "Limite de crédito quase esgotado", message: "O uso dos cartões está acima de 85% do limite disponível.", tone: "warning" });
    }
    const cardNotices = finance.cards.flatMap((card): FinanceNotification[] => {
      const notice = getCardBillingNotice(card, finance.transactions, new Date(), showValues);
      if (notice.title.startsWith("Fechamento em")) return [];
      return [{
        id: `card-${card.id}`,
        title: `${card.issuer} · ${notice.title}`,
        message: notice.message,
        tone: notice.tone,
      }];
    });
    return [...financeAlerts, ...cardNotices, ...plannedTransactions];
  }, [budgetExceeded, creditUtilization, finance.cards, finance.transactions, showValues, today, totals.balance]);
  const financialAlert = totals.balance < 0
    || budgetExceeded
    || (totals.income > 0 && totals.expenses > totals.income && totals.balance <= totals.income * 0.15)
    || creditUtilization >= 0.85;
  const financialHealthGood = totals.balance >= Math.max(1000, totals.expenses * 2)
    || (totals.balance > 0
    && (totals.income === 0 ? totals.expenses === 0 : totals.expenses <= totals.income * 0.7)
    && !budgetExceeded
    && creditUtilization < 0.65);
  const mascotExpression: MascotExpression = incomeCelebration
    ? "celebration"
    : financialAlert ? "alert" : financialHealthGood ? "approval" : "encouragement";
  const mascotMessage = incomeCelebration
    ? "Receita recebida! Cada conquista merece ser comemorada."
    : budgetExceeded
    ? `As despesas do mês passaram do limite de ${money.format(monthlyBudget)}.`
    : totals.balance < 0
      ? "Seu saldo está negativo. Vamos rever as despesas e recuperar o equilíbrio."
      : creditUtilization >= 0.85
        ? "O limite dos cartões está quase todo usado. Acompanhe as próximas faturas."
        : financialHealthGood
          ? "Suas contas estão equilibradas. Continue nesse ritmo!"
          : "Vamos acompanhar receitas, despesas e saldo para manter tudo em equilíbrio.";

  useEffect(() => {
    document.documentElement.dataset.theme = finance.darkMode ? "dark" : "light";
  }, [finance.darkMode]);

  useEffect(() => () => {
    if (incomeCelebrationTimeout.current !== null) clearTimeout(incomeCelebrationTimeout.current);
  }, []);

  if (finance.loading) return <div className="screen-state">Carregando seus dados financeiros...</div>;
  if (finance.loadError) return (
    <div className="screen-state cloud-error-state">
      <strong>Não foi possível carregar sua conta.</strong>
      <span>{finance.loadError}</span>
      <button className="button-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
    </div>
  );

  // Navegação e inicialização de formulários.
  function navigateToPage(nextPage: string, nextMovementFilter = movementFilter) {
    if (nextPage !== page) {
      window.history.pushState(
        { fluxaryApp: true, page: nextPage, movementFilter: nextMovementFilter },
        "",
        window.location.href,
      );
    } else {
      window.history.replaceState(
        { fluxaryApp: true, page: nextPage, movementFilter: nextMovementFilter },
        "",
        window.location.href,
      );
    }
    setPage(nextPage);
    setMobileMenuOpen(false);
  }

  function openTransactionForm(transaction: Transaction | null = null) {
    setTransactionToEdit(transaction);
    setTransactionType(transaction?.type ?? "expense");
    setSelectedCategoryId(transaction?.categoryId
      ?? finance.categories.find((category) => category.type === (transaction?.type ?? "expense") && category.name === transaction?.category)?.id
      ?? finance.categories.find((category) => category.type === (transaction?.type ?? "expense"))?.id
      ?? "");
    setSelectedCreditCardId(transaction?.creditCardId ?? finance.cards[0]?.id ?? "");
    setSelectedAccountId(transaction?.accountId ?? finance.accounts[0]?.id ?? "");
    setBalanceMode(null);
    setShowTransactionForm(true);
  }

  function celebrateIncome() {
    setIncomeCelebration(true);
    if (incomeCelebrationTimeout.current !== null) clearTimeout(incomeCelebrationTimeout.current);
    incomeCelebrationTimeout.current = setTimeout(() => {
      setIncomeCelebration(false);
      incomeCelebrationTimeout.current = null;
    }, 5000);
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
  }

  async function resetMonthlyBalance() {
    const confirmed = await askConfirmation({
      title: "Zerar o saldo atual?",
      message: "Seus lançamentos e o histórico serão preservados. Um ajuste será registrado para deixar o saldo em R$ 0,00.",
      confirmLabel: "Zerar saldo",
      danger: true,
    });
    if (!confirmed) return;
    saveBalance(0, "adjust", "reset");
  }

  function openMonthlyMovements(type: TransactionType) {
    const filter = { month: localDateString(new Date()).slice(0, 7), type };
    setMovementFilter(filter);
    navigateToPage("Movimentações", filter);
  }

  function openAllMonthlyMovements() {
    const filter = { month: today.slice(0, 7), type: "all" as const };
    setMovementFilter(filter);
    navigateToPage("Movimentações", filter);
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

  function openCardPayment(card: CreditCardItem) {
    setSelectedAccountId(finance.accounts[0]?.id ?? "");
    setCardPaymentTarget(card);
  }

  function closeFinanceEntry() {
    setEntryType(null);
    setEntryToEdit(null);
  }

  // Lançamentos, categorias e limites mensais.
  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const date = String(formData.get("transaction_date"));
    const isScheduled = date > localDateString(new Date()) || transactionToEdit?.isSettled === false;
    const category = finance.categories.find((item) => item.id === selectedCategoryId && item.type === transactionType);
    const amount = parseAmount(String(formData.get("amount") ?? ""));
    const paymentMethod = String(formData.get("payment-method") ?? "account");
    const usesCard = transactionType === "expense" && paymentMethod === "card";
    const isCardPayment = transactionType === "expense" && paymentMethod === "payment";
    const accountId = !usesCard
      ? String(formData.get("account-id") || selectedAccountId)
      : "";
    const account = accountId ? finance.accounts.find((item) => item.id === accountId) : undefined;
    const card = usesCard || isCardPayment ? finance.cards.find((item) => item.id === String(formData.get("credit-card-id"))) : undefined;
    const installmentCount = usesCard
      ? Number(formData.get("installment-count") ?? transactionToEdit?.installmentCount ?? 1)
      : 1;
    if (!category || !Number.isFinite(amount) || amount <= 0) {
      setError("Escolha uma categoria válida e informe um valor maior que zero.");
      return;
    }
    if ((usesCard || isCardPayment) && !card) {
      setError("Selecione um cartão cadastrado para este lançamento.");
      return;
    }
    if (!usesCard && !account) {
      setError(finance.accounts.length
        ? transactionType === "income"
          ? "Selecione a conta que receberá esta receita."
          : "Selecione a conta de onde sairá esta despesa."
        : "Cadastre uma conta na seção Contas antes de registrar uma receita ou despesa fora do cartão.");
      return;
    }
    if (transactionType === "expense" && !isScheduled && !usesCard && account) {
      const currentBalance = getAccountBalance(account, finance.transactions, finance.cashBoxDeposits);
      const previousAccountEffect = transactionToEdit?.accountId === account.id
        && transactionToEdit.creditCardKind !== "purchase"
        ? transactionToEdit.type === "income" ? -transactionToEdit.amount : transactionToEdit.amount
        : 0;
      const availableBeforeEntry = currentBalance + previousAccountEffect;
      if (amount > availableBeforeEntry && !await askConfirmation({
        title: "A conta ficará negativa",
        message: `O lançamento de ${money.format(amount)} é maior que o saldo atual da conta (${money.format(availableBeforeEntry)}). Se continuar, o saldo ficará negativo.`,
        confirmLabel: "Continuar mesmo assim",
        danger: true,
      })) return false;
    }
    if (usesCard && (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 24)) {
      setError("Informe entre 1 e 24 parcelas.");
      return;
    }
    const usage = card ? getCardUsage(card, finance.transactions) : null;
    const previousPurchase = transactionToEdit?.creditCardKind === "purchase"
      && transactionToEdit.creditCardId === card?.id
      ? transactionToEdit.amount
      : 0;
    const previousPayment = transactionToEdit?.creditCardKind === "payment"
      && transactionToEdit.creditCardId === card?.id
      ? transactionToEdit.amount
      : 0;
    if (usesCard && !isScheduled && usage && amount > usage.available + previousPurchase - previousPayment) {
      const availableBeforePurchase = usage.available + previousPurchase - previousPayment;
      if (!await askConfirmation({
        title: "Compra acima do limite",
        message: `Esta compra de ${money.format(amount)} ultrapassa o limite disponível do cartão (${money.format(availableBeforePurchase)}). Se continuar, o cartão ficará acima do limite.`,
        confirmLabel: "Continuar com a compra",
        danger: true,
      })) return false;
    }
    if (!isScheduled && isCardPayment && usage && amount > usage.used + previousPayment - previousPurchase) {
      setError("O pagamento não pode ser maior que o valor em aberto neste cartão.");
      return;
    }
    const description = String(formData.get("description")).trim();
    const installmentGroupId = usesCard && installmentCount > 1
      ? transactionToEdit?.installmentGroupId ?? crypto.randomUUID()
      : undefined;
    const installmentAmounts = transactionToEdit ? [amount] : splitAmount(amount, installmentCount);
    const newTransactions: Transaction[] = installmentAmounts.map((installmentAmount, index) => ({
      id: transactionToEdit?.id ?? crypto.randomUUID(),
      description,
      category: category.name,
      categoryId: category.id,
      transaction_date: transactionToEdit ? date : addMonthsToDate(date, index),
      amount: installmentAmount,
      type: transactionType,
      isSettled: transactionToEdit
        ? transactionToEdit.isSettled !== false
        : addMonthsToDate(date, index) <= localDateString(new Date()),
      ...(account ? { accountId: account.id } : {}),
      ...(card ? {
        creditCardId: card.id,
        creditCardKind: isCardPayment ? "payment" as const : "purchase" as const,
        ...(usesCard && transactionToEdit?.installmentGroupId ? {
          installmentGroupId: transactionToEdit.installmentGroupId,
          installmentNumber: transactionToEdit.installmentNumber,
          installmentCount: transactionToEdit.installmentCount,
        } : usesCard && installmentGroupId ? {
          installmentGroupId,
          installmentNumber: index + 1,
          installmentCount,
        } : {}),
      } : {}),
    }));
    const nextTransactions = transactionToEdit
      ? finance.transactions.map((item) => item.id === transactionToEdit.id ? newTransactions[0] : item)
      : [...newTransactions, ...finance.transactions];
    nextTransactions.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    finance.setTransactions(nextTransactions);
    setShowTransactionForm(false);
    setTransactionToEdit(null);
    setError("");
    if (transactionType === "income" && !isScheduled) celebrateIncome();
  }

  async function markTransactionSettled(transactionId: string): Promise<boolean> {
    const transaction = finance.transactions.find((item) => item.id === transactionId);
    if (!transaction || transaction.isSettled !== false) return false;
    if (transaction.creditCardKind === "payment") {
      const card = finance.cards.find((item) => item.id === transaction.creditCardId);
      if (card && transaction.amount > getCardUsage(card, finance.transactions).used) {
        setError("O pagamento agendado é maior que o valor em aberto neste cartão.");
        return false;
      }
    }
    const account = transaction.accountId
      ? finance.accounts.find((item) => item.id === transaction.accountId)
      : undefined;
    if (transaction.type === "expense" && account) {
      const accountBalance = getAccountBalance(account, finance.transactions, finance.cashBoxDeposits);
      if (transaction.amount > accountBalance && !await askConfirmation({
        title: "A conta ficará negativa",
        message: `O lançamento de ${money.format(transaction.amount)} é maior que o saldo atual da conta (${money.format(accountBalance)}). Se confirmar, o saldo ficará negativo.`,
        confirmLabel: "Confirmar pagamento",
        danger: true,
      })) return false;
    }
    finance.setTransactions((current) => current.map((item) =>
      item.id === transactionId ? { ...item, isSettled: true } : item,
    ));
    setError("");
    if (transaction.type === "income") celebrateIncome();
    return true;
  }

  async function deleteTransaction(transaction: Transaction) {
    if (!await askConfirmation({
      title: "Excluir movimentação?",
      message: `O lançamento “${transaction.description}” será removido. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir movimentação",
      danger: true,
    })) return;
    finance.setTransactions((current) => current.filter((item) => item.id !== transaction.id));
    setError("");
  }

  async function recordCardPayment(amount: number, accountId: string) {
    const card = cardPaymentTarget;
    const account = finance.accounts.find((item) => item.id === accountId);
    if (!card || !Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido para o pagamento.");
      return;
    }
    if (!account) {
      setError("Selecione a conta usada para pagar a fatura.");
      return;
    }
    const accountBalance = getAccountBalance(account, finance.transactions, finance.cashBoxDeposits);
    if (amount > accountBalance && !await askConfirmation({
      title: "A conta ficará negativa",
      message: `O pagamento de ${money.format(amount)} é maior que o saldo atual da conta (${money.format(accountBalance)}). Se continuar, o saldo ficará negativo.`,
      confirmLabel: "Pagar mesmo assim",
      danger: true,
    })) return;
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
      accountId: account.id,
      creditCardId: card.id,
      creditCardKind: "payment",
    };
    finance.setTransactions((current) => [payment, ...current].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)));
    setCardPaymentTarget(null);
    setError("");
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

  async function deleteCategory(category: Category) {
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
    if (!await askConfirmation({
      title: "Excluir categoria?",
      message: prompt,
      confirmLabel: "Excluir categoria",
      danger: true,
    })) return;
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
        const closingDay = Number(form.get("closingDay"));
        const dueDay = Number(form.get("dueDay"));
        const entry: CreditCardItem = {
          id, name: `Cartão ${issuer}`, issuer, bankId, lastFour: "",
          creditLimit: Number(form.get("creditLimit")), closingDay, dueDay,
        };
        if (!entry.issuer || !Number.isFinite(entry.creditLimit) || entry.creditLimit <= 0) return setError("Selecione o banco e informe um limite maior que zero.");
        if (![closingDay, dueDay].every((day) => Number.isInteger(day) && day >= 1 && day <= 31)) {
          return setError("Informe dias de fechamento e vencimento entre 1 e 31.");
        }
        finance.setCards((current) => upsert(current, entry));
        break;
      }
      case "plan": {
        const categoryIds = form.getAll("category-ids").map(String);
        if (categoryIds.length === 0) return setError("Selecione ao menos uma categoria para o planejamento mensal.");
        const entries: BudgetPlan[] = [];
        for (const [index, categoryId] of categoryIds.entries()) {
          const category = finance.categories.find((item) => item.type === "expense" && item.id === categoryId);
          const limit = Number(form.get(`limit-${categoryId}`));
          if (!category || !Number.isFinite(limit) || limit <= 0) {
            return setError("Escolha uma categoria e informe um limite mensal válido para cada uma.");
          }
          const existingPlan = finance.plans.find((plan) => plan.categoryId === category.id || plan.category === category.name);
          if (existingPlan && existingPlan.id !== entryToEdit?.id) {
            return setError(`Já existe um planejamento mensal para "${category.name}".`);
          }
          entries.push({
            id: entryToEdit && index === 0 ? entryToEdit.id : existingPlan?.id ?? crypto.randomUUID(),
            category: category.name,
            categoryId: category.id,
            limit,
          });
        }
        finance.setPlans((current) => entries.reduce((updated, entry) => upsert(updated, entry), current));
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

  function createCashBox(name: string) {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("Dê um nome para a caixinha.");
      return false;
    }
    if (finance.cashBoxes.some((cashBox) => cashBox.name.localeCompare(normalizedName, "pt-BR", { sensitivity: "base" }) === 0)) {
      setError("Já existe uma caixinha com esse nome.");
      return false;
    }
    finance.setCashBoxes((current) => [...current, { id: crypto.randomUUID(), name: normalizedName }]);
    setError("");
    return true;
  }

  function depositIntoCashBox(cashBox: CashBox, accountId: string, amount: number) {
    const account = finance.accounts.find((item) => item.id === accountId);
    if (!finance.cashBoxes.some((item) => item.id === cashBox.id) || !account) {
      setError("Selecione uma caixinha e uma conta válidas para o aporte.");
      return false;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido para guardar.");
      return false;
    }
    const availableBalance = getAccountBalance(account, finance.transactions, finance.cashBoxDeposits);
    if (amount > availableBalance) {
      setError(`O aporte não pode ser maior que o saldo disponível na conta (${money.format(availableBalance)}).`);
      return false;
    }
    const deposit: CashBoxDeposit = {
      id: crypto.randomUUID(),
      cashBoxId: cashBox.id,
      accountId: account.id,
      amount,
      createdAt: new Date().toISOString(),
    };
    finance.setCashBoxDeposits((current) => [...current, deposit]);
    setError("");
    return true;
  }

  async function removeEntry(type: FinanceEntryType, item: FinanceEntry) {
    if (!item) return;
    if (type === "account" && finance.transactions.some((transaction) => transaction.accountId === item.id)) {
      setError("Esta conta tem movimentações vinculadas. Mantenha-a para preservar o histórico financeiro.");
      return;
    }
    if (type === "account" && finance.cashBoxDeposits.some((deposit) => deposit.accountId === item.id)) {
      setError("Esta conta tem aportes vinculados a caixinhas. Mantenha-a para preservar o histórico.");
      return;
    }
    if (type === "card" && finance.transactions.some((transaction) => transaction.creditCardId === item.id)) {
      setError("Este cartão tem compras ou pagamentos no histórico. Remova os lançamentos vinculados antes de excluí-lo.");
      return;
    }
    if (!await askConfirmation({
      title: "Excluir item?",
      message: `Deseja excluir “${"name" in item ? item.name : "category" in item ? item.category : ""}”? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    })) return;
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
      notifications={notifications}
      onMarkSettled={(transactionId) => { void markTransactionSettled(transactionId); }}
      onSignOut={() => {
        void onSignOut().catch((reason: unknown) => {
          reportError(reason instanceof Error ? reason.message : "Não foi possível sair da conta.");
        });
      }}
    >
      <ErrorNotice message={error} onClose={() => setError("")} />
      {page === "Visão geral" ? (
        <DashboardPage
          transactions={dashboardTransactions} totals={totals} projectedBalance={projectedBalance} monthlyBudget={monthlyBudget} showValues={showValues}
          cards={finance.cards} customBanks={finance.customBanks} goals={finance.goals} dashboardWidgets={finance.dashboardWidgets}
          mascotExpression={mascotExpression} mascotMessage={mascotMessage}
          onToggleValues={() => setShowValues((value) => !value)}
          onAdd={() => openTransactionForm()} onAddGoal={() => openFinanceEntry("goal")}
          onSetBudget={() => setShowBudgetForm(true)} onNavigate={navigateToPage}
          onOpenMovements={openMonthlyMovements} onPayCard={openCardPayment} cloudAccount={Boolean(userId)}
          onOpenTransaction={(transaction) => setSelectedTransactionId(transaction.id)}
          onOpenTransactions={openAllMonthlyMovements}
        />
      ) : page === "Movimentações" ? (
        <MovementsPage
          transactions={finance.transactions} showValues={showValues} onAdd={() => openTransactionForm()}
          onEdit={openTransactionForm} onDelete={deleteTransaction}
          onOpenTransaction={(transaction) => setSelectedTransactionId(transaction.id)}
          onSettle={(transaction) => { void markTransactionSettled(transaction.id); }}
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
          onSendPasswordReset={onSendPasswordReset}
          onResetBalance={resetMonthlyBalance}
        />
      ) : (
        <SectionRouter
          page={page} transactions={finance.transactions} categories={finance.categories} accounts={finance.accounts}
          cards={finance.cards} customBanks={finance.customBanks} plans={finance.plans} goals={finance.goals}
          cashBoxes={finance.cashBoxes} cashBoxDeposits={finance.cashBoxDeposits} accountBalances={accountBalances}
          cashBoxSchemaReady={finance.cashBoxSchemaReady}
          handlers={{
            addTransaction: () => openTransactionForm(),
            addCategory: openCategoryForm,
            editCategory: (category) => { setCategoryToEdit(category); setCategoryFormType(category.type); setShowCategoryForm(true); },
            deleteCategory,
            addAccount: () => openFinanceEntry("account"),
            editAccount: (entry) => openFinanceEntry("account", entry),
            deleteAccount: (entry) => removeEntry("account", entry),
            addCard: () => openFinanceEntry("card"),
            editCard: (entry) => openFinanceEntry("card", entry),
            deleteCard: (entry) => removeEntry("card", entry),
            payCard: openCardPayment,
            addPlan: () => openFinanceEntry("plan"),
            editPlan: (entry) => openFinanceEntry("plan", entry),
            deletePlan: (entry) => removeEntry("plan", entry),
            addGoal: () => openFinanceEntry("goal"),
            editGoal: (entry) => openFinanceEntry("goal", entry),
            deleteGoal: (entry) => removeEntry("goal", entry),
            addCashBox: createCashBox,
            depositCashBox: depositIntoCashBox,
          }}
        />
      )}
      {showTransactionForm && (
        <TransactionModal
          categories={finance.categories} accounts={finance.accounts} cards={finance.cards} transactions={finance.transactions}
          cashBoxDeposits={finance.cashBoxDeposits}
          transaction={transactionToEdit}
          selectedAccountId={selectedAccountId} selectedCardId={selectedCreditCardId} type={transactionType} categoryId={selectedCategoryId}
          onTypeChange={(type) => {
            setTransactionType(type);
            setSelectedCategoryId(finance.categories.find((category) => category.type === type)?.id ?? "");
          }}
          onCategoryChange={setSelectedCategoryId}
          onAccountChange={setSelectedAccountId}
          onCardChange={setSelectedCreditCardId}
          onClose={() => { setShowTransactionForm(false); setTransactionToEdit(null); }}
          onSubmit={createTransaction}
          onManageCategories={() => { setShowTransactionForm(false); navigateToPage("Categorias"); }}
          onManageAccounts={() => { setShowTransactionForm(false); navigateToPage("Contas"); }}
          onBalanceAction={openBalanceForm}
        />
      )}
      {selectedTransaction && (
        <TransactionDetailsModal
          transaction={selectedTransaction}
          account={finance.accounts.find((item) => item.id === selectedTransaction.accountId)}
          card={finance.cards.find((item) => item.id === selectedTransaction.creditCardId)}
          showValues={showValues}
          onClose={() => setSelectedTransactionId(null)}
          onEdit={() => {
            setSelectedTransactionId(null);
            openTransactionForm(selectedTransaction);
          }}
          onDelete={() => {
            setSelectedTransactionId(null);
            void deleteTransaction(selectedTransaction);
          }}
          onSettle={() => {
            void markTransactionSettled(selectedTransaction.id).then((settled) => {
              if (settled) setSelectedTransactionId(null);
            });
          }}
        />
      )}
      {cardPaymentTarget && (
        <CardPaymentModal
          card={cardPaymentTarget}
          used={getCardUsage(cardPaymentTarget, finance.transactions).used}
          accounts={finance.accounts}
          selectedAccountId={selectedAccountId}
          transactions={finance.transactions}
          cashBoxDeposits={finance.cashBoxDeposits}
          customBanks={finance.customBanks}
          onAccountChange={setSelectedAccountId}
          onClose={() => setCardPaymentTarget(null)}
          onSubmit={(amount, accountId) => recordCardPayment(amount, accountId)}
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
      {confirmation && (
        <ConfirmDialog
          {...confirmation}
          onConfirm={() => settleConfirmation(true)}
          onCancel={() => settleConfirmation(false)}
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

function formatNotificationDate(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default App;
