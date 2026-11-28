import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OperatorUser } from '../types/flood';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const PREVIEW_SESSION_KEY = 'lrt2_flood_preview_session';

export async function getActiveOperator(): Promise<OperatorUser | null> {
  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      return null;
    }
    const user = data.session.user;
    const usernameMeta =
      (user.user_metadata?.username as string | undefined) ||
      user.email?.split('@')[0] ||
      'Operator';
    return {
      id: user.id,
      username: usernameMeta,
      email: user.email ?? '',
      role: 'DRRMO Operator',
      mode: 'supabase',
    };
  }

  const raw = localStorage.getItem(PREVIEW_SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as OperatorUser;
  } catch {
    return null;
  }
}

export async function signInOperator(
  identifier: string,
  password: string,
): Promise<{ user: OperatorUser | null; error: string | null }> {
  const cleanId = identifier.trim();
  if (!cleanId || !password) {
    return { user: null, error: 'Enter both username/email and password.' };
  }

  if (supabase) {
    let emailToUse = cleanId;
    if (!cleanId.includes('@')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, username')
        .eq('username', cleanId)
        .maybeSingle();
      if (profile?.email) {
        emailToUse = profile.email as string;
      } else {
        emailToUse = `${cleanId.toLowerCase()}@floodmonitor.local`;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });
    if (error || !data.user) {
      const msg = error?.message ?? 'Invalid credentials.';
      if (msg.toLowerCase().includes('email not confirmed')) {
        return {
          user: null,
          error:
            'Email not confirmed yet. Check your inbox or disable "Confirm email" in Supabase → Authentication → Providers → Email.',
        };
      }
      if (msg.toLowerCase().includes('invalid login credentials')) {
        return {
          user: null,
          error:
            'Invalid email/username or password. If you have not registered yet, click "Create Account" below first.',
        };
      }
      return { user: null, error: msg };
    }

    const usernameMeta =
      (data.user.user_metadata?.username as string | undefined) ||
      cleanId.split('@')[0];

    return {
      user: {
        id: data.user.id,
        username: usernameMeta,
        email: data.user.email ?? emailToUse,
        role: 'DRRMO Operator',
        mode: 'supabase',
      },
      error: null,
    };
  }

  // Local preview auth when Supabase .env keys are not yet configured.
  if (password.length < 4) {
    return {
      user: null,
      error: 'Password must be at least 4 characters in preview mode.',
    };
  }

  const username = cleanId.includes('@') ? cleanId.split('@')[0] : cleanId;
  const previewUser: OperatorUser = {
    id: `preview-${username.toLowerCase()}`,
    username,
    email: cleanId.includes('@') ? cleanId : `${username.toLowerCase()}@lrt2.local`,
    role: 'Station Operator',
    mode: 'preview',
  };
  localStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(previewUser));
  return { user: previewUser, error: null };
}

export async function signUpOperator(
  username: string,
  email: string,
  password: string,
): Promise<{ user: OperatorUser | null; message: string | null; error: string | null }> {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim() || `${cleanUsername.toLowerCase()}@floodmonitor.local`;

  if (!cleanUsername || !password) {
    return { user: null, message: null, error: 'Username and password are required.' };
  }

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { username: cleanUsername },
      },
    });
    if (error) {
      return { user: null, message: null, error: error.message };
    }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: cleanUsername,
        email: cleanEmail,
        role: 'DRRMO Operator',
      });
    }
    if (!data.session) {
      return {
        user: null,
        message: 'Account created in Supabase. Check your email to confirm before signing in.',
        error: null,
      };
    }
    return {
      user: {
        id: data.user!.id,
        username: cleanUsername,
        email: cleanEmail,
        role: 'DRRMO Operator',
        mode: 'supabase',
      },
      message: null,
      error: null,
    };
  }

  const previewUser: OperatorUser = {
    id: `preview-${cleanUsername.toLowerCase()}`,
    username: cleanUsername,
    email: cleanEmail,
    role: 'Station Operator',
    mode: 'preview',
  };
  localStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(previewUser));
  return { user: previewUser, message: null, error: null };
}

export async function signOutOperator(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
  localStorage.removeItem(PREVIEW_SESSION_KEY);
}

export interface LiveReadingRow {
  id: number;
  station_id: string;
  raw_distance_cm: number;
  water_depth_cm: number;
  alert_level: 'GREEN' | 'ORANGE' | 'RED';
  source: string;
  recorded_at: string;
}

export async function fetchRecentReadings(
  stationId: string,
  limit = 40,
): Promise<LiveReadingRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('flood_readings')
    .select('id, station_id, raw_distance_cm, water_depth_cm, alert_level, source, recorded_at')
    .eq('station_id', stationId)
    .order('recorded_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as LiveReadingRow[]).reverse();
}

export async function fetchLatestAnyStation(): Promise<LiveReadingRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('flood_readings')
    .select('id, station_id, raw_distance_cm, water_depth_cm, alert_level, source, recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as LiveReadingRow;
}

export async function saveOperatorSnapshot(
  stationId: string,
  rawDistanceCm: number,
  waterDepthCm: number,
  alertLevel: 'GREEN' | 'ORANGE' | 'RED',
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('flood_readings').insert({
    station_id: stationId,
    raw_distance_cm: Number(rawDistanceCm.toFixed(1)),
    water_depth_cm: Number(waterDepthCm.toFixed(1)),
    alert_level: alertLevel,
    source: 'ESP32',
  });
  return !error;
}

export function subscribeToStationReadings(
  stationId: string,
  onInsert: (row: LiveReadingRow) => void,
): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`flood_readings_${stationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'flood_readings',
        filter: `station_id=eq.${stationId}`,
      },
      (payload) => {
        if (payload.new) {
          onInsert(payload.new as LiveReadingRow);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
