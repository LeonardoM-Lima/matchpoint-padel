create or replace function public.current_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.profiles where user_id = auth.uid()
$$;

revoke all on function public.current_profile_id() from public;
grant execute on function public.current_profile_id() to authenticated;

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.league_players lp
      where lp.league_id = p_league_id
        and lp.profile_id = public.current_profile_id()
  )
$$;

revoke all on function public.is_league_member(uuid) from public;
grant execute on function public.is_league_member(uuid) to authenticated;

create or replace function public.is_league_owner(p_league_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.leagues l
      where l.id = p_league_id
        and l.owner_id = public.current_profile_id()
  )
$$;

revoke all on function public.is_league_owner(uuid) from public;
grant execute on function public.is_league_owner(uuid) to authenticated;
