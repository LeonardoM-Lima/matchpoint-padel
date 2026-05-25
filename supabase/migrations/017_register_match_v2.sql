create or replace function public.register_match(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_winner char(1);
  v_team_a_score integer;
  v_team_b_score integer;
  v_creator uuid;
  v_player jsonb;
  v_points_before integer;
  v_league_points_before integer;
  v_league_id uuid := nullif(payload->>'league_id', '')::uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select id into v_creator from public.profiles where user_id = auth.uid();
  if v_creator is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  v_team_a_score := (payload->>'team_a_score')::integer;
  v_team_b_score := (payload->>'team_b_score')::integer;

  if payload->'players' is null or jsonb_typeof(payload->'players') <> 'array' then
    raise exception 'PLAYERS_REQUIRED';
  end if;

  if jsonb_array_length(payload->'players') <> 4 then
    raise exception 'Partida requer exatamente 4 jogadores';
  end if;

  if (
    select count(distinct player->>'profile_id')
    from jsonb_array_elements(payload->'players') as player
  ) <> 4 then
    raise exception 'Um jogador nao pode aparecer mais de uma vez na mesma partida';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(payload->'players') as player
    where player->>'team' = 'A'
  ) <> 2 or (
    select count(*)
    from jsonb_array_elements(payload->'players') as player
    where player->>'team' = 'B'
  ) <> 2 then
    raise exception 'Cada time deve ter exatamente 2 jogadores';
  end if;

  if not (
    (greatest(v_team_a_score, v_team_b_score) = 6
      and least(v_team_a_score, v_team_b_score) between 0 and 4)
    or
    (greatest(v_team_a_score, v_team_b_score) = 7
      and least(v_team_a_score, v_team_b_score) in (5, 6))
  ) then
    raise exception 'Placar invalido: um time deve atingir 6 games';
  end if;

  if v_league_id is not null then
    if exists (
      select 1
        from jsonb_array_elements(payload->'players') as player
        where not exists (
          select 1
            from public.league_players lp
            where lp.league_id = v_league_id
              and lp.profile_id = (player->>'profile_id')::uuid
        )
    ) then
      raise exception 'Todos os 4 jogadores devem participar da liga';
    end if;
  end if;

  v_winner := case when v_team_a_score > v_team_b_score then 'A' else 'B' end;

  insert into public.matches (created_by, team_a_score, team_b_score, winner_team)
  values (v_creator, v_team_a_score, v_team_b_score, v_winner)
  returning id into v_match_id;

  if v_league_id is not null then
    insert into public.match_leagues (match_id, league_id)
    values (v_match_id, v_league_id);
  end if;

  for v_player in select * from jsonb_array_elements(payload->'players')
  loop
    select points
      into v_points_before
      from public.profiles
      where id = (v_player->>'profile_id')::uuid
      for update;

    if v_points_before is null then
      raise exception 'PLAYER_PROFILE_NOT_FOUND';
    end if;

    insert into public.match_players (
      match_id,
      profile_id,
      team,
      result,
      points_before,
      points_delta,
      points_after
    )
    values (
      v_match_id,
      (v_player->>'profile_id')::uuid,
      (v_player->>'team')::char(1),
      case when v_player->>'team' = v_winner then 'W' else 'L' end,
      v_points_before,
      0,
      v_points_before
    );

    if v_league_id is not null then
      select points
        into v_league_points_before
        from public.league_players
        where league_id = v_league_id
          and profile_id = (v_player->>'profile_id')::uuid
        for update;

      insert into public.match_league_players (
        match_id,
        league_id,
        profile_id,
        league_points_before,
        league_points_delta,
        league_points_after
      )
      values (
        v_match_id,
        v_league_id,
        (v_player->>'profile_id')::uuid,
        v_league_points_before,
        0,
        v_league_points_before
      );
    end if;
  end loop;

  perform public.apply_match_points(v_match_id);

  return v_match_id;
end;
$$;

grant execute on function public.register_match(jsonb) to authenticated;
