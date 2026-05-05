create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  team_a_score integer not null check (team_a_score >= 0),
  team_b_score integer not null check (team_b_score >= 0),
  winner_team char(1) not null check (winner_team in ('A', 'B')),
  played_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists matches_created_by_idx on public.matches(created_by);
create index if not exists matches_played_at_idx on public.matches(played_at desc);
