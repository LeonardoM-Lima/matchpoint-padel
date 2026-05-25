create table if not exists public.video_likes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (video_id, profile_id)
);

create index if not exists video_likes_video_id_idx on public.video_likes(video_id);
create index if not exists video_likes_profile_id_idx on public.video_likes(profile_id);
