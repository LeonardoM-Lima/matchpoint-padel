alter table public.leagues enable row level security;
alter table public.league_players enable row level security;
alter table public.match_leagues enable row level security;
alter table public.match_league_players enable row level security;

drop policy if exists "leagues_select_member_or_owner" on public.leagues;
create policy "leagues_select_member_or_owner"
  on public.leagues for select
  to authenticated
  using (public.is_league_owner(id) or public.is_league_member(id));

drop policy if exists "league_players_select_same_league" on public.league_players;
create policy "league_players_select_same_league"
  on public.league_players for select
  to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "match_leagues_select_same_league" on public.match_leagues;
create policy "match_leagues_select_same_league"
  on public.match_leagues for select
  to authenticated
  using (league_id is null or public.is_league_member(league_id));

drop policy if exists "match_league_players_select_same_league" on public.match_league_players;
create policy "match_league_players_select_same_league"
  on public.match_league_players for select
  to authenticated
  using (league_id is null or public.is_league_member(league_id));

revoke insert, update, delete on public.leagues from anon, authenticated;
revoke insert, update, delete on public.league_players from anon, authenticated;
revoke insert, update, delete on public.match_leagues from anon, authenticated;
revoke insert, update, delete on public.match_league_players from anon, authenticated;
