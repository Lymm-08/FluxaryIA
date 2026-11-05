-- Preserve cash box identity in financial history after its parent is deleted.
alter table public.transactions
  add column if not exists cash_box_id_snapshot text null,
  add column if not exists cash_box_name_snapshot text null;

alter table public.cash_box_deposits
  add column if not exists cash_box_id_snapshot text null,
  add column if not exists cash_box_name_snapshot text null,
  alter column cash_box_id drop not null;

alter table public.transactions
  drop constraint if exists transactions_cash_box_metadata_check,
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
        and account_id is not null
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

create or replace function public.delete_cash_box_preserving_history(p_cash_box_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  cash_box_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select cash_box.name
    into cash_box_name
  from public.cash_boxes as cash_box
  where cash_box.user_id = current_user_id
    and cash_box.id = p_cash_box_id
  for update;

  if not found then
    raise exception 'Cash box not found or not owned by the authenticated user'
      using errcode = 'P0002';
  end if;

  update public.transactions
  set cash_box_id_snapshot = cash_box_id,
      cash_box_name_snapshot = cash_box_name,
      cash_box_id = null
  where user_id = current_user_id
    and cash_box_id = p_cash_box_id;

  update public.cash_box_deposits
  set cash_box_id_snapshot = cash_box_id,
      cash_box_name_snapshot = cash_box_name,
      cash_box_id = null
  where user_id = current_user_id
    and cash_box_id = p_cash_box_id;

  delete from public.cash_boxes
  where user_id = current_user_id
    and id = p_cash_box_id;

  if not found then
    raise exception 'Cash box could not be deleted'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.delete_cash_box_preserving_history(text) from public, anon;
grant execute on function public.delete_cash_box_preserving_history(text) to authenticated;
