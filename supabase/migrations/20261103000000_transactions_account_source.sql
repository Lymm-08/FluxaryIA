-- Migração: vínculo das movimentações com suas contas de origem.
-- Seção: adiciona e valida a relação de conta em lançamentos (transactions).
alter table public.transactions
  add column if not exists account_id text null;

alter table public.transactions
  drop constraint if exists transactions_account_credit_purchase_check,
  add constraint transactions_account_credit_purchase_check
    check (credit_card_kind is distinct from 'purchase' or account_id is null),
  drop constraint if exists transactions_account_user_fkey,
  add constraint transactions_account_user_fkey
    foreign key (user_id, account_id)
    references public.accounts (user_id, id)
    on delete restrict;

-- Índice: acelera a consulta de movimentações por conta do usuário.
create index if not exists transactions_user_account_idx
  on public.transactions (user_id, account_id, transaction_date desc)
  where account_id is not null;
