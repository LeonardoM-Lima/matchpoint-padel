import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const edgeFunctionKey = Deno.env.get('EDGE_FUNCTION_KEY') ?? serviceRoleKey;
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@evopadel.app',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
);

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface PushPayload {
  profile_ids?: string[];
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization');
  if (!edgeFunctionKey || auth !== `Bearer ${edgeFunctionKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = (await req.json()) as PushPayload;
  const profileIds = payload.profile_ids ?? [];

  if (!Array.isArray(profileIds) || profileIds.length === 0) {
    return json({ sent: 0, dead: 0 });
  }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('profile_id', profileIds);

  if (error) {
    console.error('Failed to load subscriptions', error);
    return json({ sent: 0, dead: 0, error: error.message }, 500);
  }

  const dead: string[] = [];
  const rows = (subscriptions ?? []) as PushSubscriptionRow[];

  const results = await Promise.allSettled(
    rows.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: payload.title ?? 'EvoPadel',
            body: payload.body ?? '',
            icon: '/icons/pwa-192x192.png',
            tag: payload.tag ?? 'evopadel',
            url: payload.url ?? '/',
          }),
        );
      } catch (err) {
        const statusCode = typeof err === 'object' && err && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;

        if (statusCode === 404 || statusCode === 410) {
          dead.push(subscription.id);
        }

        throw err;
      }
    }),
  );

  if (dead.length > 0) {
    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', dead);

    if (deleteError) {
      console.error('Failed to delete dead subscriptions', deleteError);
    }
  }

  return json({
    sent: results.filter((result) => result.status === 'fulfilled').length,
    dead: dead.length,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
