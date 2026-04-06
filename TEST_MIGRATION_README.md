# 🧪 Como Executar o Teste de Migração

## 📋 Pré-requisitos

1. Node.js instalado
2. Projeto configurado

## 🚀 Executar Teste

### Opção 1: Via Node (Recomendado)

```bash
cd "c:/Users/Nitro/SynologyDrive/SynologyDrive/Programas/Mercado do Vale New/mercado-do-vale"
node test-migration.js
```

### Opção 2: Importar no Console do Navegador

1. Inicie o projeto:
   ```bash
   npm run dev
   ```

2. Abra o console do navegador (F12)

3. Cole o código de teste

## 📊 O que o Teste Demonstra

### 5 Casos de Clientes:

1. ✅ **Cliente Perfeito** - Todos os campos preenchidos
2. ⚠️ **Sem Telefone** - Campo opcional faltando
3. ❌ **Sem CPF** - Campo obrigatório faltando (REJEITADO)
4. ❌ **CPF Inválido** - Apenas 3 dígitos (REJEITADO em STRICT)
5. ⚠️ **Endereço Parcial** - Alguns campos do endereço faltando

### 4 Casos de Produtos:

1. ✅ **Produto Perfeito** - Todos os campos, status transformado
2. ⚠️ **Sem IMEI** - Campo opcional faltando
3. ❌ **Sem Modelo** - Campo obrigatório faltando (REJEITADO)
4. ⚠️ **Preço Zero** - Warning registrado

## 📈 Resultado Esperado

```
🧪 INICIANDO TESTES DE MIGRAÇÃO

================================================================================

📊 TESTE 1: Modo SAFE (Padrão)

✅ Sucesso: 4/5
❌ Falhas: 1/5
⚠️  Problemas: 8

📋 Clientes Migrados com Sucesso:
  1. João Silva - 12345678900
  2. Maria Santos - 98765432100
     ⚠️  Sem telefone
  3. Ana Oliveira - 123
     ⚠️  Sem endereço
  4. Carlos Souza - 11122233344

❌ Clientes Rejeitados:
  1. Pedro Costa (ID: customer-003)

⚠️  Problemas Encontrados:
  1. [MISSING] customer customer-002
     Campo: phone
     Campo ausente, usando valor padrão: undefined
  2. [INVALID] customer customer-003
     Campo: cpf_cnpj
     Cliente sem documento - IGNORADO
  ...

================================================================================

📦 TESTE 2: Migração de Produtos

✅ Sucesso: 3/4
❌ Falhas: 1/4
⚠️  Problemas: 5

📋 Produtos Migrados:
  1. Galaxy S23 Ultra
     Categoria: PHONE
     Status: AVAILABLE
     Preço: R$ 4200.00
  2. iPad Air 5th Gen
     Categoria: TABLET
     Status: AVAILABLE
     Preço: R$ 3500.00
  3. Receptor Digital HD
     Categoria: RECEIVER
     Status: AVAILABLE
     Preço: R$ 0.00
     ⚠️  PREÇO ZERO!

❌ Produtos Rejeitados:
  1. SEM MODELO (ID: product-003)

================================================================================

🔒 TESTE 3: Modo STRICT

✅ Sucesso: 3/5
❌ Falhas: 2/5

💡 Diferença do modo SAFE:
   SAFE rejeitou: 1
   STRICT rejeitou: 2
   Diferença: 1 registros a mais

================================================================================

📊 RELATÓRIO FINAL DE MIGRAÇÃO

Total de problemas: 13

Por tipo:
  customer_missing: 3
  customer_invalid: 2
  product_missing: 2
  product_transformed: 6

Por campo:
  customer.phone: 1
  customer.cpf_cnpj: 2
  product.imei: 1
  product.status: 3

================================================================================

✅ TESTES CONCLUÍDOS!
```

## 🎯 Interpretação dos Resultados

### ✅ Sucesso
- Registro foi transformado e está pronto para importação
- Pode ter warnings, mas é válido

### ❌ Falha
- Registro foi rejeitado
- Não será importado
- Verifique o motivo no relatório

### ⚠️ Warning
- Registro aceito, mas com ressalvas
- Campos opcionais faltando
- Valores questionáveis (ex: preço zero)

## 🔧 Modificar Teste

Edite `test-migration.js` para adicionar seus próprios casos:

```javascript
const testCustomers = [
  {
    id: 'custom-001',
    name: 'Seu Cliente',
    cpf_cnpj: '12345678900',
    // ... outros campos
  }
]
```

## 📝 Próximos Passos

Após validar o teste:

1. Use a API real: `legacyAPI.getCustomers()`
2. Processe com adapters: `adaptCustomerBatch(customers)`
3. Revise relatório: `generateMigrationReport()`
4. Importe no novo sistema

---

**Dica:** Execute o teste antes de migrar dados reais para entender o comportamento!
