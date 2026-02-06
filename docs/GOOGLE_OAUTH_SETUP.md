# Guia: Configurar Google OAuth para Supabase

## Pré-requisitos
- Conta Google (Gmail)
- Projeto Supabase ativo

---

## Passo 1: Acessar Google Cloud Console

1. Acesse: https://console.cloud.google.com
2. Faça login com sua conta Google

---

## Passo 2: Criar ou Selecionar Projeto

### Opção A: Criar Novo Projeto
1. Clique no seletor de projetos (topo da página)
2. Clique em "Novo Projeto"
3. Nome: `Mercado do Vale Auth`
4. Clique em "Criar"
5. Aguarde criação (pode levar alguns segundos)

### Opção B: Usar Projeto Existente
1. Selecione o projeto existente
2. Continue para o próximo passo

---

## Passo 3: Habilitar Google+ API

1. No menu lateral, vá em: **APIs e Serviços** → **Biblioteca**
2. Busque por: `Google+ API`
3. Clique em "Google+ API"
4. Clique em "Ativar"

> **Nota**: Mesmo que a Google+ tenha sido descontinuada, a API ainda é necessária para OAuth.

---

## Passo 4: Configurar Tela de Consentimento OAuth

1. No menu lateral: **APIs e Serviços** → **Tela de consentimento OAuth**
2. Selecione tipo de usuário:
   - **Externo** (para clientes públicos) ✅ Recomendado
   - Interno (apenas para Google Workspace)
3. Clique em "Criar"

### Informações do App
- **Nome do app**: `Mercado do Vale`
- **E-mail de suporte do usuário**: seu-email@gmail.com
- **Logotipo do app**: (opcional)
- **Domínio do app**: `mercadodovale.com` (ou seu domínio)
- **Links**: (opcional)
- **E-mail do desenvolvedor**: seu-email@gmail.com
4. Clique em "Salvar e continuar"

### Escopos
1. Clique em "Adicionar ou remover escopos"
2. Selecione:
   - ✅ `.../auth/userinfo.email`
   - ✅ `.../auth/userinfo.profile`
   - ✅ `openid`
3. Clique em "Atualizar"
4. Clique em "Salvar e continuar"

### Usuários de Teste (opcional)
- Adicione emails de teste se quiser testar antes de publicar
- Clique em "Salvar e continuar"

### Resumo
- Revise as informações
- Clique em "Voltar ao painel"

---

## Passo 5: Criar Credenciais OAuth 2.0

1. No menu lateral: **APIs e Serviços** → **Credenciais**
2. Clique em "Criar credenciais" → "ID do cliente OAuth"
3. Tipo de aplicativo: **Aplicativo da Web**
4. Nome: `Mercado do Vale - Supabase Auth`

### URIs de Redirecionamento Autorizados

**IMPORTANTE**: Você precisa do URL do seu projeto Supabase.

**Formato**: `https://[SEU-PROJETO-ID].supabase.co/auth/v1/callback`

**Para encontrar seu Project ID:**
1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto "Mercado do Vale News"
3. Vá em Settings → API
4. Copie o "Project URL"
5. Extraia o ID (ex: `cqbdyxxzmkgeghwkozts`)

**Adicione estas URLs:**
```
https://cqbdyxxzmkgeghwkozts.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
```

5. Clique em "Criar"

---

## Passo 6: Copiar Credenciais

Após criar, você verá uma janela com:
- **ID do cliente**: `123456789-abc.apps.googleusercontent.com`
- **Chave secreta do cliente**: `GOCSPX-abc123...`

**⚠️ IMPORTANTE**: Copie e guarde essas credenciais em local seguro!

---

## Passo 7: Configurar no Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione projeto "Mercado do Vale News"
3. Vá em: **Authentication** → **Providers**
4. Encontre "Google" na lista
5. Clique para expandir

### Configurações:
- **Enable Sign in with Google**: ✅ Ativado
- **Client ID**: Cole o ID do cliente do Google
- **Client Secret**: Cole a chave secreta do Google
- **Authorized Client IDs**: (deixe vazio)

6. Clique em "Save"

---

## Passo 8: Testar Integração

### Teste Local
```typescript
// No seu código
const { signInWithGoogle } = useAuth()

// Ao clicar no botão
await signInWithGoogle()
// Deve abrir popup do Google para login
```

### Verificar Callback
Após login bem-sucedido, o usuário será redirecionado para:
```
http://localhost:3000/auth/callback
```

---

## Troubleshooting

### Erro: "redirect_uri_mismatch"
**Solução**: Verifique se a URL de callback no Google Cloud Console está EXATAMENTE igual à do Supabase.

### Erro: "Access blocked: This app's request is invalid"
**Solução**: 
1. Verifique se a tela de consentimento OAuth está configurada
2. Adicione os escopos necessários

### Erro: "invalid_client"
**Solução**: Verifique se o Client ID e Client Secret estão corretos no Supabase.

---

## Checklist Final

- [ ] Projeto criado no Google Cloud Console
- [ ] Google+ API habilitada
- [ ] Tela de consentimento OAuth configurada
- [ ] Credenciais OAuth 2.0 criadas
- [ ] URIs de redirecionamento adicionadas
- [ ] Client ID e Secret copiados
- [ ] Configurado no Supabase
- [ ] Testado login com Google

---

## Próximo Passo

Após concluir, configure o Facebook OAuth seguindo o guia:
[`FACEBOOK_OAUTH_SETUP.md`](file:///C:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado%20do%20Vale%20New/mercado-do-vale/docs/FACEBOOK_OAUTH_SETUP.md)
