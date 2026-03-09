import { createClient } from '@supabase/supabase-js';

// Load env vars
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllOrders() {
    console.log('Starting to delete test orders...');

    // Delete items first to avoid FK constraints
    const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .neq('id', 'dummy_value_to_delete_all'); // deletes all rows

    if (itemsError) {
        console.error('Error deleting order_items:', itemsError);
    } else {
        console.log('Successfully deleted all order_items.');
    }

    // Delete orders
    const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .neq('id', 'dummy_value_to_delete_all'); // deletes all rows

    if (ordersError) {
        console.error('Error deleting orders:', ordersError);
    } else {
        console.log('Successfully deleted all orders.');
    }

    console.log('Done.');
}

deleteAllOrders();
