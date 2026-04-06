import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env manually to avoid dotenv dependency issues in this folder
const envPath = path.resolve(__dirname, '.env');
const envFile = fs.readFileSync(envPath, 'utf8');

const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
// Use Service Role Key to bypass RLS for deletes
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllOrders() {
    console.log('Starting to delete test orders using key:', supabaseKey.substring(0, 15) + '...');

    // Delete items first to avoid FK constraints
    const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .neq('id', 'dummy_value_to_delete_all');

    if (itemsError) {
        console.error('Error deleting order_items:', itemsError.message);
    } else {
        console.log('Successfully deleted all order_items.');
    }

    // Delete orders
    const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .neq('id', 'dummy_value_to_delete_all');

    if (ordersError) {
        console.error('Error deleting orders:', ordersError.message);
    } else {
        console.log('Successfully deleted all orders.');
    }

    console.log('Done.');
}

deleteAllOrders();
