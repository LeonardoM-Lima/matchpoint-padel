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
  r record;
  v_old_pos integer;
  v_new_pos integer;
  v_pos_delta integer;
  v_direction text;
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

  -- Regra oficial do padel. Mantida comentada durante o primeiro teste para
  -- aceitar qualquer placar inteiro e nao bloquear o fluxo dos usuarios.
  -- if not (
  --   (greatest(v_team_a_score, v_team_b_score) = 6
  --     and least(v_team_a_score, v_team_b_score) between 0 and 4)
  --   or
  --   (greatest(v_team_a_score, v_team_b_score) = 7
  --     and least(v_team_a_score, v_team_b_score) in (5, 6))
  -- ) then
  --   raise exception 'Placar invalido: um time deve atingir 6 games';
  -- end if;

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

  for r in
    select mp.profile_id, mp.points_delta
    from public.match_players mp
    where mp.match_id = v_match_id
      and mp.profile_id <> v_creator
  loop
    perform public.enqueue_push_notification(
      array[r.profile_id],
      'Nova partida registrada',
      case when r.points_delta >= 0
        then 'Você ganhou ' || r.points_delta || ' pontos!'
        else 'Você perdeu ' || abs(r.points_delta) || ' pontos.'
      end,
      '/profile/history',
      'match-' || v_match_id::text || '-' || r.profile_id::text
    );
  end loop;

  for r in
    select
      mp.profile_id,
      mp.points_before,
      (p.wins - case when mp.result = 'W' then 1 else 0 end) as wins_before,
      (p.losses - case when mp.result = 'L' then 1 else 0 end) as losses_before,
      p.points as points_after,
      p.wins as wins_after,
      p.losses as losses_after
    from public.match_players mp
    join public.profiles p on p.id = mp.profile_id
    where mp.match_id = v_match_id
  loop
    select 1 + count(*)
      into v_old_pos
      from public.profiles other
      where other.id <> r.profile_id
        and other.id not in (
          select profile_id from public.match_players where match_id = v_match_id
        )
        and (other.points, other.wins, -other.losses)
          > (r.points_before, r.wins_before, -r.losses_before);

    select v_old_pos + count(*)
      into v_old_pos
      from public.match_players mp2
      join public.profiles p2 on p2.id = mp2.profile_id
      where mp2.match_id = v_match_id
        and mp2.profile_id <> r.profile_id
        and (
          mp2.points_before,
          (p2.wins - case when mp2.result = 'W' then 1 else 0 end),
          -(p2.losses - case when mp2.result = 'L' then 1 else 0 end)
        ) > (r.points_before, r.wins_before, -r.losses_before);

    select 1 + count(*)
      into v_new_pos
      from public.profiles other
      where other.id <> r.profile_id
        and (other.points, other.wins, -other.losses)
          > (r.points_after, r.wins_after, -r.losses_after);

    v_pos_delta := v_old_pos - v_new_pos;
    if abs(v_pos_delta) >= 3 then
      v_direction := case when v_pos_delta > 0 then 'subiu' else 'caiu' end;
      perform public.enqueue_push_notification(
        array[r.profile_id],
        case when v_pos_delta > 0 then 'Você subiu no ranking!' else 'Mudança no ranking' end,
        'De ' || v_old_pos || ' para ' || v_new_pos || ' (' || v_direction || ' ' || abs(v_pos_delta) || ' posições)',
        '/ranking',
        'ranking-' || r.profile_id::text || '-' || v_match_id::text
      );
    end if;
  end loop;

  return v_match_id;
end;
$$;

grant execute on function public.register_match(jsonb) to authenticated;
