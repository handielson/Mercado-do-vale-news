# 🔄 Guia de Migração de Dados com Adapters

## 📋 Como Funciona

O sistema de migração possui **3 camadas**:

1. **API Legacy** (`legacyAPI.ts`) - Busca dados do sistema antigo
2. **Adapters** (`legacyAdapters.ts`) - Transforma e valida dados
3. **Importação** - Insere no novo sistema

## 🛡️ Tratamento de Campos Faltantes

### Estratégias Implementadas:

#### 1. **Valores Padrão**
Campos opcionais recebem `undefined` se ausentes:
```typescript
phone: legacy.phone || undefined  // Se vazio, fica undefined
```

#### 2. **Validação**
Registros inválidos são **ignorados** e registrados:
```typescript
if (!legacy.name || !legacy.cpf_cnpj) {
  // Registra problema e retorna null
  return null
}
```

#### 3. **Transformação**
Campos são mapeados e convertidos:
```typescript
// Sistema antigo: 'DISPONIVEL'
// Sistema novo: 'AVAILABLE'
status: mapProductStatus(legacy.status)
```

#### 4. **Logging**
Todos os problemas são registrados:
```typescript
{
  recordId: "uuid",
  recordType: "customer",
  field: "phone",
  issue: "missing",
  message: "Campo ausente, usando valor padrão"
}
```

## 💻 Exemplo de Uso

### 1. Migrar Clientes

```typescript
import { legacyAPI } from '@/services/legacyAPI'
import { adaptCustomerBatch } from '@/services/legacyAdapters'

// Buscar clientes do sistema antigo
const legacyCustomers = await legacyAPI.getCustomers()

// Transformar com validação
const result = adaptCustomerBatch(legacyCustomers)

console.log(`✅ Sucesso: ${result.success.length}`)
console.log(`❌ Falhas: ${result.failed.length}`)
console.log(`⚠️ Problemas: ${result.issues.length}`)

// Inserir no novo sistema
for (const customer of result.success) {
  await newSystemAPI.createCustomer(customer)
}

// Exportar relatório de problemas
const report = generateMigrationReport()
console.log(JSON.stringify(report, null, 2))
```

### 2. Migrar Produtos

```typescript
import { adaptProductBatch } from '@/services/legacyAdapters'

const legacyProducts = await legacyAPI.getProducts()
const result = adaptProductBatch(legacyProducts)

// Produtos transformados com sucesso
result.success.forEach(product => {
  console.log(`${product.name} - R$ ${product.sellPrice}`)
})

// Produtos que falharam
result.failed.forEach(product => {
  console.log(`❌ Falha: ${product.model}`)
})
```

### 3. Migrar Vendas (Requer Mapeamento)

```typescript
import { adaptSale } from '@/services/legacyAdapters'

// Primeiro, criar mapas de IDs
const customerIdMap = new Map<string, string>()
const productIdMap = new Map<string, string>()

// Popular mapas (após migrar clientes e produtos)
customerIdMap.set('legacy-customer-id', 'new-customer-id')
productIdMap.set('legacy-product-id', 'new-product-id')

// Transformar venda
const legacySales = await legacyAPI.getSales()
const adaptedSales = legacySales
  .map(sale => adaptSale(sale, customerIdMap, productIdMap))
  .filter(Boolean)
```

## 📊 Campos Mapeados

### Clientes

| Sistema Antigo | Sistema Novo | Tratamento |
|----------------|--------------|------------|
| `name` | `name` | Obrigatório, trim() |
| `cpf_cnpj` | `document` | Validado, apenas números |
| `customer_type` | `documentType` | Calculado (11=CPF, 14=CNPJ) |
| `is_wholesale` | `customerType` | 'WHOLESALE' ou 'RETAIL' |
| `phone` | `phone` | Opcional, apenas números |
| `email` | `email` | Opcional |
| `address_*` | `address.*` | Agrupado em objeto |

### Produtos

| Sistema Antigo | Sistema Novo | Tratamento |
|----------------|--------------|------------|
| `model` + `version` | `name` | Concatenado |
| `device_type` | `category` | Mapeado (Celulares→PHONE) |
| `imei1` | `imei` | Opcional |
| `status` | `status` | Mapeado (DISPONIVEL→AVAILABLE) |
| `condition` | `condition` | Mapeado (NEW, USED, REFURBISHED) |
| `sell_price_override` | `sellPrice` | Override tem prioridade |
| `buy_price` | `costPrice` | Padrão 0 se ausente |

### Vendas

| Sistema Antigo | Sistema Novo | Tratamento |
|----------------|--------------|------------|
| `customer_id` | `customerId` | Requer mapeamento |
| `items[].phone_id` | `items[].productId` | Requer mapeamento |
| `total_amount` | `totalAmount` | Obrigatório |
| `payment_method` | `paymentMethod` | Padrão 'DINHEIRO' |

## ⚙️ Configuração

### Modos de Migração

```typescript
import { MigrationConfig } from '@/services/legacyAdapters'

// Modo SAFE (padrão) - Usa valores padrão
MigrationConfig.mode = 'safe'

// Modo STRICT - Rejeita registros com campos inválidos
MigrationConfig.mode = 'strict'

// Modo PERMISSIVE - Aceita tudo, mesmo com problemas
MigrationConfig.mode = 'permissive'
```

### Logging

```typescript
// Ativar/desativar logs
MigrationConfig.logMissingFields = true
MigrationConfig.logTransformations = true

// Validação antes de inserir
MigrationConfig.validateBeforeInsert = true

// Pular registros inválidos ou parar?
MigrationConfig.skipInvalidRecords = false
```

## 📝 Relatório de Migração

### Gerar Relatório

```typescript
import { generateMigrationReport, exportMigrationReport } from '@/services/legacyAdapters'

// Após processar dados
const report = generateMigrationReport()

console.log(`Total de problemas: ${report.totalIssues}`)
console.log('Por tipo:', report.issuesByType)
console.log('Por campo:', report.issuesByField)

// Exportar para arquivo
const json = exportMigrationReport()
fs.writeFileSync('migration-report.json', json)
```

### Exemplo de Relatório

```json
{
  "totalIssues": 15,
  "issuesByType": {
    "customer_missing": 5,
    "product_invalid": 3,
    "sale_missing": 7
  },
  "issuesByField": {
    "customer.phone": 5,
    "product.sell_price": 3,
    "sale.items": 7
  },
  "issues": [
    {
      "recordId": "uuid-123",
      "recordType": "customer",
      "field": "phone",
      "issue": "missing",
      "originalValue": null,
      "newValue": undefined,
      "message": "Campo 'phone' ausente, usando valor padrão: undefined"
    }
  ]
}
```

## 🚨 Casos Especiais

### 1. Cliente sem Documento
```typescript
// ❌ REJEITADO - Documento é obrigatório
{
  name: "João Silva",
  cpf_cnpj: null  // ← Problema!
}
// Resultado: null (ignorado)
```

### 2. Produto sem Preço
```typescript
// ⚠️ ACEITO com warning
{
  model: "Galaxy S23",
  sell_price_suggested: 0  // ← Warning registrado
}
// Resultado: sellPrice = 0 (mas registra problema)
```

### 3. Venda sem Cliente
```typescript
// ❌ REJEITADO - Cliente é obrigatório
{
  customer_id: "uuid-inexistente"  // ← Não está no mapa
}
// Resultado: null (ignorado)
```

### 4. Endereço Parcial
```typescript
// ✅ ACEITO - Campos opcionais
{
  address_street: "Rua ABC",
  address_number: null,  // ← OK
  address_city: null     // ← OK
}
// Resultado: address = { street: "Rua ABC" }
```

## 🔍 Debugging

### Ver Problemas em Tempo Real

```typescript
import { migrationIssues } from '@/services/legacyAdapters'

// Durante a migração
const result = adaptCustomerBatch(customers)

// Ver problemas
migrationIssues.forEach(issue => {
  console.log(`${issue.recordType} ${issue.recordId}:`)
  console.log(`  Campo: ${issue.field}`)
  console.log(`  Problema: ${issue.issue}`)
  console.log(`  Mensagem: ${issue.message}`)
})
```

## 📌 Checklist de Migração

- [ ] Fazer backup do banco de dados
- [ ] Configurar modo de migração (`safe`, `strict`, `permissive`)
- [ ] Buscar dados do sistema antigo
- [ ] Processar com adapters
- [ ] Revisar relatório de problemas
- [ ] Corrigir registros com problemas (se necessário)
- [ ] Importar dados transformados
- [ ] Validar dados importados
- [ ] Gerar relatório final
- [ ] Arquivar dados antigos

## 🆘 Troubleshooting

### "Muitos registros ignorados"
- Verifique o modo de migração
- Revise o relatório de problemas
- Corrija dados no sistema antigo se possível

### "Campos importantes faltando"
- Use modo `permissive` temporariamente
- Adicione valores padrão manualmente
- Atualize após importação

### "Vendas sem clientes/produtos"
- Migre clientes e produtos PRIMEIRO
- Crie mapas de IDs corretos
- Depois migre vendas

---

**Última atualização**: 05/02/2026
