-- Add business_hours column to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00" },
  "tuesday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00" },
  "wednesday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00" },
  "thursday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00" },
  "friday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00" },
  "saturday": { "isOpen": true, "openTime": "08:00", "closeTime": "12:00" },
  "sunday": { "isOpen": false, "openTime": "08:00", "closeTime": "12:00" }
}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN company_settings.business_hours IS 'Store schedule and business hours, including open/close status per day';
