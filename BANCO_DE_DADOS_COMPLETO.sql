-- 1. Perfis e preferências criados para contas do Supabase Auth.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  monthly_budget numeric(14, 2) null check (monthly_budget is null or monthly_budget > 0),
  dark_mode boolean not null default false,
  dashboard_widgets jsonb not null default '["cards", "goals"]'::jsonb
    check (
      jsonb_typeof(dashboard_widgets) = 'array'
      and dashboard_widgets <@ '["cards", "goals"]'::jsonb
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Cadastros financeiros usados pelas telas atuais.
create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  emoji text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, type, name)
);

create table if not exists public.accounts (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  institution text not null,
  bank_id text not null default '',
  balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.credit_cards (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  issuer text not null,
  bank_id text not null default '',
  last_four text not null default '',
  credit_limit numeric(14, 2) not null check (credit_limit > 0),
  closing_day integer not null default 10 check (closing_day between 1 and 31),
  due_day integer not null default 17 check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.custom_banks (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, name)
);

create table if not exists public.budgets (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  category_id text null,
  monthly_limit numeric(14, 2) not null check (monthly_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, category),
  constraint budgets_category_user_fkey
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on delete set null (category_id)
);

create table if not exists public.financial_goals (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target numeric(14, 2) not null check (target > 0),
  saved numeric(14, 2) not null default 0 check (saved >= 0),
  deadline date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.cash_boxes (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.cash_box_deposits (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  cash_box_id text not null,
  account_id text not null,
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint cash_box_deposits_box_user_fkey
    foreign key (user_id, cash_box_id)
    references public.cash_boxes (user_id, id)
    on delete restrict,
  constraint cash_box_deposits_account_user_fkey
    foreign key (user_id, account_id)
    references public.accounts (user_id, id)
    on delete restrict
);
create index if not exists cash_box_deposits_user_box_idx on public.cash_box_deposits (user_id, cash_box_id);
create index if not exists cash_box_deposits_user_account_idx on public.cash_box_deposits (user_id, account_id);

-- 3. Movimentações comuns, compras no crédito, pagamentos e parcelamentos.
create table if not exists public.transactions (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  category text not null,
  category_id text null,
  transaction_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  is_settled boolean not null default true,
  account_id text null,
  credit_card_id text null,
  credit_card_kind text null check (credit_card_kind is null or credit_card_kind in ('purchase', 'payment')),
  cash_box_id text null,
  cash_box_kind text null,
  installment_group_id text null,
  installment_number smallint null,
  installment_count smallint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint transactions_installment_position_check check (
    (installment_number is null and installment_count is null)
    or (
      installment_number between 1 and 24
      and installment_count between 1 and 24
      and installment_number <= installment_count
    )
  ),
  constraint transactions_card_metadata_check check (
    (credit_card_id is null and credit_card_kind is null)
    or (credit_card_id is not null and credit_card_kind is not null)
  ),
  constraint transactions_account_credit_purchase_check check (
    credit_card_kind is distinct from 'purchase' or account_id is null
  ),
  constraint transactions_cash_box_metadata_check check (
    (cash_box_id is null and cash_box_kind is null)
    or (
      cash_box_id is not null
      and cash_box_kind is not null
      and cash_box_kind in ('deposit', 'withdrawal')
      and account_id is not null
      and credit_card_id is null
      and credit_card_kind is null
      and (
        (cash_box_kind = 'deposit' and type = 'expense')
        or (cash_box_kind = 'withdrawal' and type = 'income')
      )
    )
  ),
  constraint transactions_account_user_fkey
    foreign key (user_id, account_id)
    references public.accounts (user_id, id)
    on delete restrict,
  constraint transactions_cash_box_user_fkey
    foreign key (user_id, cash_box_id)
    references public.cash_boxes (user_id, id)
    on delete restrict,
  constraint transactions_credit_card_user_fkey
    foreign key (user_id, credit_card_id)
    references public.credit_cards (user_id, id)
    on delete restrict,
  constraint transactions_category_user_fkey
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on delete set null (category_id)
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'is_settled'
  ) then
    execute 'alter table public.transactions add column is_settled boolean not null default true';
    execute 'update public.transactions set is_settled = false where transaction_date > current_date';
  end if;
end;
$$;

-- 4. Índices para consultas mensais, cartões, parcelas e planejamentos.
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc);
create index if not exists transactions_user_pending_date_idx
  on public.transactions (user_id, transaction_date)
  where is_settled = false;
create index if not exists transactions_user_credit_card_idx
  on public.transactions (user_id, credit_card_id, transaction_date desc)
  where credit_card_id is not null;
create index if not exists transactions_user_account_idx
  on public.transactions (user_id, account_id, transaction_date desc)
  where account_id is not null;
create index if not exists transactions_user_cash_box_idx
  on public.transactions (user_id, cash_box_id, transaction_date desc)
  where cash_box_id is not null;
create index if not exists transactions_installment_group_idx
  on public.transactions (user_id, installment_group_id)
  where installment_group_id is not null;
create index if not exists categories_user_type_idx
  on public.categories (user_id, type);
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id)
  where category_id is not null;
create index if not exists budgets_user_category_id_idx
  on public.budgets (user_id, category_id)
  where category_id is not null;
create index if not exists budgets_user_category_idx
  on public.budgets (user_id, category);

-- 4. Conversas e limites de uso do assistente financeiro.
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 6000),
  created_at timestamptz not null default now(),
  constraint ai_messages_conversation_owner_fkey
    foreign key (conversation_id, user_id)
    references public.ai_conversations (id, user_id)
    on delete cascade
);

create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_messages_user_conversation_created_idx
  on public.ai_messages (user_id, conversation_id, created_at);

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);
create index if not exists ai_usage_events_created_idx
  on public.ai_usage_events (created_at);

-- 5. Funções e triggers para timestamps e criação automática do perfil.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 6. RLS, permissões e políticas por proprietário.

create or replace function public.create_fluxary_user_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
  set email = excluded.email, display_name = excluded.display_name;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_created_fluxary_records on auth.users;
create trigger auth_user_created_fluxary_records
  after insert on auth.users
  for each row execute function public.create_fluxary_user_records();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_settings', 'transactions', 'categories', 'accounts',
    'credit_cards', 'custom_banks', 'budgets', 'financial_goals', 'cash_boxes', 'cash_box_deposits'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_events enable row level security;

revoke all on public.profiles, public.user_settings, public.transactions, public.categories,
  public.accounts, public.credit_cards, public.custom_banks, public.budgets,
  public.financial_goals, public.cash_boxes, public.cash_box_deposits,
  public.ai_conversations, public.ai_messages, public.ai_usage_events from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.user_settings, public.transactions,
  public.categories, public.accounts, public.credit_cards, public.custom_banks, public.budgets,
  public.financial_goals, public.cash_boxes, public.cash_box_deposits,
  public.ai_conversations, public.ai_messages to authenticated;
revoke all on function public.create_fluxary_user_records() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.consume_fluxary_ai_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_time timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);
  delete from public.ai_usage_events
    where created_at < request_time - interval '1 day';

  if (
    select count(*) from public.ai_usage_events
    where user_id = current_user_id and created_at > request_time - interval '1 minute'
  ) >= 5 or (
    select count(*) from public.ai_usage_events
    where user_id = current_user_id and created_at > request_time - interval '1 day'
  ) >= 20 then
    return false;
  end if;

  insert into public.ai_usage_events (user_id) values (current_user_id);
  return true;
end;
$$;
revoke all on function public.consume_fluxary_ai_request() from public, anon;
grant execute on function public.consume_fluxary_ai_request() to authenticated;

drop policy if exists "Users can manage their own profile" on public.profiles;
create policy "Users can manage their own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can manage their own settings" on public.user_settings;
create policy "Users can manage their own settings" on public.user_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'transactions', 'categories', 'accounts', 'credit_cards',
    'custom_banks', 'budgets', 'financial_goals', 'cash_boxes', 'cash_box_deposits'
  ] loop
    execute format('drop policy if exists "Users can manage their own rows" on public.%I', table_name);
    execute format(
      'create policy "Users can manage their own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "Users can manage their own AI conversations" on public.ai_conversations;
create policy "Users can manage their own AI conversations"
  on public.ai_conversations for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own AI messages" on public.ai_messages;
create policy "Users can manage their own AI messages"
  on public.ai_messages for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
