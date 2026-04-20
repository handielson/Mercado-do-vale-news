-- Fila persistente de compra/reposicao do dashboard operacional
CREATE TABLE IF NOT EXISTS public.purchase_queue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_key TEXT NOT NULL UNIQUE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    model TEXT NOT NULL,
    sku TEXT,
    current_stock INTEGER NOT NULL DEFAULT 0,
    last_purchase_price_cents INTEGER NOT NULL DEFAULT 0,
    last_sale_price_cents INTEGER NOT NULL DEFAULT 0,
    accumulated_quantity INTEGER NOT NULL DEFAULT 0,
    origin_channels TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'purchased', 'not_purchased', 'removed')),
    reason TEXT NOT NULL DEFAULT '',
    purchased_at TIMESTAMPTZ,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_digest_date DATE,
    last_digest_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_queue_items_status ON public.purchase_queue_items(status);
CREATE INDEX IF NOT EXISTS idx_purchase_queue_items_updated_at ON public.purchase_queue_items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_queue_items_sku ON public.purchase_queue_items(sku);

COMMENT ON TABLE public.purchase_queue_items IS 'Fila operacional persistente de compra/reposicao alimentada pelo consolidado diario de vendas.';
COMMENT ON COLUMN public.purchase_queue_items.item_key IS 'Chave unica de consolidacao por SKU ou modelo.';
COMMENT ON COLUMN public.purchase_queue_items.origin_channels IS 'Canais de venda que alimentaram a necessidade de recompra.';
COMMENT ON COLUMN public.purchase_queue_items.reason IS 'Motivo para marcar como nao comprado ou removido.';
COMMENT ON COLUMN public.purchase_queue_items.last_digest_date IS 'Ultimo dia do digest diario sincronizado para evitar duplicidade.';
COMMENT ON COLUMN public.purchase_queue_items.last_digest_quantity IS 'Quantidade consolidada do ultimo digest sincronizado.';

ALTER TABLE public.purchase_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem visualizar a fila de compra"
    ON public.purchase_queue_items
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Usuarios autenticados podem inserir a fila de compra"
    ON public.purchase_queue_items
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem atualizar a fila de compra"
    ON public.purchase_queue_items
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem remover a fila de compra"
    ON public.purchase_queue_items
    FOR DELETE
    TO authenticated
    USING (true);

DROP TRIGGER IF EXISTS set_purchase_queue_items_updated_at ON public.purchase_queue_items;
CREATE TRIGGER set_purchase_queue_items_updated_at
    BEFORE UPDATE ON public.purchase_queue_items
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
