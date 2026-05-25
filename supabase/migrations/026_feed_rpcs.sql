create or replace function public.get_feed(p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  title text,
  category public.video_category,
  storage_path text,
  created_at timestamptz,
  like_count integer,
  viewer_liked boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with viewer as (
    select public.current_profile_id() as id
  )
  select
    v.id,
    v.author_id,
    p.name as author_name,
    p.avatar_url as author_avatar,
    v.title,
    v.category,
    v.storage_path,
    v.created_at,
    coalesce(lc.count, 0)::integer as like_count,
    exists (
      select 1
      from public.video_likes vl
      where vl.video_id = v.id
        and vl.profile_id = (select id from viewer)
    ) as viewer_liked
  from public.videos v
  join public.profiles p on p.id = v.author_id
  left join lateral (
    select count(*) from public.video_likes vl where vl.video_id = v.id
  ) lc on true
  where v.expires_at > now()
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.get_feed(integer, integer) from public;
grant execute on function public.get_feed(integer, integer) to authenticated;

create or replace function public.get_my_videos(p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  title text,
  category public.video_category,
  storage_path text,
  created_at timestamptz,
  expires_at timestamptz,
  like_count integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    v.id,
    v.title,
    v.category,
    v.storage_path,
    v.created_at,
    v.expires_at,
    coalesce(lc.count, 0)::integer as like_count
  from public.videos v
  left join lateral (
    select count(*) from public.video_likes vl where vl.video_id = v.id
  ) lc on true
  where v.author_id = public.current_profile_id()
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.get_my_videos(integer, integer) from public;
grant execute on function public.get_my_videos(integer, integer) to authenticated;
