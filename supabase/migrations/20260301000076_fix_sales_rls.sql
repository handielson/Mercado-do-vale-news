-- Migration: Habilitar RLS e criar políticas para tabelas de vendas
-- Código 42501 = new row violates row-level security policy

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados (admins do painel) podem gerenciar vendas
CREATE POLICY "Admins can manage sales"
    ON sales FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Mesma política para itens de venda
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sale_items"
    ON sale_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
