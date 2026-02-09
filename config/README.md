# Configuração de Badges do Catálogo

## 📍 Localização
**Arquivo**: `config/category-badges.ts`

## 🎯 O que são Badges?

Badges são etiquetas que aparecem no topo dos cards de produtos no catálogo, destacando características importantes como:
- 📡 NFC
- 📶 5G  
- 📱 Dual SIM
- ⚡ Carregamento Sem Fio
- 💧 Resistente à Água

## ✏️ Como Editar

### 1. Abrir o arquivo
```
config/category-badges.ts
```

### 2. Localizar a categoria
Encontre a categoria que deseja configurar (ex: `'celulares'`, `'notebooks'`, `'tablets'`)

### 3. Adicionar ou remover badges
Cada badge tem a seguinte estrutura:

```typescript
{
    spec: 'nome_do_campo',      // Campo em product.specs
    value: 'Sim',                // Valor esperado
    label: 'Texto do Badge',     // Texto exibido
    icon: '📡',                  // Emoji (opcional)
    color: 'from-blue-500 to-cyan-500'  // Gradiente Tailwind
}
```

## 📝 Exemplo Prático

### Adicionar badge "Carregamento Rápido"

```typescript
export const CATEGORY_BADGES: Record<string, BadgeConfig[]> = {
    'celulares': [
        // ... badges existentes ...
        {
            spec: 'fast_charging',
            value: 'Sim',
            label: 'Carregamento Rápido',
            icon: '⚡',
            color: 'from-yellow-500 to-orange-500'
        }
    ]
}
```

## 🎨 Cores Disponíveis (Gradientes Tailwind)

| Cor | Classe |
|-----|--------|
| Azul/Ciano | `from-blue-500 to-cyan-500` |
| Roxo/Índigo | `from-purple-500 to-indigo-500` |
| Laranja/Vermelho | `from-orange-500 to-red-500` |
| Verde/Esmeralda | `from-green-500 to-emerald-500` |
| Amarelo/Âmbar | `from-yellow-500 to-amber-500` |
| Rosa/Pink | `from-pink-500 to-rose-500` |

## ⚠️ Importante

1. O campo `spec` deve corresponder exatamente ao nome do campo em `product.specs`
2. O `value` deve corresponder ao valor armazenado no banco de dados
3. Após editar, salve o arquivo - o HMR atualizará automaticamente

## 🔍 Verificar Resultado

Após salvar, vá para o catálogo público (`http://localhost:3000/`) e verifique se os badges aparecem nos produtos corretos.
