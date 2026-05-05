import { supabase } from '../lib/supabase';
import { AuthApiError } from '@supabase/supabase-js';

export type PlayerLevel = 'Iniciante' | 'Amador' | 'Avançado';

export interface Profile {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  points: number;
  wins: number;
  losses: number;
  level: PlayerLevel;
  createdAt: string;
  updatedAt: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  points: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
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
    points: row.points,
    wins: row.wins,
    losses: row.losses,
    level: getLevel(row.points),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const authService = {
  async signUp(email: string, password: string, nickname: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: nickname.trim(),
        },
      },
    });

    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,user_id,name,email,points,wins,losses,created_at,updated_at')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return mapProfile(data as ProfileRow);
  },
};

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    if (error.code === 'email_address_invalid') {
      return 'Use um email real. O Supabase nao aceita alguns dominios de teste, como example.com.';
    }

    if (error.code === 'user_already_exists') {
      return 'Ja existe uma conta com este email.';
    }

    if (error.code === 'weak_password') {
      return 'Use uma senha mais forte.';
    }

    if (error.status === 429) {
      return 'Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.';
    }
  }

  return 'Nao foi possivel criar sua conta.';
}
