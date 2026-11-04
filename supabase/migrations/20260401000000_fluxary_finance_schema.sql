BEGIN;

-- =====================================================
-- 1. PERFIS E CONFIGURAÇÕES
-- =====================================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_budget NUMERIC(14,2)
        CHECK (monthly_budget IS NULL OR monthly_budget > 0),
    dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
    dashboard_widgets JSONB NOT NULL DEFAULT '["cards", "goals"]'::jsonb
        CHECK (
            jsonb_typeof(dashboard_widgets) = 'array'
            AND dashboard_widgets <@ '["cards", "goals"]'::jsonb
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. CATEGORIAS
-- =====================================================

CREATE TABLE public.categories (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id),
    UNIQUE (user_id, type, name)
);

-- =====================================================
-- 3. CONTAS
-- =====================================================

CREATE TABLE public.accounts (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    institution TEXT NOT NULL DEFAULT '',
    bank_id TEXT NOT NULL DEFAULT '',
    balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- =====================================================
-- 4. CARTÕES DE CRÉDITO
-- =====================================================

CREATE TABLE public.credit_cards (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    issuer TEXT NOT NULL DEFAULT '',
    bank_id TEXT NOT NULL DEFAULT '',
    last_four TEXT NOT NULL DEFAULT ''
        CHECK (last_four = '' OR last_four ~ '^[0-9]{4}$'),
    credit_limit NUMERIC(14,2) NOT NULL CHECK (credit_limit > 0),
    closing_day INTEGER NOT NULL DEFAULT 10
        CHECK (closing_day BETWEEN 1 AND 31),
    due_day INTEGER NOT NULL DEFAULT 17
        CHECK (due_day BETWEEN 1 AND 31),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- =====================================================
-- 5. BANCOS PERSONALIZADOS
-- =====================================================

CREATE TABLE public.custom_banks (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    emoji TEXT NOT NULL,
    color TEXT NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id),
    UNIQUE (user_id, name)
);

-- =====================================================
-- 6. ORÇAMENTOS
-- =====================================================

CREATE TABLE public.budgets (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    category_id TEXT,
    monthly_limit NUMERIC(14,2) NOT NULL CHECK (monthly_limit > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id),
    UNIQUE (user_id, category),
    CONSTRAINT budgets_category_user_fkey
        FOREIGN KEY (user_id, category_id)
        REFERENCES public.categories(user_id, id)
        ON DELETE RESTRICT
);

-- =====================================================
-- 7. METAS FINANCEIRAS
-- =====================================================

CREATE TABLE public.financial_goals (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
    target NUMERIC(14,2) NOT NULL CHECK (target > 0),
    saved NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (saved >= 0),
    deadline DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- =====================================================
-- 8. MOVIMENTAÇÕES
-- =====================================================

CREATE TABLE public.transactions (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL CHECK (LENGTH(TRIM(description)) > 0),
    category TEXT NOT NULL,
    category_id TEXT,
    account_id TEXT,
    transaction_date DATE NOT NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    credit_card_id TEXT,
    credit_card_kind TEXT
        CHECK (
            credit_card_kind IS NULL
            OR credit_card_kind IN ('purchase', 'payment')
        ),
    installment_group_id TEXT,
    installment_number SMALLINT,
    installment_count SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, id),

    CONSTRAINT transactions_installment_position_check
        CHECK (
            (installment_number IS NULL AND installment_count IS NULL)
            OR (
                installment_number BETWEEN 1 AND 24
                AND installment_count BETWEEN 1 AND 24
                AND installment_number <= installment_count
            )
        ),

    CONSTRAINT transactions_card_metadata_check
        CHECK (
            (credit_card_id IS NULL AND credit_card_kind IS NULL)
            OR
            (credit_card_id IS NOT NULL AND credit_card_kind IS NOT NULL)
        ),

    CONSTRAINT transactions_credit_card_user_fkey
        FOREIGN KEY (user_id, credit_card_id)
        REFERENCES public.credit_cards(user_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT transactions_category_user_fkey
        FOREIGN KEY (user_id, category_id)
        REFERENCES public.categories(user_id, id)
        ON DELETE RESTRICT,

    CONSTRAINT transactions_account_user_fkey
        FOREIGN KEY (user_id, account_id)
        REFERENCES public.accounts(user_id, id)
        ON DELETE RESTRICT
);

-- =====================================================
-- 9. ÍNDICES
-- =====================================================

CREATE INDEX categories_user_type_idx
    ON public.categories(user_id, type);

CREATE INDEX transactions_user_date_idx
    ON public.transactions(user_id, transaction_date DESC);

CREATE INDEX transactions_user_card_idx
    ON public.transactions(user_id, credit_card_id)
    WHERE credit_card_id IS NOT NULL;

CREATE INDEX transactions_installment_group_idx
    ON public.transactions(user_id, installment_group_id)
    WHERE installment_group_id IS NOT NULL;

CREATE INDEX transactions_user_category_idx
    ON public.transactions(user_id, category_id)
    WHERE category_id IS NOT NULL;

CREATE INDEX transactions_user_account_idx
    ON public.transactions(user_id, account_id)
    WHERE account_id IS NOT NULL;

CREATE INDEX budgets_user_category_idx
    ON public.budgets(user_id, category_id)
    WHERE category_id IS NOT NULL;

-- =====================================================
-- 10. FUNÇÃO DE ATUALIZAÇÃO DE DATA
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- =====================================================
-- 11. CRIAÇÃO AUTOMÁTICA DE PERFIL E CONFIGURAÇÕES
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_fluxary_user_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_email TEXT;
    v_name TEXT;
BEGIN
    v_email := COALESCE(NEW.email, '');

    v_name := COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
        ''
    );

    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, v_email, v_name)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = CASE
            WHEN EXCLUDED.display_name <> ''
            THEN EXCLUDED.display_name
            ELSE public.profiles.display_name
        END;

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER auth_user_created_fluxary_records
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_fluxary_user_records();

CREATE TRIGGER auth_user_email_updated_fluxary
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_fluxary_user_records();

-- =====================================================
-- 12. TRIGGERS DE ATUALIZAÇÃO
-- =====================================================

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER credit_cards_updated_at
BEFORE UPDATE ON public.credit_cards
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER custom_banks_updated_at
BEFORE UPDATE ON public.custom_banks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER goals_updated_at
BEFORE UPDATE ON public.financial_goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 13. PERFIS DE USUÁRIOS JÁ EXISTENTES
-- =====================================================

INSERT INTO public.profiles (id, email, display_name)
SELECT
    id,
    COALESCE(email, ''),
    COALESCE(
        NULLIF(raw_user_meta_data ->> 'full_name', ''),
        NULLIF(raw_user_meta_data ->> 'name', ''),
        ''
    )
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

INSERT INTO public.user_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- 14. HABILITAÇÃO EXPLÍCITA DE RLS
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 15. PERMISSÕES
-- =====================================================

REVOKE ALL ON public.profiles, public.user_settings,
    public.categories, public.accounts, public.credit_cards,
    public.custom_banks, public.budgets, public.financial_goals,
    public.transactions
FROM PUBLIC, anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.user_settings, public.categories, public.accounts,
   public.credit_cards, public.custom_banks, public.budgets,
   public.financial_goals, public.transactions
TO authenticated;

REVOKE ALL ON FUNCTION public.sync_fluxary_user_records()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at()
FROM PUBLIC, anon, authenticated;

-- =====================================================
-- 16. POLÍTICAS DE SEGURANÇA
-- =====================================================

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = id);

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY settings_manage_own
ON public.user_settings
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY categories_manage_own
ON public.categories
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY accounts_manage_own
ON public.accounts
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY cards_manage_own
ON public.credit_cards
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY banks_manage_own
ON public.custom_banks
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY budgets_manage_own
ON public.budgets
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY goals_manage_own
ON public.financial_goals
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY transactions_manage_own
ON public.transactions
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;

-- =====================================================
-- 17. CONFERÊNCIA DA SEGURANÇA
-- =====================================================

SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'profiles',
    'user_settings',
    'categories',
    'accounts',
    'credit_cards',
    'custom_banks',
    'budgets',
    'financial_goals',
    'transactions'
)
ORDER BY tablename;