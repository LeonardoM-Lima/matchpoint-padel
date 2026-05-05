create or replace function public.apply_match_points(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner char(1);
  v_avg_a numeric;
  v_avg_b numeric;
  v_winner_expected numeric;
  v_delta integer;
  v_k integer := 32;
  r record;
begin
  select winner_team
    into v_winner
    from public.matches
    where id = p_match_id;

  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  select
    avg(points_before) filter (where team = 'A'),
    avg(points_before) filter (where team = 'B')
    into v_avg_a, v_avg_b
    from public.match_players
    where match_id = p_match_id;

  if v_avg_a is null or v_avg_b is null then
    raise exception 'MATCH_REQUIRES_TWO_TEAMS';
  end if;

  if v_winner = 'A' then
    v_winner_expected := 1.0 / (1.0 + power(10.0, (v_avg_b - v_avg_a) / 400.0));
  else
    v_winner_expected := 1.0 / (1.0 + power(10.0, (v_avg_a - v_avg_b) / 400.0));
  end if;

  v_delta := round(v_k * (1.0 - v_winner_expected));

  perform set_config('matchpoint.bypass_profile_stats_guard', 'on', true);

  for r in
    select *
      from public.match_players
      where match_id = p_match_id
      for update
  loop
    update public.match_players
      set
        points_delta = case when r.team = v_winner then v_delta else -v_delta end,
        points_after = greatest(
          0,
          r.points_before + case when r.team = v_winner then v_delta else -v_delta end
        )
      where id = r.id;

    update public.profiles
      set
        points = greatest(
          0,
          r.points_before + case when r.team = v_winner then v_delta else -v_delta end
        ),
        wins = wins + case when r.team = v_winner then 1 else 0 end,
        losses = losses + case when r.team = v_winner then 0 else 1 end
      where id = r.profile_id;
  end loop;
end;
$$;

grant execute on function public.apply_match_points(uuid) to authenticated;
