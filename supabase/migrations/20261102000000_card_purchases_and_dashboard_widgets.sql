-- Registra compras parceladas e ajustes das preferencias de tela inicial.
alter table public.user_settings
  add column if not exists dashboard_widgets jsonb not null
  default '["cards", "goals"]'::jsonb;

alter table public.user_settings
  drop constraint if exists user_settings_dashboard_widgets_check;

alter table public.user_settings
  add constraint user_settings_dashboard_widgets_check
  check (
    jsonb_typeof(dashboard_widgets) = 'array'
    and dashboard_widgets <@ '["cards", "goals"]'::jsonb
  );

alter table public.transactions
  add column if not exists credit_card_id text null,
  add column if not exists category_id text null,
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

alter table public.budgets
  add column if not exists category_id text null,
  drop constraint if exists budgets_category_user_fkey,
  add constraint budgets_category_user_fkey
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on delete set null (category_id);

create index if not exists transactions_user_credit_card_idx
  on public.transactions (user_id, credit_card_id, transaction_date desc)
  where credit_card_id is not null;

create index if not exists transactions_installment_group_idx
  on public.transactions (user_id, installment_group_id)
  where installment_group_id is not null;
create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id)
  where category_id is not null;
create index if not exists budgets_user_category_id_idx
  on public.budgets (user_id, category_id)
  where category_id is not null;
