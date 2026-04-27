# Verificação de Variáveis de Ambiente - Produção vs Desenvolvimento

## Variáveis Necessárias no Vercel

As seguintes variáveis de ambiente DEVEM estar configuradas no Vercel:

### 1. VITE_SUPABASE_URL
- **Valor**: `https://cqbdyxxzmkgeghwkozts.supabase.co`
- **Obrigatório**: SIM
- **Descrição**: URL do projeto Supabase

### 2. VITE_SUPABASE_ANON_KEY
- **Valor**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYmR5eHh6bWtnZWdod2tvenRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MDczOTYsImV4cCI6MjA4NTQ4MzM5Nn0.fqbVtqM6x-BuHbREQqXXJpX_T5l4z1Exw_4DEgPr3nU`
- **Obrigatório**: SIM
- **Descrição**: Chave anônima do Supabase

### 3. VITE_DEV_MODE
- **Valor**: `false`
- **Obrigatório**: NÃO (mas recomendado)
- **Descrição**: Modo de desenvolvimento (deve ser false em produção)

### 4. VITE_COMPANY_ID
- **Valor**: `9717131e-7b14-4aec-84a4-4317c0489985`
- **Obrigatório**: NÃO (mas FORTEMENTE recomendado em produção)
- **Descrição**: UUID fixo da empresa "Mercado do Vale". Quando definido, evita o lookup
  `/companies?slug=eq.mercado-do-vale` em cada service (centralizado em
  `services/companyContext.ts`). Sem essa variável o app cai em fallback (lookup por
  slug + cache global em memória) e funciona normalmente.
- **Impacto**: ~3 chamadas Supabase a menos no carregamento inicial (–300 a 600 ms de LCP).

## Como Configurar no Vercel

1. Acesse: https://vercel.com/dashboard
2. Vá no projeto "mercado-do-vale-news"
3. Clique em "Settings" → "Environment Variables"
4. Adicione cada variável acima
5. Marque "Production", "Preview", e "Development"
6. Clique em "Save"
7. Faça "Redeploy" do último commit

## Diagnóstico

Se as variáveis não estiverem configuradas, o Supabase client será criado com `undefined` e causará AbortError.

Execute este script no console do navegador em produção para verificar:

```javascript
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'UNDEFINED');
```

Se aparecer `undefined`, as variáveis não estão configuradas no Vercel!
