create or replace function public.delete_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
  v_created_at timestamptz;
  v_caller uuid;
  r record;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select created_by, created_at
    into v_created_by, v_created_at
    from public.matches
    where id = p_match_id
    for update;

  if not found then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  select id
    into v_caller
    from public.profiles
    where user_id = auth.uid();

  if v_caller is distinct from v_created_by then
    raise exception 'MATCH_DELETE_FORBIDDEN: Apenas o criador da partida pode excluir este registro.'
      using errcode = '42501';
  end if;

  if now() - v_created_at > interval '5 minutes' then
    raise exception 'MATCH_DELETE_EXPIRED: Prazo de exclusao expirado';
  end if;

  perform set_config('matchpoint.bypass_profile_stats_guard', 'on', true);

  for r in
    select *
      from public.match_players
      where match_id = p_match_id
      for update
  loop
    update public.profiles
      set
        points = r.points_before,
        wins = greatest(0, wins - case when r.result = 'W' then 1 else 0 end),
        losses = greatest(0, losses - case when r.result = 'L' then 1 else 0 end)
      where id = r.profile_id;
  end loop;

  delete from public.matches where id = p_match_id;
end;
$$;

grant execute on function public.delete_match(uuid) to authenticated;
