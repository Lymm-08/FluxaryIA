-- Perfil básico associado à conta Auth do Supabase.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preferências sincronizadas entre dispositivos.
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

-- IDs em texto preservam também as categorias iniciais já usadas pelo app.
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

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
  closing_day integer not null check (closing_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.transactions
  add column if not exists credit_card_id text null,
  add column if not exists credit_card_kind text null,
  add column if not exists installment_group_id text null,
  add column if not exists installment_number smallint null,
  add column if not exists installment_count smallint null;

alter table public.transactions
  drop constraint if exists transactions_credit_card_kind_check,
  add constraint transactions_credit_card_kind_check
    check (credit_card_kind is null or credit_card_kind in ('purchase', 'payment')),
  drop constraint if exists transactions_installment_position_check,
  add constraint transactions_installment_position_check
    check (
      (installment_number is null and installment_count is null)
      or (
        installment_number between 1 and 24
        and installment_count between 1 and 24
        and installment_number <= installment_count
      )
    ),
  drop constraint if exists transactions_card_metadata_check,
  add constraint transactions_card_metadata_check
    check (
      (credit_card_id is null and credit_card_kind is null)
      or (credit_card_id is not null and credit_card_kind is not null)
    ),
  drop constraint if exists transactions_credit_card_user_fkey,
  add constraint transactions_credit_card_user_fkey
    foreign key (user_id, credit_card_id)
    references public.credit_cards (user_id, id)
    on delete restrict,
  drop constraint if exists transactions_category_user_fkey,
  add constraint transactions_category_user_fkey
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on delete set null (category_id);

create index if not exists transactions_user_credit_card_idx
  on public.transactions (user_id, credit_card_id, transaction_date desc)
  where credit_card_id is not null;

create index if not exists transactions_installment_group_idx
  on public.transactions (user_id, installment_group_id)
  where installment_group_id is not null;

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

create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date desc);
create index if not exists categories_user_type_idx on public.categories (user_id, type);
create index if not exists budgets_user_category_idx on public.budgets (user_id, category);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category_id) where category_id is not null;
create index if not exists budgets_user_category_id_idx on public.budgets (user_id, category_id) where category_id is not null;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.user_settings, public.transactions,
  public.categories, public.accounts, public.credit_cards, public.custom_banks, public.budgets,
  public.financial_goals to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
    'credit_cards', 'custom_banks', 'budgets', 'financial_goals'
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
    'custom_banks', 'budgets', 'financial_goals'
  ] loop
    execute format('drop policy if exists "Users can manage their own rows" on public.%I', table_name);
    execute format(
      'create policy "Users can manage their own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name
    );
  end loop;
end;
$$;
