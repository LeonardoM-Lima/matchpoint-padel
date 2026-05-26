import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface ProfileRow {
  id: string;
  avatar_url: string | null;
}

interface VideoRow {
  storage_path: string | null;
}

interface LeagueRow {
  cover_url: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Function is not configured' }, 500);
  }

  const authorization = req.headers.get('authorization') ?? '';
  const jwt = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!jwt) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt);

  if (userError || !user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Failed to load profile before account deletion', profileError);
    return json({ error: 'Could not load profile' }, 500);
  }

  if (profile) {
    const profileRow = profile as ProfileRow;
    const profileId = profileRow.id;

    await removeStorageFiles(user.id, profileId, profileRow.avatar_url);

    let matchIds: string[];
    try {
      matchIds = await getMatchesToDelete(profileId);
    } catch (error) {
      console.error('Failed to load account matches', error);
      return json({ error: 'Could not load account matches' }, 500);
    }

    if (matchIds.length > 0) {
      const { error: matchesError } = await supabase.from('matches').delete().in('id', matchIds);
      if (matchesError) {
        console.error('Failed to delete account matches', matchesError);
        return json({ error: 'Could not delete account matches' }, 500);
      }
    }
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error('Failed to delete auth user', deleteUserError);
    return json({ error: 'Could not delete account' }, 500);
  }

  return json({ deleted: true });
});

async function getMatchesToDelete(profileId: string) {
  const ids = new Set<string>();

  const { data: createdMatches, error: createdError } = await supabase
    .from('matches')
    .select('id')
    .eq('created_by', profileId);

  if (createdError) {
    throw createdError;
  }

  for (const row of (createdMatches ?? []) as Array<{ id: string }>) {
    ids.add(row.id);
  }

  const { data: playerMatches, error: playerError } = await supabase
    .from('match_players')
    .select('match_id')
    .eq('profile_id', profileId);

  if (playerError) {
    throw playerError;
  }

  for (const row of (playerMatches ?? []) as Array<{ match_id: string }>) {
    ids.add(row.match_id);
  }

  return [...ids];
}

async function removeStorageFiles(userId: string, profileId: string, avatarPath: string | null) {
  const avatarPaths = new Set<string>();
  if (avatarPath) avatarPaths.add(avatarPath);

  const listedAvatars = await listStorageFolder('avatars', userId);
  for (const path of listedAvatars) avatarPaths.add(path);

  const { data: videos } = await supabase
    .from('videos')
    .select('storage_path')
    .eq('author_id', profileId);

  const videoPaths = new Set<string>();
  for (const row of (videos ?? []) as VideoRow[]) {
    if (row.storage_path) videoPaths.add(row.storage_path);
  }

  const listedVideos = await listStorageFolder('videos', userId);
  for (const path of listedVideos) videoPaths.add(path);

  const { data: leagues } = await supabase
    .from('leagues')
    .select('cover_url')
    .eq('owner_id', profileId);

  const coverPaths = new Set<string>();
  for (const row of (leagues ?? []) as LeagueRow[]) {
    if (row.cover_url) coverPaths.add(row.cover_url);
  }

  await removeFromBucket('avatars', [...avatarPaths]);
  await removeFromBucket('videos', [...videoPaths]);
  await removeFromBucket('league-covers', [...coverPaths]);
}

async function listStorageFolder(bucket: string, folder: string) {
  const { data, error } = await supabase.storage.from(bucket).list(folder);
  if (error) {
    console.error(`Failed to list ${bucket}/${folder}`, error);
    return [];
  }

  return (data ?? []).filter((item) => item.name).map((item) => `${folder}/${item.name}`);
}

async function removeFromBucket(bucket: string, paths: string[]) {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error(`Failed to remove files from ${bucket}`, error);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
