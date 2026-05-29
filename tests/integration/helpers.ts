import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadEnv } from 'vite';

const env = {
  ...loadEnv('', process.cwd(), ''),
  ...process.env,
};

const supabaseUrl = env.VITE_SUPABASE_URL ?? 'http://localhost:54321';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? '';
const password = 'password123';
const dbTargetFlag = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')
  ? '--local'
  : '--linked';

interface QueryResult<T> {
  rows: T[];
}

export interface TestPlayer {
  id: string;
  email: string;
  name: string;
  points: number;
}

export interface TestProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  points: number;
  wins: number;
  losses: number;
}

export interface RankingProfileRow {
  id: string;
  name: string;
  category?: string | null;
  points: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

export interface MatchPlayerRow {
  profile_id: string;
  team: 'A' | 'B';
  result: 'W' | 'L';
  points_before: number;
  points_delta: number;
  points_after: number;
}

export interface LeaguePlayerStatsRow {
  profile_id: string;
  points: number;
  wins: number;
  losses: number;
}

export interface MatchLeaguePlayerRow {
  profile_id: string;
  league_points_before: number;
  league_points_delta: number;
  league_points_after: number;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function runSql(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'evopadel-sql-'));
  const file = join(dir, 'query.sql');

  try {
    writeFileSync(file, sql);
    execFileSync('supabase', ['db', 'query', dbTargetFlag, '--file', file], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function queryRows<T>(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), 'evopadel-sql-'));
  const file = join(dir, 'query.sql');

  try {
    writeFileSync(file, sql);
    const stdout = execFileSync('supabase', ['db', 'query', dbTargetFlag, '--file', file], {
      cwd: process.cwd(),
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return (JSON.parse(stdout) as QueryResult<T>).rows;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function makePlayers(points: number[], label = 'player'): TestPlayer[] {
  const suffix = randomUUID();

  return points.map((pointValue, index) => ({
    id: randomUUID(),
    email: `${label}-${index}-${suffix}@evopadel.test`,
    name: `${label}-${index}`,
    points: pointValue,
  }));
}

export function insertTestPlayers(players: TestPlayer[]) {
  const userRows = players
    .map(
      (player) => `(
        '00000000-0000-0000-0000-000000000000',
        ${sqlString(player.id)},
        'authenticated',
        'authenticated',
        ${sqlString(player.email)},
        crypt(${sqlString(password)}, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', ${sqlString(player.name)}),
        now(),
        now()
      )`,
    )
    .join(',\n');

  const idList = players.map((player) => sqlString(player.id)).join(',');
  const statUpdates = players
    .map(
      (player) => `
        update public.profiles
        set points = ${player.points}, wins = 0, losses = 0
        where user_id = ${sqlString(player.id)}::uuid;
      `,
    )
    .join('\n');

  runSql(`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values ${userRows}
    on conflict (id) do nothing;

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    select
      id,
      id,
      id::text,
      jsonb_build_object('sub', id::text, 'email', email),
      'email',
      now(),
      now(),
      now()
    from auth.users
    where id in (${idList})
    on conflict (provider, provider_id) do nothing;

    select set_config('matchpoint.bypass_profile_stats_guard', 'on', true);
    ${statUpdates}
  `);
}

export function insertAuthUserWithNickname(userId: string, email: string, nickname: string) {
  runSql(`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      ${sqlString(userId)}::uuid,
      'authenticated',
      'authenticated',
      ${sqlString(email)},
      crypt(${sqlString(password)}, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('name', ${sqlString(nickname)}),
      now(),
      now()
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    select
      id,
      id,
      id::text,
      jsonb_build_object('sub', id::text, 'email', email),
      'email',
      now(),
      now(),
      now()
    from auth.users
    where id = ${sqlString(userId)}::uuid
    on conflict (provider, provider_id) do nothing;
  `);
}

export function deleteTestPlayers(players: TestPlayer[]) {
  const idList = players.map((player) => sqlString(player.id)).join(',');

  runSql(`
    delete from public.matches
    where created_by in (select id from public.profiles where user_id in (${idList}))
       or id in (
        select match_id
        from public.match_players
        where profile_id in (select id from public.profiles where user_id in (${idList}))
      );

    delete from auth.users where id in (${idList});
  `);
}

export function getProfiles(players: TestPlayer[]) {
  const emails = players.map((player) => player.email);
  const rows = queryRows<TestProfile>(`
    select id, user_id, name, email, points, wins, losses
    from public.profiles
    where email in (${emails.map(sqlString).join(',')});
  `);

  return new Map(
    rows.map((profile) => [profile.email, profile]),
  );
}

export function updateTestProfileStats(
  updates: Array<{ id: string; points: number; wins: number; losses: number }>,
) {
  const statements = updates
    .map(
      (update) => `
        update public.profiles
        set points = ${update.points}, wins = ${update.wins}, losses = ${update.losses}
        where id = ${sqlString(update.id)}::uuid;
      `,
    )
    .join('\n');

  runSql(`
    select set_config('matchpoint.bypass_profile_stats_guard', 'on', true);
    ${statements}
  `);
}

export function fetchRankingProfilesByEmails(emails: string[]) {
  return queryRows<RankingProfileRow>(`
    select id, name, category, points, wins, losses, created_at, updated_at
    from public.profiles
    where email in (${emails.map(sqlString).join(',')});
  `);
}

export function createLeagueWithSql(ownerProfileId: string, memberProfileIds: string[]) {
  const rows = queryRows<{ id: string }>(`
    insert into public.leagues (owner_id, name)
    values (${sqlString(ownerProfileId)}::uuid, 'Liga teste')
    returning id;
  `);
  const leagueId = rows[0]!.id;
  const uniqueMemberIds = [...new Set([ownerProfileId, ...memberProfileIds])];
  const memberRows = uniqueMemberIds
    .map((profileId) => `(${sqlString(leagueId)}::uuid, ${sqlString(profileId)}::uuid)`)
    .join(',');

  runSql(`
    insert into public.league_players (league_id, profile_id)
    values ${memberRows}
    on conflict (league_id, profile_id) do nothing;
  `);

  return leagueId;
}

export function fetchLeaguePlayers(leagueId: string) {
  return queryRows<LeaguePlayerStatsRow>(`
    select profile_id, points, wins, losses
    from public.league_players
    where league_id = ${sqlString(leagueId)}::uuid
    order by profile_id;
  `);
}

export function registerMatchWithSql(
  creatorUserId: string,
  teamAScore: number,
  teamBScore: number,
  players: Array<{ profileId: string; team: 'A' | 'B' }>,
  leagueId?: string,
) {
  const playerJson = players
    .map(
      (player) =>
        `jsonb_build_object('profile_id', ${sqlString(player.profileId)}, 'team', ${sqlString(player.team)})`,
    )
    .join(',');

  const rows = queryRows<{ match_id: string }>(`
    select set_config('request.jwt.claim.sub', ${sqlString(creatorUserId)}, false);

    select public.register_match(
      jsonb_strip_nulls(jsonb_build_object(
        'team_a_score', ${teamAScore},
        'team_b_score', ${teamBScore},
        'players', jsonb_build_array(${playerJson}),
        'league_id', ${leagueId ? sqlString(leagueId) : 'null'}
      ))
    ) as match_id;
  `);

  return rows[0]!.match_id;
}

export function fetchMatchPlayers(matchId: string) {
  return queryRows<MatchPlayerRow>(`
    select profile_id, team, result, points_before, points_delta, points_after
    from public.match_players
    where match_id = ${sqlString(matchId)}
    order by team, profile_id;
  `);
}

export function fetchMatchLeaguePlayers(matchId: string) {
  return queryRows<MatchLeaguePlayerRow>(`
    select profile_id, league_points_before, league_points_delta, league_points_after
    from public.match_league_players
    where match_id = ${sqlString(matchId)}
    order by profile_id;
  `);
}

export function fetchProfilesByIds(profileIds: string[]) {
  return queryRows<TestProfile>(`
    select id, user_id, name, email, points, wins, losses
    from public.profiles
    where id in (${profileIds.map(sqlString).join(',')});
  `);
}

export function deleteMatchWithSql(userId: string, matchId: string) {
  runSql(`
    select set_config('request.jwt.claim.sub', ${sqlString(userId)}, false);
    select public.delete_match(${sqlString(matchId)}::uuid);
  `);
}

export function expireMatchWithSql(matchId: string) {
  runSql(`
    update public.matches
    set created_at = now() - interval '6 minutes'
    where id = ${sqlString(matchId)}::uuid;
  `);
}

export function countMatchesForProfiles(profileIds: string[]) {
  const rows = queryRows<{ count: string }>(`
    select count(*)::text
    from public.matches m
    where m.created_by in (${profileIds.map(sqlString).join(',')})
       or m.id in (
        select match_id from public.match_players
        where profile_id in (${profileIds.map(sqlString).join(',')})
       );
  `);

  return Number(rows[0]?.count ?? 0);
}

export function countMatchPlayersForProfiles(profileIds: string[]) {
  const rows = queryRows<{ count: string }>(`
    select count(*)::text
    from public.match_players
    where profile_id in (${profileIds.map(sqlString).join(',')});
  `);

  return Number(rows[0]?.count ?? 0);
}

export function deleteAuthUsersByEmail(emails: string[]) {
  if (emails.length === 0) return;

  runSql(`
    delete from auth.users
    where email in (${emails.map(sqlString).join(',')});
  `);
}

export function updateProfilePointsAsAuthenticatedUser(userId: string, profileId: string, points: number) {
  runSql(`
    select set_config('request.jwt.claim.sub', ${sqlString(userId)}, false);
    update public.profiles
    set points = ${points}
    where id = ${sqlString(profileId)}::uuid;
  `);
}
