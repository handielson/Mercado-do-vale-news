import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUnavailableMessage = 'Supabase legacy client is not configured in this environment';

function createUnavailableSupabaseClient(): SupabaseClient {
    const unavailable = () => {
        throw new Error(supabaseUnavailableMessage);
    };

    const auth = {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({
            data: {
                subscription: {
                    id: 'supabase-unavailable',
                    callback: () => undefined,
                    unsubscribe: () => undefined,
                },
            },
        }),
        signOut: async () => ({ error: null }),
        signInWithPassword: unavailable,
        signInWithOAuth: unavailable,
        signUp: unavailable,
        resetPasswordForEmail: unavailable,
        updateUser: unavailable,
        admin: new Proxy({}, { get: unavailable }),
    };

    return new Proxy(
        { auth },
        {
            get(target, prop) {
                if (prop in target) return target[prop as keyof typeof target];
                return unavailable;
            },
        }
    ) as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        global: {
            headers: {
                'X-Client-Info': 'mercado-do-vale-web'
            }
        }
    })
    : createUnavailableSupabaseClient();
