ALTER TABLE categories ADD COLUMN IF NOT EXISTS margin_wholesale numeric(5,2) DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS margin_reseller numeric(5,2) DEFAULT 0;