-- Check for foreign key relationships between products and models
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS foreign_table_name
FROM
    pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
WHERE
    contype = 'f'
    AND conrelid::regclass::text = 'products'
    AND confrelid::regclass::text = 'models';

-- Check all columns in products table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
