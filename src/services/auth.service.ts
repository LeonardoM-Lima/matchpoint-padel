import { supabase } from '../lib/supabase';
import { AuthApiError, type Session } from '@supabase/supabase-js';

export type PlayerLevel = 'Iniciante' | 'Amador' | 'Avançado';
export type PlayerCategory = '1a' | '2a' | '3a' | '4a' | '5a' | '6a' | 'Open' | 'Iniciante';

export interface Profile {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  category: PlayerCategory | null;
  points: number;
  wins: number;
  losses: number;
  level: PlayerLevel;
  createdAt: string;
  updatedAt: string;
}

export interface SignUpResult {
  session: Session | null;
  needsEmailConfirmation: boolean;
}

interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  category: PlayerCategory | null;
  points: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

const PRODUCTION_APP_URL = 'https://evopadel.vercel.app';

function getAppRedirectUrl(path: string) {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();
  const baseUrl = (configuredUrl || PRODUCTION_APP_URL).replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

function getLevel(points: number): PlayerLevel {
  if (points < 800) return 'Iniciante';
  if (points < 1300) return 'Amador';
  return 'Avançado';
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    category: row.category,
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    level: getLevel(row.points),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.hash.replace(/^#/, ''));
}

function decodeJwtPayload(token: string): { iat?: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(window.atob(padded)) as { iat?: number };
  } catch {
    return null;
  }
}

export function getSessionIssuedInFutureDelayMs(session: Session | null) {
  if (!session?.access_token || typeof window === 'undefined') return 0;

  const payload = decodeJwtPayload(session.access_token);
  if (!payload?.iat) return 0;

  return Math.max(0, payload.iat * 1000 - Date.now() + 1500);
}

function isIssuedInFutureError(error: unknown) {
  if (!(error instanceof AuthApiError)) return false;
  const message = `${error.message} ${error.code ?? ''}`.toLowerCase();
  return error.status === 422 && (message.includes('future') || message.includes('jwt'));
}

function getCodeParam() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('code');
}

function cleanAuthParamsFromUrl() {
  if (typeof window === 'undefined') return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

export const authService = {
  async signUp(email: string, password: string, nickname: string): Promise<SignUpResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedNickname = nickname.trim();
    const emailRedirectTo = getAppRedirectUrl('/login');

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: trimmedNickname,
        },
        emailRedirectTo,
      },
    });

    if (error) throw error;
    return {
      session: data.session,
      needsEmailConfirmation: !data.session,
    };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
    return data;
  },

  async requestPasswordReset(email: string) {
    const redirectTo = getAppRedirectUrl('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });

    if (error) throw error;
  },

  async preparePasswordRecoverySession() {
    const code = getCodeParam();
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      cleanAuthParamsFromUrl();
      return data.session;
    }

    const params = getHashParams();
    const refreshToken = params.get('refresh_token');

    if (refreshToken) {
      const refreshed = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });
      if (refreshed.error) throw refreshed.error;

      cleanAuthParamsFromUrl();
      return refreshed.data.session;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async updatePassword(password: string) {
    const { data } = await supabase.auth.getSession();
    const delayMs = getSessionIssuedInFutureDelayMs(data.session);

    if (delayMs > 0 && data.session?.refresh_token) {
      const refreshed = await supabase.auth.refreshSession({
        refresh_token: data.session.refresh_token,
      });
      if (refreshed.error) throw refreshed.error;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (isIssuedInFutureError(error)) {
      const current = await supabase.auth.getSession();
      if (current.data.session?.refresh_token) {
        const refreshed = await supabase.auth.refreshSession({
          refresh_token: current.data.session.refresh_token,
        });
        if (refreshed.error) throw refreshed.error;
      }

      const retry = await supabase.auth.updateUser({ password });
      if (retry.error) throw retry.error;
      return;
    }

    if (error) throw error;
  },

  async deleteAccount() {
    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) throw error;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,user_id,name,email,avatar_url,category,points,wins,losses,created_at,updated_at')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return mapProfile(data as ProfileRow);
  },
};

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    if (error.code === 'email_address_invalid') {
      return 'Use um email real. O Supabase não aceita alguns domínios de teste, como example.com.';
    }

    if (error.code === 'user_already_exists') {
      return 'Já existe uma conta com este email.';
    }

    if (error.code === 'weak_password') {
      return 'Use uma senha mais forte.';
    }

    if (error.status === 429) {
      return 'O Supabase bloqueou novos emails de cadastro neste projeto. No provedor nativo deles, o limite padrão é 2 emails por hora por projeto. Se isso continuar, revise Auth > Rate Limits e configure SMTP próprio ou desative a confirmação de email para o MVP.';
    }
  }

  return 'Não foi possível criar sua conta.';
}
