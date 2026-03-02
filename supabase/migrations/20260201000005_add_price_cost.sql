-- Add price_cost column to products table if it doesn't exist
DO $$ 
BEGIN
    -- Check if price_cost column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'price_cost'
    ) THEN
        -- Add price_cost column
        ALTER TABLE products 
        ADD COLUMN price_cost INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added price_cost column to products table';
    ELSE
        RAISE NOTICE 'price_cost column already exists';
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_price_cost ON products(price_cost);

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name = 'price_cost';
