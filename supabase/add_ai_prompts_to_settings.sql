-- Add ai_prompts column to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS ai_prompts JSONB DEFAULT '{}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN company_settings.ai_prompts IS 'Storage for AI Assistant prompts used in the admin panel';
