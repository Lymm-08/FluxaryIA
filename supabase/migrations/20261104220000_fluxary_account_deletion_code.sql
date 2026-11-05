-- Confirma exclusão de conta por código digitado, com limite contra tentativas.
alter table public.fluxary_account_deletion_requests
  add column if not exists failed_attempts integer not null default 0
    check (failed_attempts between 0 and 5);

create or replace function public.request_fluxary_account_deletion_code(
  p_user_id uuid,
  p_request_id uuid,
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
  if p_user_id is null or p_request_id is null
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
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
    id, user_id, token_hash, created_at, expires_at
  ) values (
    p_request_id, p_user_id, p_token_hash, request_time,
    request_time + interval '30 minutes'
  );

  return jsonb_build_object('status', 'created', 'request_id', p_request_id);
end;
$$;

create or replace function public.validate_fluxary_account_deletion_code(
  p_request_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion_request public.fluxary_account_deletion_requests%rowtype;
  request_time timestamptz := now();
begin
  if p_request_id is null or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
  into deletion_request
  from public.fluxary_account_deletion_requests
  where id = p_request_id
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
  if deletion_request.expires_at <= request_time then
    return jsonb_build_object('status', 'expired');
  end if;
  if deletion_request.failed_attempts >= 5 then
    return jsonb_build_object('status', 'locked');
  end if;
  if deletion_request.token_hash <> p_token_hash then
    update public.fluxary_account_deletion_requests
    set failed_attempts = failed_attempts + 1,
        invalidated_at = case when failed_attempts + 1 >= 5 then request_time else null end
    where id = p_request_id;
    if deletion_request.failed_attempts + 1 >= 5 then
      return jsonb_build_object('status', 'locked');
    end if;
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object('status', 'valid', 'user_id', deletion_request.user_id);
end;
$$;

create or replace function public.consume_fluxary_account_deletion_code(
  p_request_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion_request public.fluxary_account_deletion_requests%rowtype;
begin
  if p_request_id is null or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
  into deletion_request
  from public.fluxary_account_deletion_requests
  where id = p_request_id
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
  if deletion_request.token_hash <> p_token_hash then
    return jsonb_build_object('status', 'invalid');
  end if;

  update public.fluxary_account_deletion_requests
  set used_at = now()
  where id = p_request_id;

  return jsonb_build_object('status', 'consumed', 'user_id', deletion_request.user_id);
end;
$$;

revoke all on function public.request_fluxary_account_deletion_code(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.validate_fluxary_account_deletion_code(uuid, text)
  from public, anon, authenticated;
revoke all on function public.consume_fluxary_account_deletion_code(uuid, text)
  from public, anon, authenticated;

grant execute on function public.request_fluxary_account_deletion_code(uuid, uuid, text)
  to service_role;
grant execute on function public.validate_fluxary_account_deletion_code(uuid, text)
  to service_role;
grant execute on function public.consume_fluxary_account_deletion_code(uuid, text)
  to service_role;
