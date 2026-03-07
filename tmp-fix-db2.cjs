const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Credentials not found in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    const { data: settings, error: fetchErr } = await supabase
        .from('company_settings')
        .select('id, default_a4_header, default_thermal_header')
        .limit(1)
        .single();

    if (fetchErr) {
        console.error('Error fetching settings:', fetchErr);
        return;
    }

    if (!settings) {
        console.log('Settings not found');
        return;
    }

    console.log("OLD A4:\n", (settings.default_a4_header || '').substring(0, 150));

    let newA4 = (settings.default_a4_header || '');
    if (newA4.includes('<img src=\"{{logo}}\"')) {
        // Escape string replace issues and ensure replacing the full tag with {{logo}}
        newA4 = newA4.replace(/<img src="\{\{logo\}\}"[^>]*>/gi, '{{logo}}');
    }

    let newThermal = (settings.default_thermal_header || '');
    if (newThermal.includes('<img src=\"{{logo}}\"')) {
        newThermal = newThermal.replace(/<img src="\{\{logo\}\}"[^>]*>/gi, '{{logo}}');
    }

    const { error } = await supabase
        .from('company_settings')
        .update({
            default_a4_header: newA4,
            default_thermal_header: newThermal
        })
        .eq('id', settings.id);

    if (error) console.error('Error updating:', error);
    else console.log('Successfully fixed database templates!');
}

fix();
