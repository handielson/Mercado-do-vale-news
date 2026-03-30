# API REST - Mercado do Vale (Legacy System)

## 🔑 Credenciais de Acesso

```typescript
// Configuração base
const SUPABASE_URL = 'https://zzjbxvvvqcpqgfqmqrxu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6amJ4dnZ2cWNwcWdmcW1xcnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4Mzc1MzEsImV4cCI6MjA1MTQxMzUzMX0.Hy0Gy8dVWYCzKRXBPpBcUTEuoNRcIXRnwjJjbQHZjTg'

// Headers padrão para todas as requisições
const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
}
```

---

## 📋 Endpoints Disponíveis

### Base URL
```
https://zzjbxvvvqcpqgfqmqrxu.supabase.co/rest/v1
```

---

## 👥 1. Clientes (Customers)

### Listar todos os clientes
```http
GET /customers?select=*
```

**Exemplo:**
```typescript
const response = await fetch(
  'https://zzjbxvvvqcpqgfqmqrxu.supabase.co/rest/v1/customers?select=*',
  { headers }
)
const customers = await response.json()
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "name": "João Silva",
    "cpf_cnpj": "12345678900",
    "phone": "11999999999",
    "email": "joao@email.com",
    "address_street": "Rua Exemplo",
    "address_number": "123",
    "address_complement": "Apto 45",
    "address_neighborhood": "Centro",
    "address_city": "São Paulo",
    "address_state": "SP",
    "address_zip_code": "01000-000",
    "customer_type": "PF",
    "is_wholesale": false,
    "wholesale_approved": false,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

### Buscar cliente por ID
```http
GET /customers?id=eq.{uuid}&select=*
```

### Buscar cliente por CPF/CNPJ
```http
GET /customers?cpf_cnpj=eq.12345678900&select=*
```

### Filtrar clientes atacadistas
```http
GET /customers?is_wholesale=eq.true&select=*
```

---

## 📱 2. Produtos (Phones)

### Listar todos os produtos
```http
GET /phones?select=*
```

**Exemplo:**
```typescript
const response = await fetch(
  'https://zzjbxvvvqcpqgfqmqrxu.supabase.co/rest/v1/phones?select=*&order=entry_date.desc',
  { headers }
)
const products = await response.json()
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "device_type": "Celulares",
    "imei1": "123456789012345",
    "imei2": "123456789012346",
    "serial": "SN123456",
    "brand_id": "uuid",
    "model": "Galaxy S23",
    "version": "Ultra",
    "ram": "12GB",
    "storage": "256GB",
    "color": "Preto",
    "buy_price": 3000.00,
    "sell_price_suggested": 4500.00,
    "sell_price_override": 4200.00,
    "status": "DISPONIVEL",
    "quantity": 1,
    "condition": "NEW",
    "battery_health": 100,
    "notes": "Produto novo na caixa",
    "entry_date": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "image": "data:image/jpeg;base64,..."
  }
]
```

### Buscar produtos com marca
```http
GET /phones?select=*,brand:brands(*)
```

### Filtrar por categoria
```http
GET /phones?device_type=eq.Celulares&select=*
```

### Filtrar por status
```http
GET /phones?status=eq.DISPONIVEL&select=*
```

### Buscar por IMEI
```http
GET /phones?imei1=eq.123456789012345&select=*
```

---

## 🏷️ 3. Marcas (Brands)

### Listar todas as marcas
```http
GET /brands?select=*
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "name": "Samsung",
    "profit_rule_type": "PERCENTAGE",
    "profit_rule_value": 30,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

## 📂 4. Categorias (Categories)

### Listar todas as categorias
```http
GET /categories?select=*&order=display_order
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "name": "Celulares",
    "display_order": 1,
    "active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

## 💰 5. Vendas (Sales)

### Listar todas as vendas
```http
GET /sales?select=*,customer:customers(*),items:sale_items(*)
```

**Exemplo:**
```typescript
const response = await fetch(
  'https://zzjbxvvvqcpqgfqmqrxu.supabase.co/rest/v1/sales?select=*,customer:customers(*),items:sale_items(*)&order=sale_date.desc',
  { headers }
)
const sales = await response.json()
```

**Resposta:**
```json
[
  {
    "id": "uuid",
    "customer_id": "uuid",
    "sale_date": "2024-01-01T00:00:00Z",
    "total_amount": 4200.00,
    "payment_method": "PIX",
    "status": "COMPLETED",
    "customer": {
      "id": "uuid",
      "name": "João Silva",
      "phone": "11999999999"
    },
    "items": [
      {
        "id": "uuid",
        "sale_id": "uuid",
        "phone_id": "uuid",
        "quantity": 1,
        "unit_price": 4200.00,
        "subtotal": 4200.00
      }
    ]
  }
]
```

### Vendas por período
```http
GET /sales?sale_date=gte.2024-01-01&sale_date=lte.2024-12-31&select=*
```

### Vendas de um cliente
```http
GET /sales?customer_id=eq.{uuid}&select=*,items:sale_items(*)
```

---

## 🏢 6. Fornecedores (Suppliers)

### Listar fornecedores
```http
GET /suppliers?select=*
```

---

## 🔍 Filtros Avançados

### Operadores disponíveis:
- `eq` - igual a
- `neq` - diferente de
- `gt` - maior que
- `gte` - maior ou igual
- `lt` - menor que
- `lte` - menor ou igual
- `like` - contém (case-sensitive)
- `ilike` - contém (case-insensitive)
- `in` - está em lista
- `is` - é null/not null

### Exemplos:

**Buscar produtos com preço maior que 1000:**
```http
GET /phones?sell_price_suggested=gte.1000&select=*
```

**Buscar clientes por nome (contém):**
```http
GET /customers?name=ilike.*Silva*&select=*
```

**Buscar múltiplos status:**
```http
GET /phones?status=in.(DISPONIVEL,RESERVADO)&select=*
```

---

## 📊 Paginação

### Limitar resultados
```http
GET /phones?select=*&limit=50
```

### Paginação com offset
```http
GET /phones?select=*&limit=50&offset=100
```

### Range específico
```http
GET /phones?select=*&range=0-49
```

---

## 🔄 Ordenação

### Ordem crescente
```http
GET /phones?select=*&order=entry_date.asc
```

### Ordem decrescente
```http
GET /phones?select=*&order=entry_date.desc
```

### Múltiplas ordenações
```http
GET /phones?select=*&order=brand_id.asc,entry_date.desc
```

---

## 💻 Exemplo Completo - Service no Novo Projeto

```typescript
// src/services/legacyApi.ts

const SUPABASE_URL = 'https://zzjbxvvvqcpqgfqmqrxu.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6amJ4dnZ2cWNwcWdmcW1xcnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4Mzc1MzEsImV4cCI6MjA1MTQxMzUzMX0.Hy0Gy8dVWYCzKRXBPpBcUTEuoNRcIXRnwjJjbQHZjTg'

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
}

export class LegacyAPI {
  private baseUrl = `${SUPABASE_URL}/rest/v1`

  // Clientes
  async getCustomers() {
    const response = await fetch(`${this.baseUrl}/customers?select=*`, { headers })
    return response.json()
  }

  async getCustomerById(id: string) {
    const response = await fetch(
      `${this.baseUrl}/customers?id=eq.${id}&select=*`,
      { headers }
    )
    const data = await response.json()
    return data[0]
  }

  // Produtos
  async getProducts() {
    const response = await fetch(
      `${this.baseUrl}/phones?select=*,brand:brands(*)&order=entry_date.desc`,
      { headers }
    )
    return response.json()
  }

  async getProductsByCategory(category: string) {
    const response = await fetch(
      `${this.baseUrl}/phones?device_type=eq.${category}&select=*,brand:brands(*)`,
      { headers }
    )
    return response.json()
  }

  async getAvailableProducts() {
    const response = await fetch(
      `${this.baseUrl}/phones?status=eq.DISPONIVEL&select=*,brand:brands(*)`,
      { headers }
    )
    return response.json()
  }

  // Vendas
  async getSales(startDate?: string, endDate?: string) {
    let url = `${this.baseUrl}/sales?select=*,customer:customers(*),items:sale_items(*)&order=sale_date.desc`
    
    if (startDate) url += `&sale_date=gte.${startDate}`
    if (endDate) url += `&sale_date=lte.${endDate}`
    
    const response = await fetch(url, { headers })
    return response.json()
  }

  async getSalesByCustomer(customerId: string) {
    const response = await fetch(
      `${this.baseUrl}/sales?customer_id=eq.${customerId}&select=*,items:sale_items(*)`,
      { headers }
    )
    return response.json()
  }

  // Marcas
  async getBrands() {
    const response = await fetch(`${this.baseUrl}/brands?select=*`, { headers })
    return response.json()
  }

  // Categorias
  async getCategories() {
    const response = await fetch(
      `${this.baseUrl}/categories?select=*&order=display_order`,
      { headers }
    )
    return response.json()
  }
}

// Uso:
const api = new LegacyAPI()
const customers = await api.getCustomers()
const products = await api.getProducts()
```

---

## 🔒 Segurança

### RLS (Row Level Security)
As políticas RLS estão configuradas para permitir leitura pública dos dados do catálogo. Para dados sensíveis (vendas, clientes), você pode precisar autenticação adicional.

### Revogar Acesso
Quando quiser desconectar o novo projeto:
1. Acesse o Supabase Dashboard
2. Settings → API
3. Revogue ou regenere a chave `anon`

---

## 📝 Notas Importantes

1. **Limite de requisições**: Supabase tem rate limiting. Para uso intenso, considere caching.
2. **Imagens**: Campo `image` retorna Base64. Pode ser pesado. Use `select=id,model,brand_id` para excluir.
3. **Dados em tempo real**: Qualquer mudança no sistema antigo reflete imediatamente.
4. **Backup**: Recomendo fazer backup periódico dos dados antes de migrar completamente.

---

## 🚀 Próximos Passos

1. Teste os endpoints no Postman/Insomnia
2. Implemente o service no Mercado do Vale New
3. Crie adaptadores para transformar dados para nova estrutura
4. Migre gradualmente (clientes → produtos → vendas)
5. Quando 100% migrado, revogue a API key

---

## 📞 Suporte

Se precisar de ajuda com:
- Queries específicas
- Transformação de dados
- Performance
- Novos endpoints

É só me chamar! 🚀
