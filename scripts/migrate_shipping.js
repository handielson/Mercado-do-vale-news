import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
    const envConfig = dotenv.parse(readFileSync(resolve('.env.local')));

    const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase URL or Key in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    async function migrate() {
        console.log('Running migration...');
        
        // Supabase JS doesn't have a direct raw SQL execution method via the client,
        // but it does have `rpc` if we have a generic SQL executor function.
        // If not, we can just insert default row with new keys if they exist, but the table schema must be altered first.
        // Actually, without psql or an RPC that executes SQL, altering a table programmatically via Supabase JS is impossible.
        // The user must run this in their Supabase SQL Editor.
        console.log(`
Please run the following SQL commands in your Supabase SQL Editor:

ALTER TABLE public.shipping_settings 
ADD COLUMN IF NOT EXISTS enable_progressive_shipping_subsidy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_order_value_for_subsidy NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_subsidy_discount_percent NUMERIC DEFAULT 100,
ADD COLUMN IF NOT EXISTS profit_margin_percentage_cap NUMERIC DEFAULT 20;

COMMENT ON COLUMN public.shipping_settings.enable_progressive_shipping_subsidy IS 'Ativa o subsídio de frete progressivo';
COMMENT ON COLUMN public.shipping_settings.min_order_value_for_subsidy IS 'Valor mínimo do pedido em centavos para ativar o subsídio';
COMMENT ON COLUMN public.shipping_settings.default_subsidy_discount_percent IS 'Porcentagem de desconto padrão no frete ex: 100 = 100%';
COMMENT ON COLUMN public.shipping_settings.profit_margin_percentage_cap IS 'Teto da margem de lucro permitida para sacrificar no frete (0 a 100)';
        `);
    }

    migrate();
} catch (err) {
    console.error(err);
}
