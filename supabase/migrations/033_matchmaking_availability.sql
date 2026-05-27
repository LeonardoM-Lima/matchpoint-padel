create table if not exists public.matchmaking_availability (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  whatsapp_number text not null check (whatsapp_number ~ '^55[0-9]{10,11}$'),
  available_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists matchmaking_availability_active_idx
  on public.matchmaking_availability(available_until desc);

alter table public.matchmaking_availability enable row level security;

revoke all on public.matchmaking_availability from anon;
grant select, insert, update, delete on public.matchmaking_availability to authenticated;

drop policy if exists "matchmaking_availability_select_active_or_own" on public.matchmaking_availability;
create policy "matchmaking_availability_select_active_or_own"
  on public.matchmaking_availability for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = matchmaking_availability.profile_id
        and profiles.user_id = auth.uid()
    )
    or (
      available_until > now()
      and exists (
        select 1
        from public.profiles candidate
        join public.profiles current_user_profile
          on current_user_profile.user_id = auth.uid()
        where candidate.id = matchmaking_availability.profile_id
          and candidate.category is not null
          and current_user_profile.category = candidate.category
      )
    )
  );

drop policy if exists "matchmaking_availability_insert_own" on public.matchmaking_availability;
create policy "matchmaking_availability_insert_own"
  on public.matchmaking_availability for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = matchmaking_availability.profile_id
        and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "matchmaking_availability_update_own" on public.matchmaking_availability;
create policy "matchmaking_availability_update_own"
  on public.matchmaking_availability for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = matchmaking_availability.profile_id
        and profiles.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = matchmaking_availability.profile_id
        and profiles.user_id = auth.uid()
    )
  );

drop policy if exists "matchmaking_availability_delete_own" on public.matchmaking_availability;
create policy "matchmaking_availability_delete_own"
  on public.matchmaking_availability for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = matchmaking_availability.profile_id
        and profiles.user_id = auth.uid()
    )
  );

create or replace function public.set_matchmaking_availability_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists matchmaking_availability_set_updated_at on public.matchmaking_availability;
create trigger matchmaking_availability_set_updated_at
  before update on public.matchmaking_availability
  for each row execute function public.set_matchmaking_availability_updated_at();
