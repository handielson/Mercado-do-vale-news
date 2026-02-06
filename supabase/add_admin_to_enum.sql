-- Verificar valores atuais do enum customer_type_enum
SELECT 
    enumlabel as allowed_values
FROM pg_enum
WHERE enumtypid = 'customer_type_enum'::regtype
ORDER BY enumsortorder;

-- Adicionar 'ADMIN' ao enum se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'ADMIN' 
        AND enumtypid = 'customer_type_enum'::regtype
    ) THEN
        ALTER TYPE customer_type_enum ADD VALUE 'ADMIN';
    END IF;
END $$;

-- Verificar novamente
SELECT 
    enumlabel as allowed_values
FROM pg_enum
WHERE enumtypid = 'customer_type_enum'::regtype
ORDER BY enumsortorder;
