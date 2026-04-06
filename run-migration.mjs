import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente não encontradas!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('🔄 Executando migration: fix_catalog_sections_public_access...\n');

        // Ler o arquivo SQL
        const sqlPath = join(__dirname, 'supabase', 'migrations', '20260217_fix_catalog_sections_public_access.sql');
        const sql = readFileSync(sqlPath, 'utf-8');

        // Executar via RPC (se disponível) ou diretamente
        // Como não temos acesso direto ao SQL, vamos usar o Supabase Dashboard
        console.log('📋 SQL a ser executado:');
        console.log('─'.repeat(60));
        console.log(sql);
        console.log('─'.repeat(60));
        console.log('\n⚠️  AÇÃO NECESSÁRIA:');
        console.log('1. Acesse o Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Vá em: SQL Editor');
        console.log('3. Cole e execute o SQL acima');
        console.log('\nOu execute manualmente via psql se tiver acesso ao banco.');

    } catch (error) {
        console.error('❌ Erro ao executar migration:', error);
        process.exit(1);
    }
}

runMigration();
