create or replace function public.cleanup_expired_videos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_count integer;
  v_edge_function_url text := nullif(current_setting('app.edge_function_url', true), '');
  v_edge_function_key text := nullif(current_setting('app.edge_function_key', true), '');
begin
  select
    jsonb_agg(jsonb_build_object('video_id', id, 'storage_path', storage_path)),
    count(*)::integer
    into v_items, v_count
    from public.videos
    where expires_at <= now();

  if v_count = 0 or v_items is null then
    return 0;
  end if;

  if v_edge_function_url is null or v_edge_function_key is null then
    raise notice 'cleanup skipped: app.edge_function_url/app.edge_function_key not configured';
    return 0;
  end if;

  perform net.http_post(
    url := v_edge_function_url || '/cleanup-video',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_edge_function_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('items', v_items)
  );

  raise notice 'cleanup enqueued: expired_videos=%', v_count;
  return v_count;
end;
$$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'cleanup-expired-videos') then
      perform cron.unschedule('cleanup-expired-videos');
    end if;

    perform cron.schedule(
      'cleanup-expired-videos',
      '0 3 * * *',
      $$ select public.cleanup_expired_videos(); $$
    );
  end if;
end $cron$;
