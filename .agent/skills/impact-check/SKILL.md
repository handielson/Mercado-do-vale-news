---
name: impact-check
description: Análise de impacto obrigatória antes de qualquer modificação no projeto Mercado do Vale. Lê o CODEBASE.md, mapeia dependências e identifica efeitos colaterais antes de escrever código.
---

# SKILL: Impact Check — Mercado do Vale

## Objetivo

Evitar efeitos colaterais silenciosos ao modificar arquivos do projeto.
Esta skill é **obrigatória** antes de qualquer modificação de código.

---

## Protocolo de Execução (SEMPRE seguir esta ordem)

### PASSO 1 — Ler o CODEBASE.md

```
Arquivo: mercado-do-vale/CODEBASE.md
```

Ler as seções relevantes para o arquivo que será modificado:
- **Mapa de Módulos** — quem usa o arquivo
- **Services** — funções exportadas e quem as chama
- **Zonas de Risco** — verificar se a mudança toca alguma zona
- **Banco de Dados** — verificar nomes de colunas antes de qualquer query

### PASSO 2 — Responder o Checklist de Impacto

Antes de escrever qualquer linha de código, responder internamente:

| Pergunta | Resposta obrigatória |
|----------|---------------------|
| Qual arquivo será modificado? | [nome do arquivo] |
| Quem importa/usa esse arquivo? | [lista de dependentes] |
| A mudança afeta alguma Zona de Risco? | [Zona X: descrição] ou Nenhuma |
| Preciso modificar mais de um arquivo? | [sim/não + lista] |
| A mudança afeta o banco de dados? | [sim/não + coluna/tabela] |

### PASSO 3 — Declarar o Escopo

Antes de modificar, declarar explicitamente:

```
📋 ESCOPO DA MUDANÇA:
- Arquivo principal: [arquivo]
- Arquivos secundários (se necessário): [lista]
- Zonas de risco ativadas: [lista ou "nenhuma"]
- Efeitos colaterais esperados: [descrição ou "nenhum"]
```

### PASSO 4 — Modificar com Escopo Mínimo

Aplicar a regra crítica do projeto:
> **Só modifique exatamente o que foi pedido. Nada mais.**

Se durante a implementação descobrir que precisa modificar algo além do escopo:
→ **PARAR** e perguntar ao usuário antes de continuar.

### PASSO 5 — Atualizar o CODEBASE.md

Após qualquer modificação, atualizar o `CODEBASE.md`:

1. Adicionar linha na tabela **Histórico de Mudanças**:
   ```
   | [data] | [descrição curta] | [arquivos afetados] |
   ```

2. Se a mudança adicionou/removeu funções de um service:
   → Atualizar a tabela de funções do service correspondente

3. Se a mudança criou uma nova Zona de Risco:
   → Adicionar na seção **Zonas de Risco**

---

## Zonas de Risco Conhecidas (resumo rápido)

| Zona | Trigger | Ação |
|------|---------|------|
| `specs` JSONB | Qualquer campo de specs | Verificar sintaxe `specs->>campo` |
| Preços | Qualquer campo de preço | Confirmar que é centavos (inteiro) |
| Dois services de produto | `products.ts` vs `productService.ts` | Verificar qual é o correto para o contexto |
| Agrupamento catálogo | `model_id`, `specs.color/ram/storage` | Atualizar em CustomerCatalogPage E CatalogSection |
| RLS Supabase | Qualquer query nova | Incluir `company_id` no filtro |
| `model_color_images` | Coluna de imagem | Usar `images[]` (array), NÃO `image_url` |
| Entrada em massa | `serialList`, `handleFormSubmit` | Verificar validação de unicidade |
| Preço médio | `ram` + `storage` | Só ativa se ambos preenchidos |

---

## Quando Ativar Esta Skill

- Sempre que o usuário pedir para modificar qualquer arquivo do projeto
- Antes de criar um novo service ou componente
- Antes de adicionar uma nova query ao Supabase
- Antes de modificar tipos (`types/*.ts`)
- Antes de modificar o schema do banco

## Quando NÃO é necessário

- Perguntas sobre o código (sem modificação)
- Leitura de arquivos para entender o sistema
- Criação de arquivos completamente novos sem dependências existentes

---

## Referência Rápida de Arquivos Críticos

```
CODEBASE.md                              ← Planta do sistema (ler primeiro)
services/products.ts                     ← CRUD admin (productService)
services/productService.ts               ← Busca PDV (funções individuais)
services/catalogService.ts               ← Catálogo público
services/saleService.ts                  ← Vendas
services/averagePriceService.ts          ← Preço médio
services/modelColorImages.ts             ← Fotos modelo+cor
hooks/useProducts.ts                     ← Hook de listagem admin
components/products/ProductForm.tsx      ← Formulário de produto (crítico)
components/products/ProductCard.tsx      ← Card admin (busca foto)
components/catalog/CatalogSection.tsx    ← Seção catálogo (agrupamento)
pages/customer/CustomerCatalogPage.tsx   ← Catálogo cliente (agrupamento)
pages/pdv/PDVPage.tsx                    ← PDV principal
types/product.ts                         ← Interface Product
types/catalog.ts                         ← Interface CatalogProduct
```
