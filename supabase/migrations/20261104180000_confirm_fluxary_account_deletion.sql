-- Migração: confirmação por e-mail e exclusão segura da conta Fluxary.
-- Tabela: solicitações temporárias de exclusão de conta (fluxary_account_deletion_requests).
create table if not exists public.fluxary_account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  invalidated_at timestamptz,
  constraint fluxary_account_deletion_expiry_check
    check (expires_at > created_at)
);

create index if not exists fluxary_account_deletion_user_created_idx
  on public.fluxary_account_deletion_requests (user_id, created_at desc);
create index if not exists fluxary_account_deletion_expiry_idx
  on public.fluxary_account_deletion_requests (expires_at)
  where used_at is null and invalidated_at is null;

alter table public.fluxary_account_deletion_requests enable row level security;
revoke all on public.fluxary_account_deletion_requests from public, anon, authenticated;

-- Função: cria token com validade de 30 minutos e limita pedidos a 3 por dia.
create or replace function public.request_fluxary_account_deletion(
  p_user_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_time timestamptz := now();
begin
  if p_user_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  if (
    select count(*)
    from public.fluxary_account_deletion_requests
    where user_id = p_user_id
      and created_at > request_time - interval '1 day'
  ) >= 3 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  update public.fluxary_account_deletion_requests
  set invalidated_at = request_time
  where user_id = p_user_id
    and used_at is null
    and invalidated_at is null;

  insert into public.fluxary_account_deletion_requests (
    user_id, token_hash, created_at, expires_at
  ) values (
    p_user_id, p_token_hash, request_time, request_time + interval '30 minutes'
  );

  return jsonb_build_object('status', 'created');
end;
$$;

-- Função: valida o token sem consumi-lo, para permitir a confirmação explícita na página.
create or replace function public.validate_fluxary_account_deletion_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion_request public.fluxary_account_deletion_requests%rowtype;
begin
  select *
  into deletion_request
  from public.fluxary_account_deletion_requests
  where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if deletion_request.used_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if deletion_request.invalidated_at is not null then
    return jsonb_build_object('status', 'invalid');
  end if;
  if deletion_request.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  return jsonb_build_object('status', 'valid', 'user_id', deletion_request.user_id);
end;
$$;

-- Função: consome o token de forma atômica e devolve somente a conta vinculada a ele.
create or replace function public.consume_fluxary_account_deletion_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion_request public.fluxary_account_deletion_requests%rowtype;
begin
  select *
  into deletion_request
  from public.fluxary_account_deletion_requests
  where token_hash = p_token_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if deletion_request.used_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if deletion_request.invalidated_at is not null then
    return jsonb_build_object('status', 'invalid');
  end if;
  if deletion_request.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  update public.fluxary_account_deletion_requests
  set used_at = now()
  where id = deletion_request.id;

  return jsonb_build_object('status', 'consumed', 'user_id', deletion_request.user_id);
end;
$$;

-- Função: lista objetos do Storage pertencentes à conta, em páginas estáveis para remoção.
create or replace function public.list_fluxary_owned_storage_objects(
  p_user_id uuid,
  p_after_bucket_id text default '',
  p_after_object_name text default '',
  p_page_size integer default 100
)
returns table (bucket_id text, object_name text)
language sql
security definer
set search_path = ''
as $$
  select objects.bucket_id, objects.name
  from storage.objects as objects
  where objects.owner_id = p_user_id::text
    and (objects.bucket_id, objects.name) > (p_after_bucket_id, p_after_object_name)
  order by objects.bucket_id, objects.name
  limit least(greatest(coalesce(p_page_size, 100), 1), 500);
$$;

-- Função: remove primeiro os vínculos restritivos antes da exclusão administrativa no Auth.
create or replace function public.delete_fluxary_user_data_before_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.transactions where user_id = old.id;
  delete from public.budgets where user_id = old.id;
  delete from public.cash_box_deposits where user_id = old.id;
  return old;
end;
$$;

drop trigger if exists fluxary_user_data_before_auth_delete on auth.users;
create trigger fluxary_user_data_before_auth_delete
before delete on auth.users
for each row execute function public.delete_fluxary_user_data_before_auth_delete();

revoke all on function public.request_fluxary_account_deletion(uuid, text)
  from public, anon, authenticated;
revoke all on function public.validate_fluxary_account_deletion_token(text)
  from public, anon, authenticated;
revoke all on function public.consume_fluxary_account_deletion_token(text)
  from public, anon, authenticated;
revoke all on function public.list_fluxary_owned_storage_objects(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.delete_fluxary_user_data_before_auth_delete()
  from public, anon, authenticated;

grant execute on function public.request_fluxary_account_deletion(uuid, text) to service_role;
grant execute on function public.validate_fluxary_account_deletion_token(text) to service_role;
grant execute on function public.consume_fluxary_account_deletion_token(text) to service_role;
grant execute on function public.list_fluxary_owned_storage_objects(uuid, text, text, integer) to service_role;

comment on table public.fluxary_account_deletion_requests is
  'Solicitações de exclusão de conta do Fluxary; somente hashes de tokens são armazenados.';
comment on function public.delete_fluxary_user_data_before_auth_delete() is
  'Remove dependências financeiras restritivas dentro da transação de exclusão da conta Auth.';
