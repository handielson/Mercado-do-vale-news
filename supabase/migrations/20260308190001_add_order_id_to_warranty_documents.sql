-- Fase 1B: Vincular documento de garantia a pedido online
-- Anteriormente só existia sale_id (PDV). Agora também suporta order_id (pedidos online)

ALTER TABLE warranty_documents
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_warranty_docs_order_id
  ON warranty_documents(order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON COLUMN warranty_documents.order_id IS
  'Referência ao pedido online (orders.id) quando a garantia foi contratada pelo e-commerce';
