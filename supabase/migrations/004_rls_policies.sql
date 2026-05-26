alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles_update_own_non_sensitive" on public.profiles;
create policy "profiles_update_own_non_sensitive"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "matches_select_authenticated" on public.matches;
create policy "matches_select_authenticated"
  on public.matches for select
  to authenticated
  using (true);

drop policy if exists "match_players_select_authenticated" on public.match_players;
create policy "match_players_select_authenticated"
  on public.match_players for select
  to authenticated
  using (true);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_direct_profile_stats_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('matchpoint.bypass_profile_stats_guard', true) = 'on' then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.email is distinct from old.email
    or new.points is distinct from old.points
    or new.wins is distinct from old.wins
    or new.losses is distinct from old.losses then
    raise exception 'Profile sensitive fields can only be changed by PadelUP RPCs'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_direct_stats_update on public.profiles;
create trigger profiles_prevent_direct_stats_update
  before update on public.profiles
  for each row execute function public.prevent_direct_profile_stats_update();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profile_updated_at();

revoke insert, update, delete on public.matches from anon, authenticated;
revoke insert, update, delete on public.match_players from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
