import { createClient } from '@supabase/supabase-js';

// We need to simulate the environment or query the DB to see what is happening.
// Since we can't easily import TS files outside of Vite without transpilation,
// I'll directly query the DB to check the settings.

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'dummy';

async function check() {
    // Read from PostgreSQL instead of through TS to see raw values
    const { execSync } = require('child_process');
    try {
        const result = execSync('psql -U postgres -d postgres -p 5432 -h localhost -c "SELECT origin_cep, melhor_envio_enabled, melhor_envio_sandbox, melhor_envio_token, melhor_envio_allowed_services FROM shipping_settings LIMIT 1;" -x', { encoding: 'utf-8' });
        console.log("DB SETTINGS:\n", result);

        const zones = execSync('psql -U postgres -d postgres -p 5432 -h localhost -c "SELECT name, type, cep_ranges, fixed_price FROM shipping_zones;" -x', { encoding: 'utf-8' });
        console.log("ZONES:\n", zones);
    } catch (e) {
        console.error(e.message);
    }
}

check();
