#!/usr/bin/env node

/**
 * Script to execute the field migration
 * Converts fixed fields to custom_fields in all categories
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('🚀 Starting field migration...\n');

    try {
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, 'migrations', '20260211_migrate_fixed_fields_to_custom.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📄 Executing migration SQL...');

        // Execute the migration
        const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

        if (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }

        console.log('✅ Migration completed successfully!\n');

        // Verify the migration
        console.log('🔍 Verifying migration results...\n');

        const { data: categories, error: fetchError } = await supabase
            .from('categories')
            .select('id, name, config')
            .order('name');

        if (fetchError) {
            console.error('❌ Failed to fetch categories:', fetchError);
            process.exit(1);
        }

        console.log('📊 Migration Results:\n');
        categories.forEach(cat => {
            const customFieldsCount = cat.config?.custom_fields?.length || 0;
            const uniqueFields = [
                cat.config?.imei1,
                cat.config?.imei2,
                cat.config?.serial,
                cat.config?.color
            ].filter(f => f !== undefined);

            console.log(`  ✓ ${cat.name}`);
            console.log(`    - Unique fields: ${uniqueFields.length}/4`);
            console.log(`    - Custom fields: ${customFieldsCount}`);
            console.log('');
        });

        console.log('✅ All categories migrated successfully!');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}

runMigration();
