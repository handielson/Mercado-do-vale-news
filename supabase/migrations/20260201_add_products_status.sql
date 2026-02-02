-- Add missing columns to products table
-- This fixes schema cache errors for status, track_inventory, and stock_quantity

DO $$ 
BEGIN
    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE products 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'draft', 'archived'));
        
        RAISE NOTICE 'Added status column to products table';
    ELSE
        RAISE NOTICE 'Status column already exists';
    END IF;

    -- Add track_inventory column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'track_inventory'
    ) THEN
        ALTER TABLE products 
        ADD COLUMN track_inventory BOOLEAN NOT NULL DEFAULT true;
        
        RAISE NOTICE 'Added track_inventory column to products table';
    ELSE
        RAISE NOTICE 'track_inventory column already exists';
    END IF;

    -- Add stock_quantity column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'stock_quantity'
    ) THEN
        ALTER TABLE products 
        ADD COLUMN stock_quantity INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added stock_quantity column to products table';
    ELSE
        RAISE NOTICE 'stock_quantity column already exists';
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_track_inventory ON products(track_inventory);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);

-- Update existing products to have default values if null
UPDATE products SET status = 'active' WHERE status IS NULL;
UPDATE products SET track_inventory = true WHERE track_inventory IS NULL;
UPDATE products SET stock_quantity = 0 WHERE stock_quantity IS NULL;
