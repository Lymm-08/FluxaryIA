-- Marca lançamentos com data futura já existentes como planejados, não realizados.
alter table public.transactions
  add column if not exists is_settled boolean not null default true;

update public.transactions
set is_settled = false
where transaction_date > current_date
  and is_settled = true;

create index if not exists transactions_user_pending_date_idx
  on public.transactions (user_id, transaction_date)
  where is_settled = false;
