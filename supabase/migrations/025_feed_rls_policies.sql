alter table public.videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "videos_select_active_or_own" on public.videos;
create policy "videos_select_active_or_own"
  on public.videos for select
  to authenticated
  using (
    expires_at > now()
    or author_id = public.current_profile_id()
  );

drop policy if exists "videos_insert_own" on public.videos;
create policy "videos_insert_own"
  on public.videos for insert
  to authenticated
  with check (author_id = public.current_profile_id());

drop policy if exists "videos_delete_own" on public.videos;
create policy "videos_delete_own"
  on public.videos for delete
  to authenticated
  using (author_id = public.current_profile_id());

drop policy if exists "video_likes_select_own" on public.video_likes;
create policy "video_likes_select_own"
  on public.video_likes for select
  to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists "video_likes_insert_own" on public.video_likes;
create policy "video_likes_insert_own"
  on public.video_likes for insert
  to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "video_likes_delete_own" on public.video_likes;
create policy "video_likes_delete_own"
  on public.video_likes for delete
  to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  to authenticated
  using (profile_id = public.current_profile_id());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  to authenticated
  with check (profile_id = public.current_profile_id());

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  to authenticated
  using (profile_id = public.current_profile_id());

revoke update on public.videos from anon, authenticated;
revoke update on public.video_likes from anon, authenticated;
revoke update on public.push_subscriptions from anon, authenticated;
