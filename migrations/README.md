# Instruções de Migração - Nova Arquitetura de Produtos

## 📋 Ordem de Execução

Execute os scripts SQL nesta ordem exata:

### 1️⃣ Criar Estrutura (`001_new_product_architecture.sql`)

**O que faz:**
- Expande tabela `models` com colunas de especificações
- Cria tabela `model_eans` (múltiplos EANs por modelo)
- Cria tabela `model_variants` (Modelo + Versão + Cor)
- Cria tabela `model_variant_images` (galeria de imagens)
- Atualiza tabela `products` com novas referências
- Configura triggers, índices e RLS

**Como executar:**

1. Acesse o Supabase SQL Editor
2. Copie todo o conteúdo de `001_new_product_architecture.sql`
3. Cole no editor SQL
4. Clique em **Run**
5. Aguarde mensagem de sucesso

**Tempo estimado:** 30-60 segundos

---

### 2️⃣ Migrar Dados Existentes (`002_migrate_existing_data.sql`)

**O que faz:**
- Migra `template_values` para colunas em `models`
- Cria variantes automaticamente para produtos existentes
- Associa produtos às variantes criadas
- Valida integridade dos dados
- Gera relatório completo

**Como executar:**

1. Acesse o Supabase SQL Editor
2. Copie todo o conteúdo de `002_migrate_existing_data.sql`
3. Cole no editor SQL
4. Clique em **Run**
5. Leia o relatório gerado

**Tempo estimado:** 1-3 minutos (depende da quantidade de dados)

---

## ⚠️ Importante

### Antes de Executar

- ✅ Faça backup do banco de dados
- ✅ Execute em ambiente de staging primeiro
- ✅ Verifique se há produtos/modelos cadastrados

### Após Executar

- ✅ Verifique o relatório de migração
- ✅ Confira produtos sem variante (se houver)
- ✅ Configure bucket de imagens no Supabase Storage

---

## 🗂️ Configurar Supabase Storage

### Criar Bucket para Imagens

1. Acesse **Storage** no Supabase
2. Clique em **New bucket**
3. Nome: `product-images`
4. Público: **Sim** (para catálogo público)
5. Clique em **Create bucket**

### Configurar Políticas

```sql
-- Permitir leitura pública
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Permitir upload autenticado
CREATE POLICY "Authenticated upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);

-- Permitir delete autenticado
CREATE POLICY "Authenticated delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);
```

---

## 📊 Verificação Pós-Migração

### Queries de Verificação

```sql
-- 1. Verificar modelos com especificações
SELECT 
    COUNT(*) as total,
    COUNT(processor) as com_processor,
    COUNT(battery_mah) as com_bateria
FROM models;

-- 2. Verificar EANs cadastrados
SELECT 
    m.name,
    me.ean,
    me.country_code,
    me.is_primary
FROM model_eans me
JOIN models m ON m.id = me.model_id
ORDER BY m.name, me.is_primary DESC;

-- 3. Verificar variantes criadas
SELECT 
    m.name as modelo,
    v.name as versao,
    c.name as cor,
    COUNT(mvi.id) as qtd_imagens
FROM model_variants mv
JOIN models m ON m.id = mv.model_id
JOIN versions v ON v.id = mv.version_id
JOIN colors c ON c.id = mv.color_id
LEFT JOIN model_variant_images mvi ON mvi.variant_id = mv.id
GROUP BY m.name, v.name, c.name
ORDER BY m.name, v.name, c.name;

-- 4. Verificar produtos sem variante
SELECT 
    p.id,
    m.name as modelo,
    c.name as cor
FROM products p
JOIN models m ON m.id = p.model_id
LEFT JOIN colors c ON c.id = p.color_id
WHERE p.variant_id IS NULL;
```

---

## 🔄 Rollback (Se Necessário)

Se algo der errado, execute:

```sql
-- ATENÇÃO: Isso reverterá TODAS as mudanças!

-- Remover colunas adicionadas em products
ALTER TABLE products 
DROP COLUMN IF EXISTS variant_id,
DROP COLUMN IF EXISTS ean;

-- Remover tabelas criadas
DROP TABLE IF EXISTS model_variant_images CASCADE;
DROP TABLE IF EXISTS model_variants CASCADE;
DROP TABLE IF EXISTS model_eans CASCADE;

-- Remover colunas adicionadas em models
ALTER TABLE models 
DROP COLUMN IF EXISTS processor,
DROP COLUMN IF EXISTS chipset,
DROP COLUMN IF EXISTS battery_mah,
DROP COLUMN IF EXISTS display,
DROP COLUMN IF EXISTS main_camera_mpx,
DROP COLUMN IF EXISTS selfie_camera_mpx,
DROP COLUMN IF EXISTS nfc,
DROP COLUMN IF EXISTS network,
DROP COLUMN IF EXISTS resistencia,
DROP COLUMN IF EXISTS antutu,
DROP COLUMN IF EXISTS custom_specs;

-- Restaurar backup
-- (Instruções específicas do seu backup)
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do Supabase
2. Confira se todas as tabelas foram criadas
3. Execute as queries de verificação
4. Consulte o relatório de migração

---

## ✅ Checklist Final

- [ ] Backup realizado
- [ ] Migration 001 executada com sucesso
- [ ] Migration 002 executada com sucesso
- [ ] Bucket `product-images` criado
- [ ] Políticas de storage configuradas
- [ ] Queries de verificação executadas
- [ ] Nenhum produto sem variante (ou justificado)
- [ ] Relatório de migração revisado
