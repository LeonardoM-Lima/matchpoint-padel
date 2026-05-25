insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  true,
  31457280,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos_select_public" on storage.objects;
create policy "videos_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'videos');

drop policy if exists "videos_insert_own" on storage.objects;
create policy "videos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or owner = auth.uid()
      or owner_id = auth.uid()::text
    )
  );

drop policy if exists "videos_update_own" on storage.objects;
create policy "videos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or owner = auth.uid()
      or owner_id = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or owner = auth.uid()
      or owner_id = auth.uid()::text
    )
  );

drop policy if exists "videos_delete_own" on storage.objects;
create policy "videos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or owner = auth.uid()
      or owner_id = auth.uid()::text
    )
  );
