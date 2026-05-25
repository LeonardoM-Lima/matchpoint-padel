import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabase = createClient(supabaseUrl, serviceRoleKey);

interface CleanupItem {
  video_id: string;
  storage_path: string;
}

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization');
  if (!serviceRoleKey || auth !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { items } = (await req.json()) as { items?: CleanupItem[] };
  const safeItems = Array.isArray(items) ? items : [];

  if (safeItems.length === 0) {
    return json({ removed: 0 });
  }

  const paths = safeItems.map((item) => item.storage_path).filter(Boolean);
  const ids = safeItems.map((item) => item.video_id).filter(Boolean);

  const { error: storageError } = await supabase.storage.from('videos').remove(paths);
  if (storageError) {
    console.error('Video storage cleanup failed', storageError);
  }

  const { error: dbError } = await supabase.from('videos').delete().in('id', ids);
  if (dbError) {
    console.error('Video row cleanup failed', dbError);
    return json({ removed: 0, error: dbError.message }, 500);
  }

  return json({ removed: ids.length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
