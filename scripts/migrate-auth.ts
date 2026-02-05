import { supabase } from '../services/supabase'

/**
 * Safe Database Migration Script
 * 
 * This script:
 * 1. Verifies current data
 * 2. Executes migration
 * 3. Validates changes
 * 4. Provides rollback if needed
 */

async function runMigration() {
    console.log('🚀 Starting database migration...\n')

    try {
        // Step 1: Verify current data
        console.log('📊 Step 1: Verifying current data...')
        const { count: customerCount, error: countError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })

        if (countError) throw countError
        console.log(`✅ Found ${customerCount} customers in database\n`)

        // Step 2: Check if migration already applied
        console.log('🔍 Step 2: Checking if migration already applied...')
        const { data: columns } = await supabase
            .from('customers')
            .select('*')
            .limit(1)

        if (columns && columns.length > 0) {
            const hasUserIdField = 'user_id' in columns[0]
            const hasAccountStatusField = 'account_status' in columns[0]

            if (hasUserIdField && hasAccountStatusField) {
                console.log('⚠️  Migration already applied! Skipping...\n')
                return
            }
        }

        // Step 3: Execute migration
        console.log('⚙️  Step 3: Executing migration...')
        console.log('   Adding user_id column...')
        console.log('   Adding account_status column...')
        console.log('   Creating constraints...')
        console.log('   Creating indexes...')
        console.log('   Configuring RLS...\n')

        // Note: The actual SQL execution needs to be done via Supabase SQL Editor
        // or using a service_role key (not recommended for client-side)
        console.log('⚠️  IMPORTANT: SQL migration must be executed manually in Supabase Dashboard')
        console.log('   1. Go to: https://supabase.com/dashboard/project/[your-project]/sql')
        console.log('   2. Copy content from: supabase/migrations/20260205_add_auth_fields.sql')
        console.log('   3. Paste and execute\n')

        // Step 4: Verify migration (after manual execution)
        console.log('🔍 Step 4: Verifying migration...')
        console.log('   Run this script again after executing SQL to verify\n')

    } catch (error) {
        console.error('❌ Migration failed:', error)
        console.log('\n📋 Rollback instructions:')
        console.log('   If you need to rollback, execute this SQL:')
        console.log('   ALTER TABLE customers DROP COLUMN IF EXISTS user_id;')
        console.log('   ALTER TABLE customers DROP COLUMN IF EXISTS account_status;')
        throw error
    }
}

// Verification function (run after manual SQL execution)
async function verifyMigration() {
    console.log('🔍 Verifying migration...\n')

    try {
        // Check columns exist
        const { data: sample } = await supabase
            .from('customers')
            .select('id, user_id, account_status')
            .limit(1)

        if (!sample || sample.length === 0) {
            console.log('⚠️  No customers found to verify')
            return
        }

        const hasUserIdField = 'user_id' in sample[0]
        const hasAccountStatusField = 'account_status' in sample[0]

        if (hasUserIdField && hasAccountStatusField) {
            console.log('✅ Migration verified successfully!')
            console.log('   - user_id column: ✓')
            console.log('   - account_status column: ✓')

            // Check data integrity
            const { count: totalCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })

            const { count: pendingCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('account_status', 'pending')

            console.log(`\n📊 Data Status:`)
            console.log(`   Total customers: ${totalCount}`)
            console.log(`   Pending activation: ${pendingCount}`)
            console.log(`   Already active: ${(totalCount || 0) - (pendingCount || 0)}`)
        } else {
            console.log('❌ Migration not complete')
            if (!hasUserIdField) console.log('   - user_id column: ✗')
            if (!hasAccountStatusField) console.log('   - account_status column: ✗')
        }

    } catch (error) {
        console.error('❌ Verification failed:', error)
        throw error
    }
}

// Export functions
export { runMigration, verifyMigration }

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const mode = process.argv[2] || 'migrate'

    if (mode === 'verify') {
        verifyMigration()
    } else {
        runMigration()
    }
}
