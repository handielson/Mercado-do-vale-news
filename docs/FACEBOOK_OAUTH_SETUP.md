# Guia: Configurar Facebook OAuth para Supabase

## Pré-requisitos
- Conta Facebook
- Projeto Supabase ativo

---

## Passo 1: Acessar Facebook Developers

1. Acesse: https://developers.facebook.com
2. Faça login com sua conta Facebook
3. Clique em "Meus Apps" (canto superior direito)

---

## Passo 2: Criar Novo App

1. Clique em "Criar App"
2. Selecione tipo: **Consumidor** (para login de clientes)
3. Clique em "Avançar"

### Informações do App
- **Nome de exibição do app**: `Mercado do Vale`
- **E-mail de contato do app**: seu-email@gmail.com
- **Finalidade comercial**: Selecione "Você mesmo ou sua própria empresa"

4. Clique em "Criar app"
5. Complete a verificação de segurança (se solicitado)

---

## Passo 3: Adicionar Produto "Facebook Login"

1. No painel do app, encontre "Facebook Login"
2. Clique em "Configurar"
3. Selecione plataforma: **Web**
4. URL do site: `https://mercadodovale.com` (ou seu domínio)
5. Clique em "Salvar"
6. Clique em "Continuar" até finalizar o assistente

---

## Passo 4: Configurar Facebook Login

1. No menu lateral: **Produtos** → **Facebook Login** → **Configurações**

### URIs de Redirecionamento OAuth Válidos

**IMPORTANTE**: Adicione as URLs de callback do Supabase.

**Formato**: `https://[SEU-PROJETO-ID].supabase.co/auth/v1/callback`

**Adicione estas URLs** (uma por linha):
```
https://cqbdyxxzmkgeghwkozts.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

### Outras Configurações
- **Login com o SDK do JavaScript**: ✅ Sim
- **Login da Web com o SDK do JavaScript**: ✅ Sim
- **Forçar reautenticação na Web OAuth**: ❌ Não
- **Login incorporado no OAuth**: ❌ Não
- **Usar autenticação estrita para redirecionamentos**: ✅ Sim

2. Clique em "Salvar alterações"

---

## Passo 5: Obter Credenciais do App

1. No menu lateral: **Configurações** → **Básico**

Você verá:
- **ID do Aplicativo**: `123456789012345`
- **Chave Secreta do Aplicativo**: Clique em "Mostrar" para revelar

**⚠️ IMPORTANTE**: Copie e guarde essas credenciais!

---

## Passo 6: Configurar Domínios do App

Ainda em **Configurações** → **Básico**:

1. Role até "Domínios do App"
2. Adicione:
   ```
   mercadodovale.com
   localhost
   ```
3. Clique em "Salvar alterações"

---

## Passo 7: Adicionar URL de Política de Privacidade

**Obrigatório para apps públicos!**

1. Em **Configurações** → **Básico**
2. Role até "URL da Política de Privacidade"
3. Adicione: `https://mercadodovale.com/privacidade`
4. (Você precisará criar esta página)
5. Clique em "Salvar alterações"

---

## Passo 8: Configurar no Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione projeto "Mercado do Vale News"
3. Vá em: **Authentication** → **Providers**
4. Encontre "Facebook" na lista
5. Clique para expandir

### Configurações:
- **Enable Sign in with Facebook**: ✅ Ativado
- **Facebook client ID**: Cole o ID do Aplicativo
- **Facebook client secret**: Cole a Chave Secreta

6. Clique em "Save"

---

## Passo 9: Tornar App Público (Produção)

**⚠️ Apenas faça isso quando estiver pronto para produção!**

1. No topo do painel do Facebook Developers
2. Mude de "Desenvolvimento" para "Ativo"
3. Você precisará:
   - ✅ Política de Privacidade configurada
   - ✅ Categoria do app selecionada
   - ✅ Ícone do app (1024x1024px)
   - ✅ Verificação de domínio (para produção)

---

## Passo 10: Testar Integração

### Teste Local (Modo Desenvolvimento)

```typescript
// No seu código
const { signInWithFacebook } = useAuth()

// Ao clicar no botão
await signInWithFacebook()
// Deve abrir popup do Facebook para login
```

**Nota**: No modo desenvolvimento, apenas você (admin do app) e usuários de teste podem fazer login.

### Adicionar Usuários de Teste

1. No menu lateral: **Funções** → **Testadores**
2. Clique em "Adicionar testadores"
3. Digite o nome ou email do Facebook
4. Envie convite
5. O usuário precisa aceitar em: https://developers.facebook.com/apps/invites

---

## Troubleshooting

### Erro: "URL Blocked: This redirect failed"
**Solução**: Verifique se a URL de callback está nas "URIs de Redirecionamento OAuth Válidos".

### Erro: "App Not Setup: This app is still in development mode"
**Solução**: 
- Para testes: Adicione usuários como testadores
- Para produção: Torne o app público

### Erro: "Can't Load URL: The domain of this URL isn't included in the app's domains"
**Solução**: Adicione o domínio em "Domínios do App".

### Erro: "invalid_client"
**Solução**: Verifique se o App ID e App Secret estão corretos no Supabase.

---

## Permissões Solicitadas

Por padrão, o Facebook Login solicita:
- ✅ `email` - Email do usuário
- ✅ `public_profile` - Nome, foto, etc.

**Não é necessário solicitar permissões adicionais** para login básico.

---

## Checklist Final

- [ ] App criado no Facebook Developers
- [ ] Facebook Login adicionado
- [ ] URIs de redirecionamento configuradas
- [ ] App ID e App Secret copiados
- [ ] Domínios do app adicionados
- [ ] Política de privacidade configurada
- [ ] Configurado no Supabase
- [ ] Testadores adicionados (para testes)
- [ ] Testado login com Facebook

---

## Próximo Passo

Após concluir Google e Facebook OAuth, continue para:
**Fase 3**: Implementar páginas de autenticação (`/login`, `/cadastro`, etc.)
