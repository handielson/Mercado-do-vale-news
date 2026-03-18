import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function run() {
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(process.env.VITE_SUPABASE_URL as string, supabaseKey as string);
    const { data: settings } = await supabase.from('company_settings').select('*').limit(1);
    
    if (!settings || settings.length === 0) {
        console.error("No company settings found!");
        return;
    }
    
    const company = settings[0];
    const token = company.bling_access_token;
    
    console.log("Fetching products to get some IDs...");
    const resProd = await fetch(`https://www.bling.com.br/Api/v3/produtos?pagina=1&limite=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const prodData = await resProd.json() as any;
    const ids = prodData.data.map((p: any) => p.id);
    
    console.log("IDs:", ids);
    
    console.log("Testing stock fetch with these IDs...");
    
    let url = `https://www.bling.com.br/Api/v3/estoques/saldos?pagina=1&limite=100`;
    const idsQuery = ids.map((id: number) => `idsProdutos[]=${id}`).join('&');
    url = `https://www.bling.com.br/Api/v3/estoques/saldos?${idsQuery}`;
    
    console.log("URL:", url);
    const stockRes = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log("Status:", stockRes.status);
    const stockData = await stockRes.json();
    console.log("Stock Data:", JSON.stringify(stockData, null, 2));
}

run().catch(console.error);
