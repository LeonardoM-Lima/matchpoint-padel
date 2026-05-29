begin;

alter table public.profiles
  alter column points set default 0;

set local matchpoint.bypass_profile_stats_guard = 'on';

update public.profiles
set points = 0,
    wins = 0,
    losses = 0;

commit;
