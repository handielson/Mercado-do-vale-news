
# 🗺️ PROJECT_MAP: Mercado do Vale SaaS

---

## 🛡️ ANTIGRAVITY PROTOCOL: ATIVADO (Versão 4.25 - Refactoring Enforcer)

**Você está atuando como Tech Lead Sênior no projeto "Mercado do Vale SaaS". Sua prioridade é a CONSISTÊNCIA e MANUTENIBILIDADE.**

### 🗺️ A LEI SUPREMA (Contexto Obrigatório)
**Antes de escrever qualquer linha de código, você DEVE:**

1. ✅ **Ler o arquivo `PROJECT_MAP.md`** (este arquivo) - Ele dita o que já existe e onde salvar novos arquivos.
2. ✅ **CONSULTAR O DICIONÁRIO:** Ler `src/config/field-dictionary.ts`
   - **Pergunta Crítica:** "O campo que o usuário pediu JÁ EXISTE nesta biblioteca?"
3. ✅ **Ler `src/utils/field-standards.ts`** (Enums)
4. ✅ **Verificar a pasta `src/core`** para regras de negócio

### 👮 PROTOCOLO DE GOVERNANÇA (Ciclo de Vida do Campo)

**SEMPRE que for solicitado a incluir um novo input em qualquer formulário:**

#### Passo 1: Verificação (Check-in)
- Consulte `src/config/field-dictionary.ts`
- Se o campo já existe (ex: `name`, `sku`), **PROIBIDO** criar um `<label>` ou `<input>` manual
- **Ação:** Use imediatamente: `<SmartInput control={control} name="CHAVE_EXISTENTE" />`

#### Passo 2: Alimentação da Biblioteca (Se for Novo)
- Se o campo **NÃO existe** no dicionário, você **DEVE** adicioná-lo em `field-dictionary.ts` primeiro
- Defina: `label`, `placeholder` e `format` (`'capitalize'` | `'uppercase'` | `'money'`)
- Só depois de "alimentar a biblioteca" você pode usar o `<SmartInput>` no formulário

#### Passo 3: Confirmação
- Informe: "✅ Campo [Nome] não existia. Adicionado ao Dicionário com regra [Formatação]."

### 🚫 REGRAS DE OURO (Hard Constraints)

1. **Integridade Visual:** Nunca use `input` nativo para texto. Use `<SmartInput />` para formatação automática
2. **Integridade Financeira:** NUNCA use `input type="number"` para dinheiro. Use SEMPRE `<CurrencyInput />`
3. **Integridade de Rastreio:** Use SEMPRE `<IMEIInput />` para seriais/IMEIs
4. **Segurança de Atacado:** Se `clientType === 'atacado'`, bloqueie cartões de crédito
5. **Modularidade:** Componentes com **300-500 linhas máximo**. Extrair seções e hooks quando necessário
6. **UI Kit:** Use estritamente **Shadcn/ui + Tailwind CSS**

### 🔄 FLUXO DE TRABALHO

1. Ao criar um arquivo, registre-o imediatamente no `PROJECT_MAP.md`
2. O código deve ser **seguro por padrão** (Validar inputs com Zod antes de enviar ao Banco)
3. **Refatoração Contínua:** Se um componente ultrapassar 500 linhas, extrair seções/hooks

### 📝 PADRÃO: Formatação de Campos em Modais (useState)

**Quando criar modais de gerenciamento (Cores, Marcas, Modelos, etc.) que usam `useState` ao invés de `react-hook-form`:**

#### ✅ Implementação Correta

```tsx
import React, { useState, useRef } from 'react';
import { applyFieldFormat, getFieldDefinition } from '../../config/field-dictionary';

export const ExemploModal = () => {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
                const cursorPosition = e.target.selectionStart || 0;
                const rawValue = e.target.value;
                
                // Get format from field dictionary
                const fieldDef = getFieldDefinition('nome_campo');
                const format = fieldDef?.format || 'capitalize';
                const formatted = applyFieldFormat(rawValue, format);
                
                setName(formatted);
                
                // Restore cursor position after formatting
                setTimeout(() => {
                    if (inputRef.current) {
                        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
                    }
                }, 0);
            }}
        />
    );
};
```

#### 🔑 Pontos Críticos

1. **useRef obrigatório**: Necessário para preservar posição do cursor
2. **getFieldDefinition**: Use a função estática, NÃO `getFieldDefinitionRuntime` (evita problemas de cache)
3. **setTimeout**: Essencial para restaurar cursor após React re-render
4. **Fallback format**: Sempre defina um formato padrão (ex: `'capitalize'`)

#### 📋 Checklist de Implementação

- [ ] Importar `useRef` do React
- [ ] Importar `applyFieldFormat` e `getFieldDefinition` do field-dictionary
- [ ] Criar `inputRef` com `useRef<HTMLInputElement>(null)`
- [ ] Adicionar `ref={inputRef}` no input
- [ ] Implementar `onChange` com preservação de cursor
- [ ] Adicionar campo ao `field-dictionary.ts` se não existir

#### ⚠️ Erros Comuns a Evitar

- ❌ **NÃO** usar `getFieldDefinitionRuntime` (causa erros de cache no Next.js)
- ❌ **NÃO** aplicar formatação sem preservar cursor (trava digitação)
- ❌ **NÃO** esquecer o `setTimeout` (cursor pula para o final)
- ❌ **NÃO** usar `onChange={(e) => setName(applyFieldFormat(e.target.value, 'format'))}` direto (sem cursor preservation)


---

### 📝 PADRÃO: Páginas de Configuração Complexas

**Quando criar páginas de configuração com múltiplas seções (ex: CategorySettings, ProductSettings):**

#### 🏗️ Estrutura Recomendada

```
pages/admin/feature/
  ├── index.tsx        → Lista de itens
  ├── new.tsx          → Criar novo item
  └── [id]/
      └── edit.tsx     → Editar item existente

components/feature/
  ├── FeatureEditPage.tsx  → Container principal (~150-250 linhas)
  └── sections/
      ├── Section1.tsx     → Seção 1 (~80-200 linhas)
      ├── Section2.tsx     → Seção 2 (~80-200 linhas)
      └── Section3.tsx     → Seção 3 (~80-200 linhas)
```

#### ✅ Exemplo: Category Management

**Arquivos criados:**
- `pages/admin/settings/categories/index.tsx` - Lista de categorias
- `pages/admin/settings/categories/new.tsx` - Nova categoria
- `pages/admin/settings/categories/[id]/edit.tsx` - Editar categoria
- `components/categories/CategoryEditPage.tsx` - Container (230 linhas)
- `components/categories/sections/BasicInfoSection.tsx` - Nome e slug (80 linhas)
- `components/categories/sections/FieldConfigSection.tsx` - Traffic Light (130 linhas)
- `components/categories/sections/CustomFieldsSection.tsx` - Campos personalizados (50 linhas)
- `components/categories/sections/EANAutofillSection.tsx` - Config autofill (240 linhas)
- `components/categories/sections/AutoNamingSection.tsx` - Geração de nome (220 linhas)

**Container Pattern (CategoryEditPage.tsx):**

```tsx
export const CategoryEditPage: React.FC<CategoryEditPageProps> = ({ categoryId }) => {
    // Estado centralizado
    const [name, setName] = useState('');
    const [config, setConfig] = useState<CategoryConfig>({...});
    
    // Handlers de callback para seções
    const updateFieldConfig = (field, value) => {...};
    const updateCustomFields = (fields) => {...};
    const updateEANConfig = (config) => {...};
    
    return (
        <div className="max-w-5xl mx-auto p-6">
            <BasicInfoSection name={name} onChange={setName} />
            <FieldConfigSection config={config} onChange={updateFieldConfig} />
            <CustomFieldsSection fields={config.custom_fields} onChange={updateCustomFields} />
            <EANAutofillSection config={config.ean_autofill_config} onChange={updateEANConfig} />
            <AutoNamingSection config={config.auto_naming} onChange={updateAutoNaming} />
            <ActionButtons onSave={handleSave} onCancel={handleCancel} />
        </div>
    );
};
```

#### 🎯 Benefícios

- ✅ Código modular e testável
- ✅ Fácil adicionar novas seções
- ✅ Manutenção simplificada
- ✅ Reutilização de componentes
- ✅ Cada arquivo < 250 linhas

#### ⚠️ Regras

1. **Container**: Deve ter < 250 linhas
2. **Seções**: Cada seção deve ter < 250 linhas
3. **Props tipadas**: Todas as props devem ter interfaces
4. **Callbacks memoizados**: Use `useCallback` se necessário para performance
5. **Estado centralizado**: Container gerencia estado, seções apenas renderizam
6. **Navegação**: Use páginas dedicadas ao invés de modais para configurações complexas


---


- ❌ **NÃO** usar `getFieldDefinitionRuntime` (causa erros de cache no Next.js)
- ❌ **NÃO** aplicar formatação sem preservar cursor (trava digitação)
- ❌ **NÃO** esquecer o `setTimeout` (cursor pula para o final)
- ❌ **NÃO** usar `onChange={(e) => setName(applyFieldFormat(e.target.value, 'format'))}` direto (sem cursor preservation)


---

## 🏛️ Base Architecture
- [x] Initial Scaffolding (React + TS + Vite-like)
- [x] Governance Standards (field-standards.ts)
- [x] Backend Integration (PocketBase SDK)
- [x] Infrastructure (Dockerfile for Cloud Run)
- [x] Modular Directory Structure
- [x] Database Schema Design (v2)
- [x] Contexts & Brain: AuthContext & ThemeEngine
- [x] Data Integrity: CurrencyInput (Integer handling) & IMEIInput (UpperTrim)
- [x] Routing & Security: ProtectedRoute & RBAC Layouts
- [x] Auth Module: LoginPage with CPF/Password (5-digit) logic
- [x] Modular Routing System (routes/index.tsx)
- [x] Atomic Layouts (layouts/AdminLayout.tsx)

## 📂 Directory Structure
- `/components/ui`: Standardized inputs and atomic visual elements
- `/components/products/sections`: Product form section components (BasicInfo, Specifications, Pricing, Images)
- `/components/products/hooks`: Product-related custom hooks (useEANAutofill)
- `/hooks`: Logic hooks
- `/services`: PB and API calls
- `/core`: Business rules and "Antigravity" validations
- `/utils`: Styling (cn), standards, and masks
- `/contexts`: Global state providers
- `/pages`: View components (Auth, Dashboard, Store)
- `/routes`: Routing configuration
- `/layouts`: Global structures (Admin, Store)

## 🛠️ Tech Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Routing:** React Router 7
- **Integrity:** react-currency-input-field
- **UI:** Shadcn/ui principles (Radix), Lucide Icons
- **State:** Context API + Zustand (future)
- **Database/Auth:** PocketBase

## 📜 Revision Log
- **2026-01-30:** Initial Scaffold, PB Schema, Contexts.
- **2026-01-30:** Data Integrity components and Routing System implemented.
- **2026-01-30:** Finalized FASE 3 modularity and code organization.
- **2026-01-31:** Color Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Storage Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** RAM Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Version Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Battery Health Management System (types, service, selector, page, modal) following Brand pattern.
- **2026-01-31:** Smart Dictionary System (field-dictionary, SmartInput component, FieldConfigPage, ProductForm refactoring).
- **2026-02-01:** ProductForm Refactoring (1093→440 lines, -60%): Extracted 4 section components (ProductBasicInfo, ProductSpecifications, ProductPricing, ProductImages) and 1 custom hook (useEANAutofill). Follows Antigravity Protocol 300-500 line limit.
- **2026-02-01:** ANTIGRAVITY PROTOCOL v4.25 added to PROJECT_MAP.md as mandatory first-check documentation.
- **2026-02-01:** Category Management Modular Refactoring (722→9 files): Removed CategoryEditModal (722 lines), created modular architecture with 5 section components (BasicInfo, FieldConfig, CustomFields, EANAutofill, AutoNaming), 1 container (CategoryEditPage), and 3 routing pages (index, new, [id]/edit). Total: ~1,140 lines in 9 files (avg 127 lines/file). Established "Complex Configuration Pages" pattern in ANTIGRAVITY PROTOCOL.
- **2026-02-02:** Customer Management System: Refactored CustomerFormPage (887→475 lines) following ANTIGRAVITY PROTOCOL. Extracted 3 section components (CustomerBasicInfoSection, CustomerContactSection, CustomerAddressSection). Added customer type field, birth date with age/birthday calculation, social media fields (Instagram, Facebook), internal notes, Google Maps integration, WhatsApp link, and print functionality.
- **2026-02-02:** Team Management System: Complete CRUD implementation following Clone-and-Adapt pattern from Customer module. Created TeamFormPage (451 lines), TeamListPage (342 lines), and 3 section components (TeamBasicInfoSection 205 lines, TeamContactSection 88 lines, TeamRemunerationSection 144 lines). Features: role-based fields (seller, delivery, manager, admin, stock), employment types (CLT, Freelancer, PJ), conditional remuneration (salary, monthly_salary, commission_rate, delivery_fee), weekly hours tracking with automatic hourly rate calculation, CPF/CNPJ validation (11/14 digits), Instagram field, birthday countdown (unlimited days). Total: 5 components, ~1,230 lines. Routes: /admin/team, /admin/team/new, /admin/team/:id/edit.

## 📦 Implemented Modules

### 👥 Team Management System
**Status:** ✅ Complete (Form + List)  
**Pattern:** Clone-and-Adapt from Customer module  
**Compliance:** ✅ ANTIGRAVITY PROTOCOL (all files < 500 lines)

#### Files Structure
```
pages/team/
├── TeamFormPage.tsx (451 lines) - Main form container
└── TeamListPage.tsx (342 lines) - List view with filters

components/team/
├── TeamBasicInfoSection.tsx (205 lines) - Name, CPF/CNPJ, birth date, role, employment type
├── TeamContactSection.tsx (88 lines) - Email, phone, Instagram
└── TeamRemunerationSection.tsx (144 lines) - Conditional salary fields

types/
└── team.ts (105 lines) - TeamMember, TeamMemberInput, TeamMemberFilters

services/
└── teamService.ts - CRUD operations (to be implemented)
```

#### Key Features
- **Roles:** seller, delivery, manager, admin, stock
- **Employment Types:** CLT, Freelancer, PJ
- **Conditional Remuneration:**
  - CLT: Monthly salary
  - Freelancer/PJ: Monthly salary + weekly hours (default 40h) + automatic hourly rate calculation
  - Seller: Commission rate (%)
  - Delivery (Freelancer/PJ): Delivery fee per order
- **Validations:**
  - CPF: exactly 11 digits (numbers only)
  - CNPJ: exactly 14 digits (numbers only)
  - Birth date: HTML5 date input with max="9999-12-31"
- **Birthday Tracking:** Shows days until next birthday (unlimited range, no 30-day limit)
- **Contact:** Email, phone with WhatsApp link, Instagram
- **Status:** Active/Inactive toggle

#### Routes
- `/admin/team` - List all team members
- `/admin/team/new` - Create new member
- `/admin/team/:id/edit` - Edit existing member

#### Database Schema
Migration: `supabase/migrations/20260202_create_team_members.sql`
- Fields: name, cpf_cnpj, birth_date, role, employment_type, email, phone, instagram
- Remuneration: salary, monthly_salary, weekly_hours, commission_rate, delivery_fee
- Metadata: is_active, hire_date, admin_notes, created_at, updated_at

#### Navigation
Added "Equipe" link in AdminLayout sidebar (after "Clientes")

---
