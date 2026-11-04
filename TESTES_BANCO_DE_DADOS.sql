-- Roteiro de testes: validação do banco de dados do Fluxary.
-- Seção: verifica as tabelas financeiras, as permissões e o isolamento RLS.
-- Execute como postgres no Supabase SQL Editor depois de criar duas contas Auth.
-- Todo dado de teste fica dentro da transação e é desfeito no ROLLBACK final.

begin;

-- Confirma que as tabelas esperadas existem e têm RLS habilitada.
do $$
declare
  -- Nomes em português: perfis, preferências, lançamentos, categorias, contas,
  -- cartões, bancos personalizados, orçamentos e metas financeiras.
  expected_tables text[] := array[
    'profiles', 'user_settings', 'transactions', 'categories', 'accounts',
    'credit_cards', 'custom_banks', 'budgets', 'financial_goals'
  ];
  table_name text;
begin
  foreach table_name in array expected_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Tabela ausente: public.%', table_name;
    end if;
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS não está habilitada em public.%', table_name;
    end if;
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and cmd = 'ALL'
        and coalesce(qual, '') ilike '%auth.uid()%'
        and coalesce(with_check, '') ilike '%auth.uid()%'
    ) then
      raise exception 'Política RLS de proprietário ausente ou incompleta em public.%', table_name;
    end if;
    if not exists (
      select 1
      from pg_constraint
      where conrelid = format('public.%I', table_name)::regclass
        and confrelid = 'auth.users'::regclass
        and contype = 'f'
    ) then
      raise exception 'Chave estrangeira para auth.users ausente em public.%', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'select')
      or has_table_privilege('anon', format('public.%I', table_name), 'insert')
      or has_table_privilege('anon', format('public.%I', table_name), 'update')
      or has_table_privilege('anon', format('public.%I', table_name), 'delete') then
      raise exception 'A role anon tem permissões diretas em public.%', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_credit_card_user_fkey'
      and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_account_user_fkey'
      and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_category_user_fkey'
      and contype = 'f'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'public.budgets'::regclass
      and conname = 'budgets_category_user_fkey'
      and contype = 'f'
  ) then
    raise exception 'Relação entre compras, contas, planejamentos, cartões e categorias está ausente.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'auth_user_created_fluxary_records'
      and not tgisinternal
  ) then
    raise exception 'Trigger de criação do perfil após cadastro está ausente.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'is_settled'
      and is_nullable = 'NO'
      and column_default like '%true%'
  ) then
    raise exception 'Coluna transactions.is_settled ausente ou sem padrão seguro.';
  end if;
end;
$$;

-- Seção: seleciona duas contas de teste sem exibir seus dados pessoais.
do $$
declare
  test_users uuid[];
begin
  select array_agg(id order by created_at)
    into test_users
    from (
      select id, created_at
      from auth.users
      order by created_at
      limit 2
    ) users;

  if coalesce(array_length(test_users, 1), 0) < 2 then
    raise exception 'Crie e confirme duas contas de teste em Authentication → Users antes de executar o teste RLS.';
  end if;

  perform set_config('fluxary_test.user_a', test_users[1]::text, true);
  perform set_config('fluxary_test.user_b', test_users[2]::text, true);
end;
$$;

-- Seção: prepara contas de teste para validar o isolamento das chaves estrangeiras.
reset role;
insert into public.accounts (id, user_id, name, institution, bank_id, balance)
values (
  '__fluxary_account_b_probe__',
  current_setting('fluxary_test.user_b')::uuid,
  'Conta de teste B',
  'Teste',
  'test',
  100.00
);
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('fluxary_test.user_a'), true);

insert into public.accounts (id, user_id, name, institution, bank_id, balance)
values ('__fluxary_account_a_probe__', auth.uid(), 'Conta de teste A', 'Teste', 'test', 100.00);

-- Seção: simula operações financeiras autenticadas da conta A.
insert into public.transactions (
  id, user_id, description, category, category_id, transaction_date, amount, type, account_id
)
values (
  '__fluxary_rls_probe__', auth.uid(), 'Teste RLS temporário',
  'Teste', null, current_date, 1.00, 'expense', '__fluxary_account_a_probe__'
);

-- Verifica que uma movimentação não pode usar a conta financeira de outra pessoa.
do $$
begin
  begin
    insert into public.transactions (
      id, user_id, description, category, transaction_date, amount, type, account_id
    )
    values (
      '__fluxary_cross_account_probe__', auth.uid(), 'Teste de conta alheia',
      'Teste', current_date, 1.00, 'expense', '__fluxary_account_b_probe__'
    );
    raise exception 'Falha de isolamento: foi possível associar conta de outro usuário.';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

-- Verifica que a exclusão de categoria preserva o histórico de lançamentos e orçamentos.
insert into public.categories (id, user_id, name, type, color, emoji)
values ('__fluxary_category_probe__', auth.uid(), 'Categoria de teste', 'expense', '#123456', 'test');
insert into public.transactions (
  id, user_id, description, category, category_id, transaction_date, amount, type
)
values (
  '__fluxary_category_tx_probe__', auth.uid(), 'Histórico de teste',
  'Categoria de teste', '__fluxary_category_probe__', current_date, 1.00, 'expense'
);
insert into public.budgets (id, user_id, category, category_id, monthly_limit)
values (
  '__fluxary_category_budget_probe__', auth.uid(), 'Categoria de teste',
  '__fluxary_category_probe__', 100.00
);
delete from public.categories where id = '__fluxary_category_probe__';

do $$
declare
  visible_rows integer;
  preserved_rows integer;
begin
  select count(*) into visible_rows
  from public.transactions
  where id = '__fluxary_rls_probe__';
  if visible_rows <> 1 then
    raise exception 'A conta proprietária não consegue consultar a própria linha de teste.';
  end if;

  select count(*) into preserved_rows
  from public.transactions
  where id = '__fluxary_category_tx_probe__'
    and category_id is null
    and category = 'Categoria de teste';
  if preserved_rows <> 1 then
    raise exception 'Excluir uma categoria não preservou o nome histórico da movimentação.';
  end if;

  select count(*) into preserved_rows
  from public.budgets
  where id = '__fluxary_category_budget_probe__'
    and category_id is null
    and category = 'Categoria de teste';
  if preserved_rows <> 1 then
    raise exception 'Excluir uma categoria não preservou o nome histórico do orçamento.';
  end if;
end;
$$;

-- Seção: confirma que a conta B não pode consultar, alterar ou excluir dados da conta A.
select set_config('request.jwt.claim.sub', current_setting('fluxary_test.user_b'), true);

do $$
declare
  visible_rows integer;
  affected_rows integer;
begin
  select count(*) into visible_rows
  from public.transactions
  where id = '__fluxary_rls_probe__';
  if visible_rows <> 0 then
    raise exception 'Falha de isolamento: a conta B consegue consultar dados da conta A.';
  end if;

  update public.transactions
  set amount = 999.00
  where id = '__fluxary_rls_probe__';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Falha de isolamento: a conta B conseguiu alterar dados da conta A.';
  end if;

  delete from public.transactions where id = '__fluxary_rls_probe__';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Falha de isolamento: a conta B conseguiu excluir dados da conta A.';
  end if;
end;
$$;

-- Confirma que as tentativas da conta B não alteraram o lançamento da conta A.
select set_config('request.jwt.claim.sub', current_setting('fluxary_test.user_a'), true);
do $$
declare
  saved_amount numeric;
begin
  select amount into saved_amount
  from public.transactions
  where id = '__fluxary_rls_probe__';
  if saved_amount is distinct from 1.00 then
    raise exception 'O registro temporário foi alterado por outro usuário.';
  end if;
end;
$$;

reset role;
rollback;

-- Resultado: se chegou até aqui sem exceção, estrutura e isolamento básico passaram.
