import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas');
    console.error('Configure VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    try {
        console.log('🚀 Executando migration: catalog_settings...\n');

        // Ler arquivo SQL
        const sqlPath = join(__dirname, '../supabase/migrations/20260207_catalog_settings.sql');
        const sql = readFileSync(sqlPath, 'utf-8');

        // Executar SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('❌ Erro ao executar migration:', error);
            process.exit(1);
        }

        console.log('✅ Migration executada com sucesso!');
        console.log('\n📋 Tabelas criadas:');
        console.log('  - catalog_settings');
        console.log('  - category_display_config');
        console.log('\n🔒 RLS Policies aplicadas');
        console.log('📊 Índices criados');
        console.log('⚡ Triggers configurados');

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

runMigration();
