const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL="(.+?)"/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="(.+?)"/);

if (!urlMatch || !keyMatch) {
    console.error('Environment variables not found.');
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function go() {
    console.log('Testing RPC execute_sql...');
    const { data, error } = await supabase.rpc('execute_sql', { sql: "SELECT 1 as ok" });
    console.log('execute_sql result:', data, error);

    if (error && error.message.includes('Could not find the function')) {
        console.log('Function execute_sql not found. Cannot run DDL via REST easily.');
        console.log('I will have to ask the user to run the SQL in their Supabase console.');
    } else {
        console.log('We can run DDL via this RPC!');
    }
}
go();
