create table if not exists public.league_players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  joined_at timestamptz not null default now(),
  unique (league_id, profile_id)
);

create index if not exists league_players_league_id_idx on public.league_players(league_id);
create index if not exists league_players_profile_id_idx on public.league_players(profile_id);
create index if not exists league_players_ranking_idx
  on public.league_players(league_id, points desc, wins desc, losses asc);
