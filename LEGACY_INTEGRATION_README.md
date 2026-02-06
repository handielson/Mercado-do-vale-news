# 🔄 Integração com Sistema Legacy - Mercado do Vale

## 📋 Visão Geral

Este módulo permite acessar dados do sistema antigo (MV-Gestao) através da API REST do Supabase. Você pode visualizar, exportar e migrar dados de clientes, produtos e vendas para o novo sistema.

## 🚀 Como Usar

### 1. Acessar a Página de Migração

Navegue para: **http://localhost:5173/admin/migration**

Ou clique em "Migração de Dados" no menu lateral (se adicionado).

### 2. Visualizar Estatísticas

A página mostra automaticamente:
- Total de clientes
- Total de produtos
- Total de vendas
- Produtos disponíveis
- Clientes atacadistas

### 3. Explorar Dados

Use as abas para navegar entre:
- **Estatísticas**: Visão geral dos dados
- **Clientes**: Lista de todos os clientes
- **Produtos**: Lista de produtos (primeiros 100)
- **Vendas**: Lista de vendas recentes (últimas 50)

### 4. Exportar Dados

Cada aba tem um botão "Exportar JSON" que permite baixar os dados em formato JSON para importação no novo sistema.

## 💻 Uso Programático

### Importar o Service

```typescript
import { legacyAPI } from '@/services/legacyAPI'
```

### Exemplos de Uso

#### Buscar Clientes
```typescript
// Todos os clientes
const customers = await legacyAPI.getCustomers()

// Cliente por ID
const customer = await legacyAPI.getCustomerById('uuid')

// Cliente por CPF/CNPJ
const customer = await legacyAPI.getCustomerByCpfCnpj('12345678900')

// Clientes atacadistas
const wholesaleCustomers = await legacyAPI.getWholesaleCustomers()
```

#### Buscar Produtos
```typescript
// Todos os produtos (sem imagens para melhor performance)
const products = await legacyAPI.getProducts()

// Produtos com imagens
const productsWithImages = await legacyAPI.getProducts({ includeImages: true })

// Produtos com informações de marca
const productsWithBrand = await legacyAPI.getProductsWithBrand()

// Produtos por categoria
const phones = await legacyAPI.getProductsByCategory('Celulares')

// Produtos disponíveis
const available = await legacyAPI.getAvailableProducts()

// Produto por IMEI
const product = await legacyAPI.getProductByImei('123456789012345')
```

#### Buscar Vendas
```typescript
// Todas as vendas
const sales = await legacyAPI.getSales()

// Vendas por período
const sales = await legacyAPI.getSales({
  startDate: '2024-01-01',
  endDate: '2024-12-31'
})

// Vendas de um cliente
const customerSales = await legacyAPI.getSalesByCustomer('customer-uuid')

// Venda por ID
const sale = await legacyAPI.getSaleById('sale-uuid')
```

#### Buscar Marcas e Categorias
```typescript
// Todas as marcas
const brands = await legacyAPI.getBrands()

// Marca por ID
const brand = await legacyAPI.getBrandById('brand-uuid')

// Todas as categorias
const categories = await legacyAPI.getCategories()
```

#### Estatísticas
```typescript
// Estatísticas gerais
const stats = await legacyAPI.getStats()
console.log(stats)
// {
//   totalCustomers: 150,
//   totalProducts: 444,
//   totalSales: 320,
//   availableProducts: 200,
//   wholesaleCustomers: 25
// }
```

## 📊 Estrutura de Dados

### Customer (Cliente)
```typescript
interface LegacyCustomer {
  id: string
  name: string
  cpf_cnpj: string
  phone?: string
  email?: string
  address_street?: string
  address_number?: string
  address_complement?: string
  address_neighborhood?: string
  address_city?: string
  address_state?: string
  address_zip_code?: string
  customer_type: 'PF' | 'PJ'
  is_wholesale: boolean
  wholesale_approved: boolean
  created_at: string
}
```

### Product (Produto)
```typescript
interface LegacyProduct {
  id: string
  device_type: string
  imei1: string
  imei2?: string
  serial?: string
  brand_id: string
  model: string
  version?: string
  ram: string
  storage: string
  color: string
  buy_price: number
  sell_price_suggested: number
  sell_price_override?: number
  status: string
  quantity: number
  condition: 'NEW' | 'USED' | 'SHOWCASE'
  battery_health?: number
  notes?: string
  entry_date: string
  updated_at: string
  image?: string // Base64
}
```

### Sale (Venda)
```typescript
interface LegacySale {
  id: string
  customer_id: string
  sale_date: string
  total_amount: number
  payment_method: string
  status: string
  customer?: LegacyCustomer
  items?: LegacySaleItem[]
}
```

## 🔒 Segurança

### API Key
A API key está configurada no arquivo `services/legacyAPI.ts`. Ela permite acesso **somente leitura** aos dados.

### Revogar Acesso
Quando a migração estiver completa:
1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em Settings → API
3. Revogue ou regenere a chave `anon`

## ⚡ Performance

### Otimizações Implementadas

1. **Exclusão de Imagens por Padrão**
   - Produtos são carregados sem o campo `image` (Base64)
   - Use `includeImages: true` apenas quando necessário

2. **Paginação**
   - Use `limit` e `offset` para grandes volumes de dados
   ```typescript
   const products = await legacyAPI.getProducts({ limit: 50, offset: 100 })
   ```

3. **Cache Local**
   - Considere cachear dados que não mudam frequentemente
   - Exemplo: marcas, categorias

## 🔄 Migração Gradual

### Estratégia Recomendada

1. **Fase 1: Clientes**
   - Exportar clientes do sistema antigo
   - Importar no novo sistema
   - Validar dados

2. **Fase 2: Produtos**
   - Exportar produtos (sem imagens primeiro)
   - Importar no novo sistema
   - Depois importar imagens separadamente

3. **Fase 3: Vendas**
   - Exportar histórico de vendas
   - Importar como registros históricos
   - Manter referências aos clientes/produtos

4. **Fase 4: Desconexão**
   - Validar que todos os dados foram migrados
   - Revogar API key
   - Desativar sistema antigo

## 🛠️ Troubleshooting

### Erro: "Legacy API Error: Unauthorized"
- Verifique se a API key está correta
- Confirme que a key não foi revogada

### Erro: "Network Error"
- Verifique sua conexão com internet
- Confirme que o Supabase está online

### Dados não aparecem
- Verifique as RLS policies no Supabase
- Confirme que há dados no sistema antigo

### Performance lenta
- Use paginação (`limit` e `offset`)
- Exclua imagens (`includeImages: false`)
- Faça requisições em horários de baixo uso

## 📚 Documentação Adicional

- [Documentação Completa da API](../LEGACY_API_DOCUMENTATION.md)
- [Supabase REST API Docs](https://supabase.com/docs/guides/api)

## 🆘 Suporte

Se precisar de ajuda:
1. Consulte a documentação completa
2. Verifique os logs do console
3. Entre em contato com o desenvolvedor

---

**Última atualização**: 05/02/2026
**Versão**: 1.0.0
