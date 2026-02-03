# Guia de Execução: Sistema de Documentos da Empresa

## 📋 Pré-requisitos

Antes de testar o sistema, você precisa executar os scripts SQL no Supabase.

---

## 🗄️ Passo 1: Criar Bucket no Supabase Storage

1. Acesse o **Supabase Dashboard**
2. Vá em **Storage** → **Create a new bucket**
3. Configure:
   - **Name:** `company-documents`
   - **Public:** ❌ false (privado)
   - **File size limit:** 10MB
   - **Allowed MIME types:** `application/pdf`
4. Clique em **Create bucket**

---

## 🔧 Passo 2: Executar Scripts SQL

### Script 1: Criar Tabela de Documentos

**Arquivo:** `supabase/company_documents.sql`

1. Abra o **SQL Editor** no Supabase
2. Cole o conteúdo do arquivo `company_documents.sql`
3. Clique em **Run**
4. Verifique se a tabela foi criada em **Table Editor**

### Script 2: Configurar Políticas de Storage

**Arquivo:** `supabase/storage_policies.sql`

1. Abra o **SQL Editor** no Supabase
2. Cole o conteúdo do arquivo `storage_policies.sql`
3. Clique em **Run**
4. Verifique as políticas em **Storage** → **Policies**

---

## ✅ Passo 3: Testar no Navegador

1. Acesse: `http://localhost:3001/admin/settings/company`
2. Role até a seção **"Documentos da Empresa"**
3. Teste o upload:
   - Digite um nome (ex: "Alvará de Funcionamento")
   - Selecione um arquivo PDF (máx. 10MB)
   - Clique em "Enviar Documento"
4. Verifique se o documento aparece na grade
5. Teste abrir o documento (botão "Abrir")
6. Teste excluir o documento (botão 🗑️)

---

## 🎯 Funcionalidades Implementadas

✅ Upload de até 20 documentos PDF  
✅ Nome personalizado para cada documento  
✅ Validação de tamanho (máx. 10MB)  
✅ Validação de tipo (apenas PDF)  
✅ Armazenamento seguro no Supabase Storage  
✅ Visualização em grade compacta  
✅ Download/Impressão com um clique  
✅ Exclusão de documentos  
✅ RLS habilitado (segurança por usuário)  
✅ Contador de documentos (X/20)  
✅ Loading states e feedback visual  

---

## 📁 Arquivos Criados

### Backend/Database
- `supabase/company_documents.sql` - Schema da tabela
- `supabase/storage_policies.sql` - Políticas de Storage

### Types
- `types/document.ts` - Tipos TypeScript

### Services
- `services/documentService.ts` - Lógica de negócio

### Components
- `components/DocumentUploader.tsx` - Upload de documentos
- `components/DocumentList.tsx` - Listagem de documentos

### Pages (Modificado)
- `pages/admin/settings/CompanyDataPage.tsx` - Integração

---

## 🐛 Troubleshooting

### Erro: "Bucket not found"
**Solução:** Certifique-se de criar o bucket `company-documents` no Supabase Storage

### Erro: "Permission denied"
**Solução:** Execute o script `storage_policies.sql` para configurar as políticas RLS

### Erro: "File too large"
**Solução:** O limite é 10MB. Reduza o tamanho do PDF

### Erro: "Invalid file type"
**Solução:** Apenas arquivos PDF são permitidos

### Documentos não aparecem
**Solução:** Verifique o console do navegador para erros. Certifique-se de que as políticas RLS estão configuradas corretamente

---

## 📊 Estrutura de Dados

### Tabela: `company_documents`
```
id                UUID (PK)
user_id           UUID (FK → auth.users)
company_id        UUID (FK → company_settings)
document_name     TEXT
file_name         TEXT
file_path         TEXT (UNIQUE)
file_size         INTEGER
mime_type         TEXT
uploaded_at       TIMESTAMP
updated_at        TIMESTAMP
```

### Storage: `company-documents`
```
Estrutura: {user_id}/{timestamp}.pdf
Exemplo: 550e8400-e29b-41d4-a716-446655440000/1738594800000.pdf
```

---

## 🔒 Segurança

- ✅ Row Level Security (RLS) habilitado
- ✅ Políticas por usuário (cada usuário vê apenas seus documentos)
- ✅ Validação de tipo de arquivo
- ✅ Limite de tamanho (10MB)
- ✅ URLs assinadas com expiração (1 hora)
- ✅ Autenticação obrigatória em todas as operações

---

## 🚀 Próximos Passos (Opcional)

1. **Categorização:** Adicionar campo `category` (Fiscal, Trabalhista, etc.)
2. **Vencimento:** Campo `expiry_date` com notificações
3. **Histórico:** Manter versões antigas dos documentos
4. **Compartilhamento:** Gerar links públicos temporários
5. **Busca:** Filtrar documentos por nome ou categoria
