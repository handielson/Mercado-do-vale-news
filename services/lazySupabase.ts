import type { SupabaseClient } from '@supabase/supabase-js';

let supabaseClientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('./supabase').then(({ supabase }) => supabase);
  }

  return supabaseClientPromise;
}
