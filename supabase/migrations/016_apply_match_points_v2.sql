create or replace function public.apply_match_points(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner char(1);
  v_avg_a_global numeric;
  v_avg_b_global numeric;
  v_avg_a_league numeric;
  v_avg_b_league numeric;
  v_expected_global numeric;
  v_expected_league numeric;
  v_delta_global integer;
  v_delta_league integer;
  v_k integer := 32;
  v_league_id uuid;
  r record;
begin
  select winner_team
    into v_winner
    from public.matches
    where id = p_match_id;

  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  select league_id
    into v_league_id
    from public.match_leagues
    where match_id = p_match_id;

  select
    avg(points_before) filter (where team = 'A'),
    avg(points_before) filter (where team = 'B')
    into v_avg_a_global, v_avg_b_global
    from public.match_players
    where match_id = p_match_id;

  if v_avg_a_global is null or v_avg_b_global is null then
    raise exception 'MATCH_REQUIRES_TWO_TEAMS';
  end if;

  if v_winner = 'A' then
    v_expected_global := 1.0 / (1.0 + power(10.0, (v_avg_b_global - v_avg_a_global) / 400.0));
  else
    v_expected_global := 1.0 / (1.0 + power(10.0, (v_avg_a_global - v_avg_b_global) / 400.0));
  end if;
  v_delta_global := round(v_k * (1.0 - v_expected_global));

  if v_league_id is not null then
    select
      avg(mlp.league_points_before) filter (where mp.team = 'A'),
      avg(mlp.league_points_before) filter (where mp.team = 'B')
      into v_avg_a_league, v_avg_b_league
      from public.match_league_players mlp
      join public.match_players mp
        on mp.match_id = mlp.match_id
       and mp.profile_id = mlp.profile_id
      where mlp.match_id = p_match_id;

    if v_avg_a_league is null or v_avg_b_league is null then
      raise exception 'MATCH_REQUIRES_TWO_LEAGUE_TEAMS';
    end if;

    if v_winner = 'A' then
      v_expected_league := 1.0 / (1.0 + power(10.0, (v_avg_b_league - v_avg_a_league) / 400.0));
    else
      v_expected_league := 1.0 / (1.0 + power(10.0, (v_avg_a_league - v_avg_b_league) / 400.0));
    end if;
    v_delta_league := round(v_k * (1.0 - v_expected_league));
  end if;

  perform set_config('matchpoint.bypass_profile_stats_guard', 'on', true);

  for r in
    select *
      from public.match_players
      where match_id = p_match_id
      for update
  loop
    update public.match_players
      set
        points_delta = case when r.team = v_winner then v_delta_global else -v_delta_global end,
        points_after = greatest(
          0,
          r.points_before + case when r.team = v_winner then v_delta_global else -v_delta_global end
        )
      where id = r.id;

    update public.profiles
      set
        points = greatest(
          0,
          r.points_before + case when r.team = v_winner then v_delta_global else -v_delta_global end
        ),
        wins = wins + case when r.team = v_winner then 1 else 0 end,
        losses = losses + case when r.team = v_winner then 0 else 1 end
      where id = r.profile_id;

    if v_league_id is not null then
      update public.match_league_players
        set
          league_points_delta = case when r.team = v_winner then v_delta_league else -v_delta_league end,
          league_points_after = greatest(
            0,
            league_points_before + case when r.team = v_winner then v_delta_league else -v_delta_league end
          )
        where match_id = p_match_id and profile_id = r.profile_id;

      update public.league_players lp
        set
          points = mlp.league_points_after,
          wins = lp.wins + case when r.team = v_winner then 1 else 0 end,
          losses = lp.losses + case when r.team = v_winner then 0 else 1 end
        from public.match_league_players mlp
        where lp.league_id = v_league_id
          and lp.profile_id = r.profile_id
          and mlp.match_id = p_match_id
          and mlp.profile_id = r.profile_id;
    end if;
  end loop;
end;
$$;

grant execute on function public.apply_match_points(uuid) to authenticated;
