alter table public.cash_box_deposits
  add column if not exists direction text not null default 'deposit';

alter table public.cash_box_deposits
  drop constraint if exists cash_box_deposits_direction_check,
  add constraint cash_box_deposits_direction_check
    check (direction in ('deposit', 'withdrawal'));

-- Registra aportes e retiradas no ledger comum de movimentações.
alter table public.transactions
  add column if not exists cash_box_id text null,
  add column if not exists cash_box_kind text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_cash_box_metadata_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_cash_box_metadata_check
      check (
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
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_cash_box_user_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_cash_box_user_fkey
      foreign key (user_id, cash_box_id)
      references public.cash_boxes (user_id, id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists transactions_user_cash_box_idx
  on public.transactions (user_id, cash_box_id, transaction_date desc)
  where cash_box_id is not null;

-- Converte transferências existentes sem recriá-las se a migration for reaplicada.
insert into public.transactions (
  id,
  user_id,
  description,
  category,
  category_id,
  transaction_date,
  amount,
  type,
  is_settled,
  account_id,
  credit_card_id,
  credit_card_kind,
  cash_box_id,
  cash_box_kind,
  installment_group_id,
  installment_number,
  installment_count
)
select
  'cash-box-deposit:' || deposit.id,
  deposit.user_id,
  case
    when deposit.direction = 'withdrawal' then 'Retirada: ' || cash_box.name
    else 'Aporte: ' || cash_box.name
  end,
  'Caixinha',
  null,
  deposit.created_at::date,
  deposit.amount,
  case when deposit.direction = 'withdrawal' then 'income' else 'expense' end,
  true,
  deposit.account_id,
  null,
  null,
  deposit.cash_box_id,
  case when deposit.direction = 'withdrawal' then 'withdrawal' else 'deposit' end,
  null,
  null,
  null
from public.cash_box_deposits as deposit
join public.cash_boxes as cash_box
  on cash_box.user_id = deposit.user_id
  and cash_box.id = deposit.cash_box_id
on conflict (user_id, id) do nothing;

delete from public.cash_box_deposits as deposit
where exists (
  select 1
  from public.transactions as transaction
  where transaction.user_id = deposit.user_id
    and transaction.id = 'cash-box-deposit:' || deposit.id
    and transaction.cash_box_id = deposit.cash_box_id
    and transaction.cash_box_kind = deposit.direction
);
