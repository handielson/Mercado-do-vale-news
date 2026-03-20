-- Adiciona campo de extensão de vídeo do Synology (ex: .mp4, .webm)
-- Default .mp4 para manter compatibilidade com configurações existentes
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS synology_video_extension TEXT DEFAULT '.mp4';

COMMENT ON COLUMN company_settings.synology_video_extension IS 'Extensão dos arquivos de vídeo no Synology (ex: .mp4, .webm). Padrão: .mp4';
