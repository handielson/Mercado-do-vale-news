import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
    console.log('Credentials not found');
    process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    const { data: settings } = await supabase.from('company_settings').select('id, default_a4_header, default_thermal_header').limit(1).single();

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
