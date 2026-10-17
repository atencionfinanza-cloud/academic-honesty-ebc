-- Academic Honesty: persistencia adicional y aislamiento por estudiante
-- Ejecutar en Supabase > SQL Editor. No contiene claves secretas.
create table if not exists public.quest_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_key text not null,
  reflection text not null default '',
  updated_at timestamptz not null default now(),
  constraint quest_reflections_user_quest_unique unique (user_id, quest_key)
);
alter table public.quest_reflections enable row level security;
drop policy if exists "Students manage own quest reflections" on public.quest_reflections;
create policy "Students manage own quest reflections" on public.quest_reflections
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.safe_space_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (topic in ('academico','integridad','conflicto','presion','bienestar','otro')),
  urgency text not null check (urgency in ('normal','pronto','riesgo')),
  message text not null default '',
  created_at timestamptz not null default now()
);
alter table public.safe_space_messages enable row level security;
drop policy if exists "Students insert own safe space messages" on public.safe_space_messages;
create policy "Students insert own safe space messages" on public.safe_space_messages
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Students read own safe space messages" on public.safe_space_messages;
create policy "Students read own safe space messages" on public.safe_space_messages
  for select to authenticated using (auth.uid() = user_id);

create index if not exists quest_reflections_user_id_idx on public.quest_reflections(user_id);
create index if not exists safe_space_messages_user_id_created_at_idx on public.safe_space_messages(user_id, created_at desc);
