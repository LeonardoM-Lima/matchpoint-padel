do $$
begin
  if not exists (select 1 from pg_type where typname = 'video_category') then
    create type public.video_category as enum (
      'smash',
      'bandeja',
      'vibora',
      'saque',
      'tombo',
      'furada',
      'engracado',
      'outras'
    );
  end if;
end $$;

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 80),
  category public.video_category not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 days')
);

create index if not exists videos_created_at_idx on public.videos(created_at desc);
create index if not exists videos_expires_at_idx on public.videos(expires_at);
create index if not exists videos_author_id_idx on public.videos(author_id);
