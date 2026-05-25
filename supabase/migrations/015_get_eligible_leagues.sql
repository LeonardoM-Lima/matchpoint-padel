create or replace function public.get_eligible_leagues_for_match(p_player_ids uuid[])
returns table (id uuid, name text, cover_url text)
language sql
security definer
stable
set search_path = public
as $$
  select l.id, l.name, l.cover_url
    from public.leagues l
    where array_length(p_player_ids, 1) = 4
      and public.is_league_member(l.id)
      and not exists (
        select 1
          from unnest(p_player_ids) as pid(profile_id)
          where not exists (
            select 1
              from public.league_players lp
              where lp.league_id = l.id
                and lp.profile_id = pid.profile_id
          )
      )
    order by l.name asc;
$$;

grant execute on function public.get_eligible_leagues_for_match(uuid[]) to authenticated;
