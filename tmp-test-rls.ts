import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', anonKey || '');

async function run() {
    const modelId = '7dd8b65f-3aa1-4867-8be3-fc5f8aba41d6'; // Cinebox Supremo Pró model ID
    
    // Login as admin to get a session token
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'handielson@gmail.com',
        password: 'test'
    });
    console.log("Auth error:", authError?.message);
    console.log("Auth session:", authData?.session?.access_token ? "LOGGED IN" : "NOT LOGGED IN");
    
    // Check if we can update as this user
    if (authData?.session) {
        const { data, error } = await supabase
            .from('models')
            .update({ name: 'Cinebox Supremo Pró' }) // no-op update to test permissions
            .eq('id', modelId);
        console.log("Update result:", data, "Error:", error?.message);
    }
}

run().catch(console.error);
