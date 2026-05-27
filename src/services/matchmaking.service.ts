import { supabase } from '../lib/supabase';

export interface MatchmakingAvailability {
  profileId: string;
  whatsappNumber: string;
  availableUntil: string;
  isActive: boolean;
}

interface AvailabilityRow {
  profile_id: string;
  whatsapp_number: string;
  available_until: string;
}

const availabilityHours = 8;

function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function validateWhatsappNumber(value: string) {
  const normalized = normalizeWhatsappNumber(value);

  if (!/^55\d{10,11}$/.test(normalized)) {
    throw new Error('Informe um WhatsApp com DDD. Exemplo: (11) 99999-9999.');
  }

  return normalized;
}

function mapAvailability(row: AvailabilityRow): MatchmakingAvailability {
  const availableUntilDate = new Date(row.available_until);

  return {
    profileId: row.profile_id,
    whatsappNumber: row.whatsapp_number,
    availableUntil: row.available_until,
    isActive: availableUntilDate.getTime() > Date.now(),
  };
}

export const matchmakingService = {
  normalizeWhatsappNumber,
  validateWhatsappNumber,

  async getMyAvailability(profileId: string): Promise<MatchmakingAvailability | null> {
    const { data, error } = await supabase
      .from('matchmaking_availability')
      .select('profile_id,whatsapp_number,available_until')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapAvailability(data as AvailabilityRow);
  },

  async activate(profileId: string, whatsappNumber: string): Promise<MatchmakingAvailability> {
    const normalizedWhatsapp = validateWhatsappNumber(whatsappNumber);
    const availableUntil = new Date(Date.now() + availabilityHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('matchmaking_availability')
      .upsert(
        {
          profile_id: profileId,
          whatsapp_number: normalizedWhatsapp,
          available_until: availableUntil,
        },
        { onConflict: 'profile_id' },
      )
      .select('profile_id,whatsapp_number,available_until')
      .single();

    if (error) throw error;
    return mapAvailability(data as AvailabilityRow);
  },

  async deactivate(profileId: string) {
    const { error } = await supabase
      .from('matchmaking_availability')
      .delete()
      .eq('profile_id', profileId);

    if (error) throw error;
  },
};
