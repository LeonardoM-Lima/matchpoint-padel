import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import { supabaseAnonKey, supabaseUrl } from '../setup';
import {
  deleteAuthUsersByEmail,
  getProfiles,
  insertAuthUserWithNickname,
  updateProfilePointsAsAuthenticatedUser,
} from './helpers';

const createdSignupEmails: string[] = [];

function makeEmail(label: string) {
  return `${label}-${crypto.randomUUID()}@matchpoint.dev`;
}

function insertSignupFixture(label: string) {
  const userId = crypto.randomUUID();
  const email = makeEmail(label);
  const nickname = `${label}-${crypto.randomUUID().slice(0, 8)}`;
  createdSignupEmails.push(email);
  insertAuthUserWithNickname(userId, email, nickname);
  const profile = getProfiles([{ id: userId, email, name: nickname, points: 1000 }]).get(email);

  return {
    userId,
    email,
    nickname,
    profile,
  };
}

afterEach(() => {
  deleteAuthUsersByEmail(createdSignupEmails.splice(0));
});

describe('auth and RLS integration', () => {
  it('blocks unauthenticated clients from selecting matches', async () => {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await anonClient.from('matches').select('id').limit(1);

    expect(error || (data ?? []).length === 0).toBeTruthy();
  });

  it('blocks authenticated clients from updating profile points directly', async () => {
    const { userId, profile } = insertSignupFixture('auth-rls');

    expect(profile).toBeDefined();
    expect(() => updateProfilePointsAsAuthenticatedUser(userId, profile!.id, 9999)).toThrow(
      /Profile sensitive fields can only be changed by PadelUP RPCs/,
    );
  });

  it('creates a profile with default stats when a user signs up with a nickname', async () => {
    const { profile, nickname } = insertSignupFixture('signup');

    expect(profile).toEqual(
      expect.objectContaining({
        name: nickname,
        points: 1000,
        wins: 0,
        losses: 0,
      }),
    );
    expect(profile!.points >= 800 && profile!.points < 1300 ? 'Amador' : 'Outro').toBe('Amador');
  });
});
