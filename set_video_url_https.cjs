require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
    const { data: companyIdData } = await supabase.from('company_settings').select('id').limit(1).single();
    if (companyIdData) {
        const { error } = await supabase.from('company_settings').update({ synology_video_base_url: 'https://mdvvideos.i234.me/videos/' }).eq('id', companyIdData.id);
        if (error) {
            console.error('Error updating company setting:', error);
        } else {
            console.log('Company setting updated to https://mdvvideos.i234.me/videos/');
        }
    }
}
main();
