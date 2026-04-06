import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function check() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl || '', supabaseKey || '');

    const companyId = '75d8fa20-22c6-43ba-9865-c3fdb1e113be'; // We need the correct company ID... Wait, brandService uses a dynamic slug. Let's see what company id is.
    const { data: c } = await supabase.from('companies').select('id').eq('slug', 'mercado-do-vale').single();
    
    // Attempt brand creation manually
    const input = { name: "CineboxTest", warranty_days: 90, active: true };
    function generateSlug(name: string): string {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    const slug = generateSlug(input.name);
    
    const { data, error } = await supabase
        .from('brands')
        .insert({
            company_id: c.id,
            name: input.name,
            slug,
            warranty_days: input.warranty_days || 90,
            active: input.active !== undefined ? input.active : true
        })
        .select()
        .single();
    console.log("BRANDS INSERT RETURN:", data, error);
}

check().catch(console.error);
