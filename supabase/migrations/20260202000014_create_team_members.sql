-- Migration: Create team_members table
-- Description: Table for managing team members (employees, freelancers, etc.)

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Dados Pessoais
    name VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(18) UNIQUE NOT NULL,
    birth_date DATE,
    
    -- Tipo e Função
    role VARCHAR(50) NOT NULL, -- 'seller', 'delivery', 'manager', 'admin', 'stock'
    department VARCHAR(100), -- 'vendas', 'logística', 'administrativo'
    
    -- Tipo de Vínculo
    employment_type VARCHAR(50) NOT NULL, -- 'clt', 'freelancer', 'pj'
    
    -- Contato
    email VARCHAR(255),
    phone VARCHAR(20),
    
    -- Endereço (JSONB para flexibilidade)
    address JSONB,
    
    -- Informações de Trabalho
    hire_date DATE NOT NULL,
    
    -- Remuneração (varia por tipo de vínculo)
    salary DECIMAL(10,2), -- Para CLT
    hourly_rate DECIMAL(10,2), -- Para Freelancer/PJ
    commission_rate DECIMAL(5,2), -- % de comissão (vendedores)
    delivery_fee DECIMAL(10,2), -- Taxa por entrega (entregadores freelance)
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Permissões (para futuro sistema de login)
    permissions JSONB,
    
    -- Observações
    admin_notes TEXT,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX idx_team_members_role ON team_members(role);
CREATE INDEX idx_team_members_employment_type ON team_members(employment_type);
CREATE INDEX idx_team_members_is_active ON team_members(is_active);
CREATE INDEX idx_team_members_cpf_cnpj ON team_members(cpf_cnpj);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_team_members_updated_at();

-- Comentários
COMMENT ON TABLE team_members IS 'Tabela para gerenciar membros da equipe (funcionários, freelancers, etc.)';
COMMENT ON COLUMN team_members.role IS 'Função: seller, delivery, manager, admin, stock';
COMMENT ON COLUMN team_members.employment_type IS 'Tipo de vínculo: clt, freelancer, pj';
COMMENT ON COLUMN team_members.salary IS 'Salário mensal (para CLT)';
COMMENT ON COLUMN team_members.hourly_rate IS 'Valor por hora (para Freelancer/PJ)';
COMMENT ON COLUMN team_members.commission_rate IS 'Percentual de comissão (para vendedores)';
COMMENT ON COLUMN team_members.delivery_fee IS 'Taxa por entrega (para entregadores freelance)';
