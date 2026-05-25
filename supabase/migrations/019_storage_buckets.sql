insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'league-covers',
  'league-covers',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "league_covers_insert_owner" on storage.objects;
create policy "league_covers_insert_owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'league-covers'
    and public.is_league_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "league_covers_update_owner" on storage.objects;
create policy "league_covers_update_owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'league-covers'
    and public.is_league_owner(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'league-covers'
    and public.is_league_owner(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "league_covers_delete_owner" on storage.objects;
create policy "league_covers_delete_owner"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'league-covers'
    and public.is_league_owner(((storage.foldername(name))[1])::uuid)
  );
