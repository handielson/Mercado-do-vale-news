-- Add ADMIN user type and permissions system
-- This migration:
-- 1. Updates Handielson user to ADMIN type
-- 2. Creates user_permissions table for granular access control

-- Update Handielson to ADMIN
UPDATE users 
SET client_type = 'ADMIN', updated_at = NOW()
WHERE id = '09e2a74b-b0b4-4706-b91d-c410fc2fec3b';

-- Create permissions table for future granular control
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_type TEXT NOT NULL CHECK (user_type IN ('varejo', 'revenda', 'atacado', 'admin')),
    feature_key TEXT NOT NULL,
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_type, feature_key)
);

-- Insert default permissions for ADMIN (all permissions enabled)
INSERT INTO user_permissions (user_type, feature_key, can_view, can_create, can_edit, can_delete)
VALUES 
    ('admin', 'products', true, true, true, true),
    ('admin', 'customers', true, true, true, true),
    ('admin', 'sales', true, true, true, true),
    ('admin', 'pdv', true, true, true, true),
    ('admin', 'reports', true, true, true, true),
    ('admin', 'settings', true, true, true, true),
    ('admin', 'permissions', true, true, true, true),
    ('admin', 'banners', true, true, true, true),
    ('admin', 'catalog', true, true, true, true)
ON CONFLICT (user_type, feature_key) DO NOTHING;

-- Insert default permissions for ATACADO
INSERT INTO user_permissions (user_type, feature_key, can_view, can_create, can_edit, can_delete)
VALUES 
    ('atacado', 'products', true, true, true, true),
    ('atacado', 'customers', true, true, true, true),
    ('atacado', 'sales', true, true, true, true),
    ('atacado', 'pdv', true, true, true, true),
    ('atacado', 'reports', true, false, false, false),
    ('atacado', 'settings', true, false, false, false),
    ('atacado', 'permissions', false, false, false, false),
    ('atacado', 'banners', true, true, true, true),
    ('atacado', 'catalog', true, false, false, false)
ON CONFLICT (user_type, feature_key) DO NOTHING;

-- Insert default permissions for REVENDA
INSERT INTO user_permissions (user_type, feature_key, can_view, can_create, can_edit, can_delete)
VALUES 
    ('revenda', 'products', true, false, false, false),
    ('revenda', 'customers', true, true, true, false),
    ('revenda', 'sales', true, true, false, false),
    ('revenda', 'pdv', true, true, false, false),
    ('revenda', 'reports', false, false, false, false),
    ('revenda', 'settings', false, false, false, false),
    ('revenda', 'permissions', false, false, false, false),
    ('revenda', 'banners', false, false, false, false),
    ('revenda', 'catalog', true, false, false, false)
ON CONFLICT (user_type, feature_key) DO NOTHING;

-- Insert default permissions for VAREJO
INSERT INTO user_permissions (user_type, feature_key, can_view, can_create, can_edit, can_delete)
VALUES 
    ('varejo', 'products', true, false, false, false),
    ('varejo', 'customers', false, false, false, false),
    ('varejo', 'sales', false, false, false, false),
    ('varejo', 'pdv', false, false, false, false),
    ('varejo', 'reports', false, false, false, false),
    ('varejo', 'settings', false, false, false, false),
    ('varejo', 'permissions', false, false, false, false),
    ('varejo', 'banners', false, false, false, false),
    ('varejo', 'catalog', true, false, false, false)
ON CONFLICT (user_type, feature_key) DO NOTHING;

-- Verify the update
SELECT id, name, email, client_type FROM users WHERE id = '09e2a74b-b0b4-4706-b91d-c410fc2fec3b';

-- Verify permissions table
SELECT * FROM user_permissions ORDER BY user_type, feature_key;
