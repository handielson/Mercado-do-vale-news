# Instruções de Migração Segura

## ⚠️ IMPORTANTE: Backup Primeiro!

Antes de executar qualquer migração, faça backup dos dados:

### Opção 1: Backup via Supabase Dashboard
1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/database/backups
2. Clique em "Create backup"
3. Aguarde conclusão

### Opção 2: Backup via SQL
```sql
-- Criar tabela de backup
CREATE TABLE customers_backup AS SELECT * FROM customers;
```

---

## 🚀 Executar Migração

### Passo 1: Acessar SQL Editor
1. Vá para: https://supabase.com/dashboard/project/[seu-projeto]/sql
2. Clique em "New query"

### Passo 2: Copiar e Executar SQL
1. Abra o arquivo: `supabase/migrations/20260205_add_auth_fields.sql`
2. Copie TODO o conteúdo
3. Cole no SQL Editor
4. Clique em "Run" (ou Ctrl+Enter)

### Passo 3: Verificar Execução
Você deve ver mensagens de sucesso para cada comando:
- ✅ ALTER TABLE customers ADD COLUMN user_id
- ✅ ALTER TABLE customers ADD COLUMN account_status
- ✅ CREATE INDEX...
- ✅ CREATE POLICY...

---

## ✅ Verificar Migração

### Via SQL Editor:
```sql
-- Verificar colunas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'customers' 
AND column_name IN ('user_id', 'account_status');

-- Verificar dados
SELECT 
    COUNT(*) as total,
    COUNT(user_id) as com_user_id,
    COUNT(*) FILTER (WHERE account_status = 'pending') as pendentes,
    COUNT(*) FILTER (WHERE account_status = 'active') as ativos
FROM customers;
```

### Via Script:
```bash
npm run migrate:verify
```

---

## 🔄 Rollback (Se Necessário)

Se algo der errado, execute:

```sql
-- Remover colunas
ALTER TABLE customers DROP COLUMN IF EXISTS user_id;
ALTER TABLE customers DROP COLUMN IF EXISTS account_status;

-- Remover constraints
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_user_id_unique;

-- Remover índices
DROP INDEX IF EXISTS idx_customers_user_id;
DROP INDEX IF EXISTS idx_customers_account_status;

-- Remover policies
DROP POLICY IF EXISTS "Users can view own customer data" ON customers;
DROP POLICY IF EXISTS "Users can update own customer data" ON customers;

-- Restaurar do backup (se criou)
-- DELETE FROM customers;
-- INSERT INTO customers SELECT * FROM customers_backup;
```

---

## 📊 Resultado Esperado

Após migração bem-sucedida:

**Novos campos em `customers`:**
- `user_id` (uuid, nullable) - Link com auth.users
- `account_status` ('pending' | 'active') - Status da conta

**Constraints:**
- `customers_cpf_company_unique` - CPF único por empresa
- `customers_user_id_unique` - user_id único

**Índices:**
- `idx_customers_cpf` - Busca por CPF
- `idx_customers_user_id` - Busca por user_id
- `idx_customers_account_status` - Filtro por status

**RLS Policies:**
- Usuários veem apenas seus dados
- Service role tem acesso total

---

## ⚡ Comandos Rápidos

```bash
# Verificar migração
npm run migrate:verify

# Ver logs
npm run migrate:logs
```

---

## 🆘 Problemas Comuns

### Erro: "column already exists"
**Solução**: Migração já foi aplicada. Ignore o erro.

### Erro: "permission denied"
**Solução**: Use service_role key ou execute via Dashboard.

### Erro: "constraint violation"
**Solução**: Verifique se há dados duplicados antes de aplicar constraints.

---

## ✅ Checklist Final

- [ ] Backup criado
- [ ] SQL executado sem erros
- [ ] Colunas verificadas
- [ ] Constraints criadas
- [ ] Índices criados
- [ ] RLS configurado
- [ ] Dados intactos (mesmo número de registros)
