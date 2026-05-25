create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

revoke all on table public.app_settings from public;
revoke all on table public.app_settings from anon;
revoke all on table public.app_settings from authenticated;
grant select, insert, update, delete on table public.app_settings to service_role;

create or replace function public.upsert_app_setting(p_key text, p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.app_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
end;
$$;

revoke all on function public.upsert_app_setting(text, text) from public;
grant execute on function public.upsert_app_setting(text, text) to service_role;

create or replace function public.enqueue_push_notification(
  p_profile_ids uuid[],
  p_title text,
  p_body text,
  p_url text,
  p_tag text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filtered uuid[];
  v_edge_function_url text;
  v_edge_function_key text;
begin
  if p_profile_ids is null or cardinality(p_profile_ids) = 0 then
    raise notice 'push skipped: empty profile list';
    return;
  end if;

  select array_agg(distinct ps.profile_id)
    into v_filtered
    from public.push_subscriptions ps
    where ps.profile_id = any(p_profile_ids);

  if v_filtered is null or cardinality(v_filtered) = 0 then
    raise notice 'push skipped: no active subscriptions';
    return;
  end if;

  select value into v_edge_function_url
    from public.app_settings
    where key = 'edge_function_url';

  select value into v_edge_function_key
    from public.app_settings
    where key = 'edge_function_key';

  if nullif(v_edge_function_url, '') is null or nullif(v_edge_function_key, '') is null then
    raise notice 'push skipped: edge function settings not configured';
    return;
  end if;

  perform net.http_post(
    url := v_edge_function_url || '/send-push-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_edge_function_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'profile_ids', to_jsonb(v_filtered),
      'title', p_title,
      'body', p_body,
      'url', p_url,
      'tag', p_tag
    )
  );

  raise notice 'push enqueued: title=%, recipients=%', p_title, cardinality(v_filtered);
end;
$$;

revoke all on function public.enqueue_push_notification(uuid[], text, text, text, text) from public;

create or replace function public.cleanup_expired_videos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_count integer;
  v_edge_function_url text;
  v_edge_function_key text;
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

  select value into v_edge_function_url
    from public.app_settings
    where key = 'edge_function_url';

  select value into v_edge_function_key
    from public.app_settings
    where key = 'edge_function_key';

  if nullif(v_edge_function_url, '') is null or nullif(v_edge_function_key, '') is null then
    raise notice 'cleanup skipped: edge function settings not configured';
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
