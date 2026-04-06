import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        acc[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
    }
    return acc;
}, {} as Record<string, string>);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

async function testInsert() {
    console.log('Testando busca de customers...');

    // Get customer
    const getCustomerRes = await fetch(`${supabaseUrl}/rest/v1/customers?select=id&limit=1`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    const customers = await getCustomerRes.json();
    if (!customers || customers.length === 0) throw new Error("No customers found");
    const customer = customers[0];

    console.log('Inserindo venda no customer:', customer.id);
    const saleData = {
        customer_id: customer.id,
        subtotal: 1000,
        discount_total: 0,
        total: 1000,
        cost_total: 500,
        profit: 500,
        payment_methods: [{ method: 'money', amount: 1000 }],
        status: 'completed'
    };

    // Insert sale
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/sales`, {
        method: 'POST',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(saleData)
    });

    const responseText = await insertRes.text();
    console.log('Status HTTP:', insertRes.status);
    console.log('Resposta do Supabase RLS:', responseText);
}

testInsert().catch(console.error);
