-- Add admin_preview_type field to customers table
-- This allows admin users to preview the catalog as different customer types

ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS admin_preview_type TEXT CHECK (admin_preview_type IN ('retail', 'resale', 'wholesale'));

COMMENT ON COLUMN customers.admin_preview_type IS 'Customer type that admin is previewing as (retail, resale, wholesale). Only used when customer_type is ADMIN.';
