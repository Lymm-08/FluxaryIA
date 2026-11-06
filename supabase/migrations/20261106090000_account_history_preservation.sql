-- Preserve account identity on financial history after its account is deleted.
alter table public.transactions
  add column if not exists account_id_snapshot text null,
  add column if not exists account_name_snapshot text null;

alter table public.cash_box_deposits
  add column if not exists account_id_snapshot text null,
  add column if not exists account_name_snapshot text null,
  alter column account_id drop not null;

alter table public.transactions
  drop constraint if exists transactions_account_snapshot_check,
  drop constraint if exists transactions_cash_box_metadata_check,
  add constraint transactions_account_snapshot_check
    check (
      (account_id is not null and account_id_snapshot is null and account_name_snapshot is null)
      or (
        account_id is null
        and (
          (account_id_snapshot is null and account_name_snapshot is null)
          or (account_id_snapshot is not null and account_name_snapshot is not null)
        )
      )
    ),
  add constraint transactions_cash_box_metadata_check
    check (
      (
        cash_box_id is null
        and cash_box_kind is null
        and cash_box_id_snapshot is null
        and cash_box_name_snapshot is null
      )
      or (
        cash_box_kind in ('deposit', 'withdrawal')
        and (
          (account_id is not null and account_id_snapshot is null and account_name_snapshot is null)
          or (
            account_id is null
            and account_id_snapshot is not null
            and account_name_snapshot is not null
          )
        )
        and credit_card_id is null
        and credit_card_kind is null
        and (
          (cash_box_id is not null and cash_box_id_snapshot is null and cash_box_name_snapshot is null)
          or (
            cash_box_id is null
            and cash_box_id_snapshot is not null
            and cash_box_name_snapshot is not null
          )
        )
        and (
          (cash_box_kind = 'deposit' and type = 'expense')
          or (cash_box_kind = 'withdrawal' and type = 'income')
        )
      )
    );

create function public.delete_account_preserving_history(p_account_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  account_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select account.name
    into account_name
  from public.accounts as account
  where account.user_id = current_user_id
    and account.id = p_account_id
  for update;

  if not found then
    raise exception 'Account not found or not owned by the authenticated user'
      using errcode = 'P0002';
  end if;

  update public.transactions
  set account_id_snapshot = account_id,
      account_name_snapshot = account_name,
      account_id = null
  where user_id = current_user_id
    and account_id = p_account_id;

  update public.cash_box_deposits
  set account_id_snapshot = account_id,
      account_name_snapshot = account_name,
      account_id = null
  where user_id = current_user_id
    and account_id = p_account_id;

  delete from public.accounts
  where user_id = current_user_id
    and id = p_account_id;

  if not found then
    raise exception 'Account could not be deleted'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.delete_account_preserving_history(text) from public, anon;
grant execute on function public.delete_account_preserving_history(text) to authenticated;
