ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS synology_video_base_url TEXT;

COMMENT ON COLUMN company_settings.synology_video_base_url IS 'Base URL for Synology hosted product videos matched by SKU (e.g. http://192.168.1.X/videos/)';
