-- Add business_hours column to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00", "hasLunchBreak": false, "lunchStart": "12:00", "lunchEnd": "13:30" },
  "tuesday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00", "hasLunchBreak": false, "lunchStart": "12:00", "lunchEnd": "13:30" },
  "wednesday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00", "hasLunchBreak": false, "lunchStart": "12:00", "lunchEnd": "13:30" },
  "thursday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00", "hasLunchBreak": false, "lunchStart": "12:00", "lunchEnd": "13:30" },
  "friday": { "isOpen": true, "openTime": "08:00", "closeTime": "18:00", "hasLunchBreak": false, "lunchStart": "12:00", "lunchEnd": "13:30" },
  "saturday": { "isOpen": true, "openTime": "08:00", "closeTime": "12:00", "hasLunchBreak": false, "lunchStart": "12:00", "lunchEnd": "13:30" },
  "sunday": { "isOpen": false, "openTime": "08:00", "closeTime": "12:00", "hasLunchBreak": false, "lunchStart": "12:00", "lunchEnd": "13:30" }
}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN company_settings.business_hours IS 'Store schedule and business hours, including open/close status and lunch breaks per day';
