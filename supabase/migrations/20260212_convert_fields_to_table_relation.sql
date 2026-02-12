-- Migration: Convert system fields to table_relation type
-- Purpose: Link fields to their respective tables for dropdown/checklist functionality
-- Date: 2026-02-12
-- 
-- This migration converts the following fields from text/number to table_relation:
-- - ram → rams table
-- - storage → storages table  
-- - color → colors table
-- - version → versions table
-- - battery_health → battery_healths table

-- ============================================
-- STEP 1: Update RAM field
-- ============================================
UPDATE custom_fields
SET 
    field_type = 'table_relation',
    table_config = jsonb_build_object(
        'table_name', 'rams',
        'value_column', 'id',
        'label_column', 'name',
        'order_by', 'name ASC'
    ),
    updated_at = NOW()
WHERE key = 'ram' AND is_system = true;

-- ============================================
-- STEP 2: Update Storage field
-- ============================================
UPDATE custom_fields
SET 
    field_type = 'table_relation',
    table_config = jsonb_build_object(
        'table_name', 'storages',
        'value_column', 'id',
        'label_column', 'name',
        'order_by', 'name ASC'
    ),
    updated_at = NOW()
WHERE key = 'storage' AND is_system = true;

-- ============================================
-- STEP 3: Update Color field
-- ============================================
UPDATE custom_fields
SET 
    field_type = 'table_relation',
    table_config = jsonb_build_object(
        'table_name', 'colors',
        'value_column', 'id',
        'label_column', 'name',
        'order_by', 'name ASC'
    ),
    updated_at = NOW()
WHERE key = 'color' AND is_system = true;

-- ============================================
-- STEP 4: Update Version field
-- ============================================
UPDATE custom_fields
SET 
    field_type = 'table_relation',
    table_config = jsonb_build_object(
        'table_name', 'versions',
        'value_column', 'id',
        'label_column', 'name',
        'order_by', 'name ASC'
    ),
    updated_at = NOW()
WHERE key = 'version' AND is_system = true;

-- ============================================
-- STEP 5: Update Battery Health field
-- ============================================
UPDATE custom_fields
SET 
    field_type = 'table_relation',
    table_config = jsonb_build_object(
        'table_name', 'battery_healths',
        'value_column', 'id',
        'label_column', 'name',
        'order_by', 'name ASC'
    ),
    updated_at = NOW()
WHERE key = 'battery_health' AND is_system = true;

-- ============================================
-- VERIFICATION: Check updated fields
-- ============================================
SELECT 
    key,
    label,
    field_type,
    table_config,
    is_system
FROM custom_fields
WHERE key IN ('ram', 'storage', 'color', 'version', 'battery_health')
ORDER BY key;

