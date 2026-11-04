
-- Migração: criação de caixinhas e movimentações de poupança.
-- Seção: cadastros usados para separar valores em objetivos.
-- Tabela: Caixinhas financeiras do usuário (cash_boxes).
create table if not exists public.cash_boxes (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Tabela: Aportes e retiradas vinculados à caixinha e à conta (cash_box_deposits).
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

-- Seção: índices para localizar caixinhas e contas relacionadas.
create index if not exists cash_box_deposits_user_box_idx
  on public.cash_box_deposits (user_id, cash_box_id);

create index if not exists cash_box_deposits_user_account_idx
  on public.cash_box_deposits (user_id, account_id);

-- Seção: permissões de acesso para usuários autenticados.
revoke all on public.cash_boxes, public.cash_box_deposits
from public, anon;

grant select, insert, update, delete
on public.cash_boxes, public.cash_box_deposits
to authenticated;

-- Seção: gatilhos de data de alteração.
-- Requer que public.set_updated_at() já exista.

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_updated_at'
      and tgrelid = 'public.cash_boxes'::regclass
      and not tgisinternal
  ) then
    execute '
      create trigger set_updated_at
      before update on public.cash_boxes
      for each row
      execute function public.set_updated_at()
    ';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_updated_at'
      and tgrelid = 'public.cash_box_deposits'::regclass
      and not tgisinternal
  ) then
    execute '
      create trigger set_updated_at
      before update on public.cash_box_deposits
      for each row
      execute function public.set_updated_at()
    ';
  end if;
end;
$$;

-- Seção: habilita a segurança em nível de linha para as duas tabelas.
alter table public.cash_boxes enable row level security;
alter table public.cash_box_deposits enable row level security;

-- Seção: limita as operações às linhas pertencentes à conta autenticada.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cash_boxes'
      and policyname = 'Users can manage their own rows'
  ) then
    execute '
      create policy "Users can manage their own rows"
      on public.cash_boxes
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
    ';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'cash_box_deposits'
      and policyname = 'Users can manage their own rows'
  ) then
    execute '
      create policy "Users can manage their own rows"
      on public.cash_box_deposits
      for all
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
    ';
  end if;
end;
$$;
