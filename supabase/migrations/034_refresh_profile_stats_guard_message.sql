create or replace function public.prevent_direct_profile_stats_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('matchpoint.bypass_profile_stats_guard', true) = 'on' then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.email is distinct from old.email
    or new.points is distinct from old.points
    or new.wins is distinct from old.wins
    or new.losses is distinct from old.losses then
    raise exception 'Profile sensitive fields can only be changed by EvoPadel RPCs'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
