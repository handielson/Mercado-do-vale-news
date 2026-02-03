-- =====================================================
-- ATUALIZAR POLÍTICAS RLS - MODO DESENVOLVIMENTO
-- Remove políticas antigas e cria novas permitindo usuário mock
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can insert own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
DROP POLICY IF EXISTS "Users can delete own company settings" ON company_settings;

-- Criar novas políticas com suporte a usuário mock
CREATE POLICY "Users can view own company settings"
  ON company_settings
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

CREATE POLICY "Users can insert own company settings"
  ON company_settings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

CREATE POLICY "Users can update own company settings"
  ON company_settings
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );

CREATE POLICY "Users can delete own company settings"
  ON company_settings
  FOR DELETE
  USING (
    auth.uid() = user_id OR 
    user_id = '00000000-0000-0000-0000-000000000000'::uuid
  );
