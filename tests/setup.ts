import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321';
export const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey;

export const supabaseTestClient = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function resetDatabase() {
  await supabaseAdminClient.from('match_players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdminClient.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdminClient.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
