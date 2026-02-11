/**
 * Script to update custom_fields to use proper field types
 * Run this script to fix dropdown fields
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qgxwfxqmtqjxqhwxqxqx.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY'
);

async function updateFieldTypes() {
    console.log('🔧 Updating field types...\n');

    // 1. Rede Operadora (4G/5G)
    const { error: error1 } = await supabase
        .from('custom_fields')
        .update({
            field_type: 'select',
            options: ['4G', '5G', '4G/5G']
        })
        .eq('key', 'rede_operadora');

    if (error1) {
        console.error('❌ Error updating rede_operadora:', error1);
    } else {
        console.log('✅ Updated rede_operadora to select (4G/5G)');
    }

    // 2. NFC
    const { error: error2 } = await supabase
        .from('custom_fields')
        .update({
            field_type: 'select',
            options: ['Sim', 'Não']
        })
        .eq('key', 'nfc');

    if (error2) {
        console.error('❌ Error updating nfc:', error2);
    } else {
        console.log('✅ Updated nfc to select (Sim/Não)');
    }

    // 3. Resistência
    const { error: error3 } = await supabase
        .from('custom_fields')
        .update({
            field_type: 'select',
            options: ['IP67', 'IP68', 'IP69', 'Nenhuma']
        })
        .eq('key', 'resistencia');

    if (error3) {
        console.error('❌ Error updating resistencia:', error3);
    } else {
        console.log('✅ Updated resistencia to select (IP ratings)');
    }

    // 4. Versão (table_relation to versions table)
    const { error: error4 } = await supabase
        .from('custom_fields')
        .update({
            field_type: 'table_relation',
            table_config: {
                table_name: 'versions',
                value_column: 'id',
                label_column: 'name',
                order_by: 'name ASC'
            }
        })
        .eq('key', 'versao');

    if (error4) {
        console.error('❌ Error updating versao:', error4);
    } else {
        console.log('✅ Updated versao to table_relation (versions)');
    }

    // Verify changes
    console.log('\n📋 Verifying changes...\n');
    const { data, error } = await supabase
        .from('custom_fields')
        .select('key, label, field_type, options, table_config')
        .in('key', ['rede_operadora', 'nfc', 'resistencia', 'versao'])
        .order('label');

    if (error) {
        console.error('❌ Error verifying:', error);
    } else {
        console.table(data);
    }
}

updateFieldTypes().catch(console.error);
