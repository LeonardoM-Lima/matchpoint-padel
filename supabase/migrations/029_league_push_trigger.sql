create or replace function public.notify_league_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_league_name text;
begin
  select owner_id, name
    into v_owner_id, v_league_name
    from public.leagues
    where id = new.league_id;

  if new.profile_id = v_owner_id then
    return new;
  end if;

  perform public.enqueue_push_notification(
    array[new.profile_id],
    'Convite para liga',
    'Você foi adicionado à liga "' || v_league_name || '"',
    '/leagues/' || new.league_id::text,
    'league-' || new.league_id::text || '-' || new.profile_id::text
  );

  raise notice 'league push evaluated: league=%, profile=%', new.league_id, new.profile_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_league_added on public.league_players;
create trigger trg_notify_league_added
  after insert on public.league_players
  for each row
  execute function public.notify_league_added();
