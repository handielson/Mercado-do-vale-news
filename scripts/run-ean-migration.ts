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
        console.log('🚀 Executando migration: add_model_eans...\n');

        // Ler arquivo SQL
        const sqlPath = join(__dirname, '../supabase/migrations/20260211_add_model_eans.sql');
        const sql = readFileSync(sqlPath, 'utf-8');

        console.log('📄 SQL a ser executado:');
        console.log(sql);
        console.log('\n');

        // Executar SQL diretamente (sem RPC)
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('❌ Erro ao executar migration:', error);

            // Tentar executar diretamente via query
            console.log('\n🔄 Tentando executar via query direta...');
            const lines = sql.split(';').filter(line => line.trim());

            for (const line of lines) {
                if (line.trim()) {
                    const { error: queryError } = await supabase.from('_sql').select(line);
                    if (queryError) {
                        console.error('❌ Erro na linha:', line);
                        console.error(queryError);
                    }
                }
            }

            process.exit(1);
        }

        console.log('✅ Migration executada com sucesso!');
        console.log('\n📋 Alterações aplicadas:');
        console.log('  - Coluna "eans" adicionada à tabela "models"');
        console.log('  - Tipo: text[] (array de strings)');
        console.log('  - Índice GIN criado para buscas rápidas');

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

runMigration();
