-- ============================================================
-- SYSTEM TAGS — Motor Global de Variáveis Dinâmicas
-- Criado em: 2026-02-22
-- ============================================================

CREATE TABLE IF NOT EXISTS system_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,           -- slug da tag, ex: qtd_vendas
    label TEXT NOT NULL,                 -- nome amigável, ex: Qtd. de Vendas Hoje
    description TEXT,                    -- explicação do que retorna
    context TEXT NOT NULL DEFAULT 'scheduled',
    -- Contextos disponíveis:
    --   scheduled   → resolvida pelo cron (dados do banco em tempo real)
    --   action_sale → injetada no evento de venda (PDV)
    --   action_customer → injetada no evento de novo cliente
    --   welcome     → usada na mensagem de boas-vindas WhatsApp
    --   warranty    → usada em documentos de garantia
    --   product_name → usada no gerador de nome de produto
    --   static      → valor fixo configurável pelo admin
    resolver_type TEXT NOT NULL DEFAULT 'static',
    -- Resolver types:
    --   static              → valor fixo em resolver_config.value
    --   count_products      → conta produtos com filtros
    --   sum_products_stock  → soma estoque
    --   list_products       → lista formatada de produtos
    --   count_sales_today   → conta vendas de hoje
    --   sum_sales_today     → soma financeira de hoje (total ou lucro)
    --   date_now            → data/hora atual formatada
    --   system_injected     → injetada dinamicamente (read-only, não resolvida pelo cron)
    resolver_config JSONB DEFAULT '{}',
    preview_value TEXT DEFAULT '',       -- valor fake para preview na UI
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE system_tags ENABLE ROW LEVEL SECURITY;

-- Admin lê e escreve tudo
CREATE POLICY "Admin full access on system_tags"
    ON system_tags FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Anônimos não têm acesso (tags podem conter lógica sensível)
CREATE POLICY "No anon access on system_tags"
    ON system_tags FOR SELECT
    TO anon
    USING (false);

-- Index para buscas por name
CREATE INDEX IF NOT EXISTS idx_system_tags_name ON system_tags (name);
CREATE INDEX IF NOT EXISTS idx_system_tags_context ON system_tags (context);

-- ============================================================
-- SEED: Tags existentes no sistema (pré-cadastradas)
-- ============================================================

INSERT INTO system_tags (name, label, description, context, resolver_type, resolver_config, preview_value, sort_order) VALUES

-- GRUPO 1: Relatórios Agendados (resolvidas pelo cron-dispatcher)
('qtd_vendas',              'Qtd. de Vendas Hoje',         'Número de vendas concluídas no dia atual',                'scheduled', 'count_sales_today',  '{"status": "completed"}',                                   '15',                    1),
('faturamento',             'Faturamento do Dia',           'Soma do valor total das vendas concluídas hoje (R$)',      'scheduled', 'sum_sales_today',    '{"field": "total", "status": "completed"}',                 'R$ 18.500,00',          2),
('lucro_total',             'Lucro Total do Dia',           'Soma do lucro de todas as vendas concluídas hoje (R$)',    'scheduled', 'sum_sales_today',    '{"field": "profit", "status": "completed"}',                'R$ 3.200,00',           3),
('data',                    'Data Atual',                   'Data do momento de disparo no formato DD/MM/YYYY',        'scheduled', 'date_now',           '{"format": "date"}',                                        '22/02/2026',            4),
('estoque_celulares',       'Estoque Total de Celulares',   'Contagem de todos os celulares com estoque > 0',          'scheduled', 'count_products',     '{"category_slug": "celulares", "min_stock": 1}',            '27',                    5),
('estoque_geral_loja',      'Estoque Geral da Loja',        'Soma de todos os produtos ativos com estoque > 0',        'scheduled', 'sum_products_stock', '{"status": "active"}',                                      '450',                   6),
('estoque_lista_celulares', 'Lista de Celulares em Estoque','Lista formatada de celulares com estoque disponível',     'scheduled', 'list_products',      '{"category_slug": "celulares", "order_by": "stock_desc", "format": "• {qty}x - {name} - {color} - {ram}/{storage}", "limit": 30}', '• 15x - iPhone 14 Pro - Azul - 8GB/256GB\n• 7x - Galaxy S24 - Titânio', 7),

-- GRUPO 2: Ação de Venda / PDV (injetadas dinamicamente pelo telegramBot.ts)
('id_venda',    'ID da Venda',           'Identificador resumido da venda (8 caracteres)',     'action_sale', 'system_injected', '{}', 'H78XF9A',                     10),
('cliente',     'Nome do Cliente',       'Nome completo do comprador',                          'action_sale', 'system_injected', '{}', 'João da Silva',               11),
('telefone',    'Telefone do Cliente',   'Número de telefone do cliente',                      'action_sale', 'system_injected', '{}', '(11) 99999-0000',             12),
('produto',     'Nome do Produto',       'Nome completo do produto vendido',                   'action_sale', 'system_injected', '{}', 'iPhone 15 Pro Max 256GB',     13),
('modelo',      'Modelo do Produto',     'Modelo base (sem especificações)',                    'action_sale', 'system_injected', '{}', 'iPhone 15 Pro Max',           14),
('valor',       'Valor Total Pago',      'Valor final pago pelo cliente (R$)',                 'action_sale', 'system_injected', '{}', 'R$ 7.500,00',                 15),
('lucro',       'Lucro da Venda',        'Lucro estimado daquela venda específica (R$)',        'action_sale', 'system_injected', '{}', 'R$ 1.200,00',                 16),
('pagamento',   'Forma de Pagamento',    'Método(s) de pagamento utilizados',                  'action_sale', 'system_injected', '{}', 'Pix + Cartão 12x',            17),
('desconto',    'Desconto Aplicado',     'Valor de desconto ou cupom aplicado',                'action_sale', 'system_injected', '{}', 'R$ 150,00',                   18),
('estoque',     'Estoque do Modelo',     'Unidades restantes do modelo vendido após a venda',  'action_sale', 'system_injected', '{}', '3',                           19),

-- GRUPO 3: Ação de Novo Cliente (injetadas pelo telegramBot.ts)
('nome_cliente',     'Nome do Cliente',     'Nome completo do novo cliente',              'action_customer', 'system_injected', '{}', 'Maria Oliveira',    20),
('telefone_cliente', 'Telefone do Cliente', 'Número de telefone do novo cliente',         'action_customer', 'system_injected', '{}', '(11) 98888-7777',   21),
('tipo_cliente',     'Tipo do Cliente',     'Categoria: Varejo, Atacado ou Revenda',      'action_customer', 'system_injected', '{}', 'Atacado',           22),

-- GRUPO 4: Mensagem de Boas-Vindas WhatsApp (welcomeMessageService.ts)
('nome',  'Nome do Cliente', 'Nome completo do cliente para boas-vindas',          'welcome', 'system_injected', '{}', 'João da Silva',            30),
('cpf',   'CPF Mascarado',   'CPF com os 8 primeiros dígitos mascarados',          'welcome', 'system_injected', '{}', '***.***.**9-53',           31),
('senha', 'Senha Inicial',   '5 primeiros dígitos do CPF (senha de primeiro acesso)', 'welcome', 'system_injected', '{}', '12345',                32),
('link',  'Link do Portal',  'URL do portal do cliente',                           'welcome', 'system_injected', '{}', 'https://mv.mercadodovale.com.br/', 33),

-- GRUPO 5: Garantia (WarrantyTemplateModal.tsx)
('dias',        'Dias de Garantia', 'Número de dias de garantia do produto',   'warranty', 'system_injected', '{}', '90',            40),
('marca',       'Marca',            'Marca do produto',                         'warranty', 'system_injected', '{}', 'Apple',         41),
('data_compra', 'Data da Compra',   'Data em que o produto foi comprado',       'warranty', 'system_injected', '{}', '22/02/2026',    42),

-- GRUPO 6: Gerador de Nome de Produto (product-name-generator.ts)
('sku',          'SKU',                'Código SKU do produto',                    'product_name', 'system_injected', '{}', 'IPH15PM256BLU',  50),
('ram',          'RAM',                'Memória RAM do produto',                   'product_name', 'system_injected', '{}', '8GB',            51),
('armazenamento','Armazenamento',      'Capacidade de armazenamento',              'product_name', 'system_injected', '{}', '256GB',          52),
('cor',          'Cor',                'Cor do produto',                           'product_name', 'system_injected', '{}', 'Azul',           53),
('versao',       'Versão',             'Versão do produto',                        'product_name', 'system_injected', '{}', 'Global',         54),
('bateria',      'Saúde da Bateria',   'Percentual de saúde da bateria',           'product_name', 'system_injected', '{}', '95%',            55),
('serial',       'Número de Série',    'Serial number do produto',                 'product_name', 'system_injected', '{}', 'ABC123XYZ',      56),
('ncm',          'NCM',                'Código NCM para NF',                       'product_name', 'system_injected', '{}', '8517.12.31',     57),
('cest',         'CEST',               'Código CEST para NF',                      'product_name', 'system_injected', '{}', '21.008.00',      58),
('peso',         'Peso (kg)',           'Peso do produto em quilogramas',           'product_name', 'system_injected', '{}', '0.174',          59)

ON CONFLICT (name) DO NOTHING;
