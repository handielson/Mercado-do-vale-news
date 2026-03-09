import { supabase } from './src/utils/supabaseClient';

async function test() {
    const { data, error } = await supabase
        .from('cashback_settings')
        .update({ min_coins_to_redeem: 1, updated_at: new Date().toISOString() })
        .eq('id', 'YOUR_ID_HERE') // Wait, the UI uses the auth context to run.
        .select()
        .single();
    console.log(data, error);
}
test();
