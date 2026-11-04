create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 6000),
  created_at timestamptz not null default now(),
  constraint ai_messages_conversation_owner_fkey
    foreign key (conversation_id, user_id)
    references public.ai_conversations (id, user_id)
    on delete cascade
);

create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);
create index if not exists ai_messages_user_conversation_created_idx
  on public.ai_messages (user_id, conversation_id, created_at);

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_events enable row level security;

revoke all on public.ai_conversations, public.ai_messages, public.ai_usage_events
  from public, anon, authenticated;
grant select, insert, update, delete on public.ai_conversations, public.ai_messages to authenticated;

drop policy if exists "Users can manage their own AI conversations" on public.ai_conversations;
create policy "Users can manage their own AI conversations"
  on public.ai_conversations for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own AI messages" on public.ai_messages;
create policy "Users can manage their own AI messages"
  on public.ai_messages for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.consume_fluxary_ai_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_time timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);
  delete from public.ai_usage_events
    where created_at < request_time - interval '1 day';

  if (
    select count(*) from public.ai_usage_events
    where user_id = current_user_id and created_at > request_time - interval '1 minute'
  ) >= 5 or (
    select count(*) from public.ai_usage_events
    where user_id = current_user_id and created_at > request_time - interval '1 day'
  ) >= 20 then
    return false;
  end if;

  insert into public.ai_usage_events (user_id) values (current_user_id);
  return true;
end;
$$;

revoke all on function public.consume_fluxary_ai_request() from public, anon;
grant execute on function public.consume_fluxary_ai_request() to authenticated;