create or replace function public.notify_league_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_name text;
begin
  select name
    into v_league_name
    from public.leagues
    where id = old.league_id;

  if v_league_name is null then
    return old;
  end if;

  perform public.enqueue_push_notification(
    array[old.profile_id],
    'Voce saiu de uma liga',
    'Sua participacao na liga "' || v_league_name || '" foi removida.',
    '/leagues',
    'league-removed-' || old.league_id::text || '-' || old.profile_id::text
  );

  return old;
end;
$$;

drop trigger if exists trg_notify_league_removed on public.league_players;
create trigger trg_notify_league_removed
  after delete on public.league_players
  for each row
  execute function public.notify_league_removed();

create or replace function public.notify_match_creator_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  select created_by
    into v_created_by
    from public.matches
    where id = new.match_id;

  if v_created_by is distinct from new.profile_id then
    return new;
  end if;

  perform public.enqueue_push_notification(
    array[new.profile_id],
    'Partida registrada',
    case when new.points_delta >= 0
      then 'Voce ganhou ' || new.points_delta || ' pontos!'
      else 'Voce perdeu ' || abs(new.points_delta) || ' pontos.'
    end,
    '/profile/history',
    'match-' || new.match_id::text || '-' || new.profile_id::text
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_match_creator_points on public.match_players;
create trigger trg_notify_match_creator_points
  after update of points_delta on public.match_players
  for each row
  when (old.points_delta = 0 and new.points_delta <> 0)
  execute function public.notify_match_creator_points();
