import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from './client';

/**
 * Server-only Supabase Service Role client.
 * NEVER import this file into Client Components.
 */
export function createSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (
    !isSupabaseConfigured() ||
    !serviceKey ||
    serviceKey === 'your-supabase-service-role-secret-key'
  ) {
    return null;
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
