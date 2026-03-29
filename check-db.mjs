import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function getEnv(key) {
  const content = fs.readFileSync('.env.local', 'utf-8');
  const match = content.match(new RegExp(`${key}="([^"]+)"`));
  return match ? match[1] : null;
}

const url = getEnv('VITE_SUPABASE_URL');
const serviceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, serviceKey);

async function check() {
    // 1. Check for duplicates in user_id
    const { data: duplicateUsers, error: dupErr } = await supabase.rpc('duplicate_customers_check');
    
    // Manual check instead
    const { data: allCustomers, error } = await supabase
        .from('customers')
        .select('id, name, cpf_cnpj, user_id');

    if (error) {
        console.error(error);
        return;
    }

    const userIdCounts = {};
    const cpfCounts = {};
    for (const c of allCustomers) {
        if (c.user_id) {
            userIdCounts[c.user_id] = (userIdCounts[c.user_id] || 0) + 1;
        }
        if (c.cpf_cnpj) {
            cpfCounts[c.cpf_cnpj] = (cpfCounts[c.cpf_cnpj] || 0) + 1;
        }
    }

    const dupUserIds = Object.keys(userIdCounts).filter(id => userIdCounts[id] > 1);
    console.log(`Clientes com user_id duplicado: ${dupUserIds.length}`);
    for (const id of dupUserIds) {
        const dupes = allCustomers.filter(c => c.user_id === id);
        console.log(` user_id ${id}:`, dupes.map(d => `${d.name} (${d.id})`));
    }

    const dupCpfs = Object.keys(cpfCounts).filter(cpf => cpfCounts[cpf] > 1);
    console.log(`\nCPFs duplicados: ${dupCpfs.length}`);

    // If there is any duplicate user_id, that would break SupabaseAuthContext.
}

check();
