-- Adiciona campo JSONB em Orders para armazenar dados de retorno do gateway no momento da criação da transação
-- Ex: { "qr_code": "000201...", "qr_code_base64": "iVBORw0K...", "payment_url": "https..." }

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gateway_pix_data JSONB;

-- Notificar o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
