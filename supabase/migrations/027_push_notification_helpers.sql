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
  v_edge_function_url text := nullif(current_setting('app.edge_function_url', true), '');
  v_edge_function_key text := nullif(current_setting('app.edge_function_key', true), '');
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

  if v_edge_function_url is null or v_edge_function_key is null then
    raise notice 'push skipped: app.edge_function_url/app.edge_function_key not configured';
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
