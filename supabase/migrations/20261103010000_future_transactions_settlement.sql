-- Migração: identificação de lançamentos planejados e realizados.
-- Seção: adiciona o estado de realização aos lançamentos (transactions).
alter table public.transactions
  add column if not exists is_settled boolean not null default true;

-- Atualiza lançamentos futuros existentes para o estado planejado.
update public.transactions
set is_settled = false
where transaction_date > current_date
  and is_settled = true;

-- Índice: acelera a consulta de lançamentos ainda não realizados.
create index if not exists transactions_user_pending_date_idx
  on public.transactions (user_id, transaction_date)
  where is_settled = false;
