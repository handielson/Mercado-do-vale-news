-- Add Google Analytics Measurement ID to company_settings
-- Run once in Supabase SQL Editor
ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS google_analytics_id TEXT;
