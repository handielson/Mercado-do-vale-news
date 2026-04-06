# Guia de Migração: Cores para Supabase

## ✅ Passos Concluídos

### 1. Código Atualizado
- ✅ `services/colors.ts` reescrito para usar Supabase
- ✅ `components/products/selectors/ColorSelect.tsx` atualizado
- ✅ Script SQL criado: `supabase-colors-migration.sql`

---

## 🔧 Próximos Passos (VOCÊ PRECISA FAZER)

### Passo 1: Executar SQL no Supabase

1. Abra o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Abra o arquivo `supabase-colors-migration.sql` (na raiz do projeto)
5. Copie todo o conteúdo
6. Cole no SQL Editor
7. Clique em **Run** (ou pressione Ctrl+Enter)

**O que o script faz:**
- Cria a tabela `colors`
- Configura RLS policies (segurança multi-tenant)
- Cria índices para performance
- Insere 12 cores padrão (Preto, Branco, Azul, etc.)
- Configura trigger para `updated_at`

### Passo 2: Verificar Criação da Tabela

No Supabase Dashboard:
1. Vá em **Table Editor**
2. Procure a tabela `colors`
3. Verifique que existem 12 cores padrão

### Passo 3: Testar no Sistema

1. Abra o sistema: http://localhost:3000/admin/products/new
2. Vá até o campo "Cores"
3. Verifique que as cores padrão aparecem
4. Teste o botão de refresh (deve funcionar)

### Passo 4: Testar Criação de Nova Cor

1. Abra em nova aba: http://localhost:3000/admin/settings/colors
2. Clique em "Nova Cor"
3. Cadastre uma cor (ex: "Turquesa", #40E0D0)
4. Volte para a aba de cadastro de produto
5. Clique no botão de refresh
6. **Resultado esperado:** A cor "Turquesa" aparece na lista

### Passo 5: Testar Multi-Computador

1. Cadastre uma cor no Computador A
2. Abra o sistema no Computador B (ou outro navegador)
3. **Resultado esperado:** A cor aparece automaticamente

---

## 🐛 Troubleshooting

### Erro: "Failed to fetch colors"

**Causa:** Tabela não foi criada ou RLS está bloqueando

**Solução:**
1. Verifique se executou o SQL no Supabase
2. Verifique se está logado no sistema
3. Verifique no console do navegador qual é o erro exato

### Cores não aparecem

**Causa:** Seed data não foi inserido

**Solução:**
Execute apenas a parte de seed data do SQL:

```sql
DO $$
DECLARE
    v_company_id UUID;
BEGIN
    SELECT id INTO v_company_id 
    FROM companies 
    WHERE slug = 'mercado-do-vale';
    
    IF v_company_id IS NOT NULL THEN
        INSERT INTO colors (company_id, name, slug, hex_code, active)
        SELECT v_company_id, name, slug, hex_code, true
        FROM (VALUES
            ('Preto', 'preto', '#000000'),
            ('Branco', 'branco', '#FFFFFF'),
            ('Azul', 'azul', '#3B82F6'),
            ('Verde', 'verde', '#10B981'),
            ('Vermelho', 'vermelho', '#EF4444'),
            ('Rosa', 'rosa', '#EC4899'),
            ('Dourado', 'dourado', '#F59E0B'),
            ('Prata', 'prata', '#9CA3AF'),
            ('Cinza', 'cinza', '#6B7280'),
            ('Roxo', 'roxo', '#8B5CF6'),
            ('Amarelo', 'amarelo', '#EAB308'),
            ('Laranja', 'laranja', '#F97316')
        ) AS default_colors(name, slug, hex_code);
    END IF;
END $$;
```

### Erro de permissão (RLS)

**Causa:** Políticas RLS muito restritivas

**Solução temporária (apenas para desenvolvimento):**
```sql
-- APENAS PARA DESENVOLVIMENTO - REMOVER EM PRODUÇÃO
DROP POLICY IF EXISTS "Users can view colors from their company" ON colors;
CREATE POLICY "Allow all to view colors" ON colors FOR SELECT USING (true);
```

---

## 📊 Mudanças Técnicas

### Antes (localStorage)
```typescript
// ❌ Dados locais, não sincronizam
let colors: Color[] = loadFromStorage();
```

### Depois (Supabase)
```typescript
// ✅ Dados online, sincronizam entre computadores
const { data, error } = await supabase
    .from('colors')
    .select('*')
    .eq('company_id', companyId);
```

---

## 🎯 Benefícios da Migração

✅ **Multi-computador:** Cores acessíveis de qualquer lugar  
✅ **Multi-tenant:** Cada empresa tem suas próprias cores  
✅ **Sincronização:** Mudanças aparecem em tempo real  
✅ **Segurança:** RLS garante isolamento de dados  
✅ **Escalável:** Suporta crescimento do sistema  
✅ **Consistente:** Mesmo padrão de brands/categories

---

## 📝 Checklist de Verificação

- [ ] SQL executado no Supabase
- [ ] Tabela `colors` criada
- [ ] 12 cores padrão inseridas
- [ ] Cores aparecem no formulário de produto
- [ ] Botão de refresh funciona
- [ ] Nova cor pode ser criada
- [ ] Nova cor aparece após refresh
- [ ] Cores aparecem em outro computador/navegador
