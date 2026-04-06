import { supabase } from './services/supabase.js';

async function fixCatalogSectionsPolicy() {
    try {
        console.log('🔄 Corrigindo políticas RLS para catalog_sections...\n');

        // Remover política antiga
        const { error: dropError } = await supabase.rpc('exec_sql', {
            sql: 'DROP POLICY IF EXISTS catalog_sections_select_own ON catalog_sections;'
        });

        if (dropError) {
            console.log('⚠️  Não foi possível remover política antiga (pode não existir):', dropError.message);
        }

        // Criar política para usuários autenticados
        const { error: createOwnError } = await supabase.rpc('exec_sql', {
            sql: `CREATE POLICY catalog_sections_select_own 
                  ON catalog_sections FOR SELECT 
                  USING (user_id = auth.uid());`
        });

        if (createOwnError) {
            console.error('❌ Erro ao criar política para usuários autenticados:', createOwnError);
            throw createOwnError;
        }

        // Criar política pública
        const { error: createPublicError } = await supabase.rpc('exec_sql', {
            sql: `CREATE POLICY catalog_sections_select_public 
                  ON catalog_sections FOR SELECT 
                  USING (is_enabled = true);`
        });

        if (createPublicError) {
            console.error('❌ Erro ao criar política pública:', createPublicError);
            throw createPublicError;
        }

        console.log('✅ Políticas RLS atualizadas com sucesso!');
        console.log('   - Usuários autenticados: veem suas próprias seções');
        console.log('   - Visitantes: veem seções habilitadas (is_enabled = true)');

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

fixCatalogSectionsPolicy();
