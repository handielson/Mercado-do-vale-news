-- =====================================================
-- FIX: Permitir acesso público às seções habilitadas do catálogo
-- =====================================================
-- Problema: Visitantes não autenticados não conseguem ver as seções
-- do catálogo (Mais Recentes, Mais Vendidos) porque a política RLS
-- exige que user_id = auth.uid(), que é NULL para visitantes.
--
-- Solução: Adicionar uma política que permite leitura pública de
-- seções habilitadas (is_enabled = true)
-- =====================================================

-- Remover a política antiga que bloqueia acesso público
DROP POLICY IF EXISTS catalog_sections_select_own ON catalog_sections;

-- Criar nova política: Usuários autenticados veem suas próprias seções
CREATE POLICY catalog_sections_select_own 
ON catalog_sections FOR SELECT 
USING (user_id = auth.uid());

-- Criar nova política: Todos (incluindo visitantes) podem ver seções habilitadas
CREATE POLICY catalog_sections_select_public 
ON catalog_sections FOR SELECT 
USING (is_enabled = true);

-- Comentário
COMMENT ON POLICY catalog_sections_select_public ON catalog_sections IS 
'Permite que visitantes não autenticados vejam seções habilitadas do catálogo';
