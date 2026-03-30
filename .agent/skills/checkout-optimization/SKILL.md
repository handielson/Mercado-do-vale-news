---
name: checkout-optimization
description: Super-especialista em UX de checkout para e-commerce. Redução de abandono de carrinho, otimização do fluxo de pagamento, trust signals, formulários e experiência pós-compra. Ativar sempre que trabalhar em carrinho, checkout, pagamento ou qualquer etapa do funil de conversão final.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Checkout Optimization — Do Carrinho à Confirmação

> **Missão:** O checkout é onde o dinheiro é ganho ou perdido. Cada campo a mais = 5% a menos de conversão.
> **Princípio:** Remova fricção. Construa confiança. Guie — não obrigue.

---

## 1. DADOS FUNDAMENTAIS

### Por que o Checkout Falha

```
Razões reais de abandono (Baymard Institute, 2024):
1. 48% — Custos extras altos (frete, impostos) descobertos no checkout
2. 24% — Obrigado a criar conta
3. 22% — Processo longo/complicado
4. 18% — Não confiei com dados do cartão
5. 17% — Não calculei entrega/prazo cedo
6. 12% — Política de devolução insatisfatória
7. 11% — Poucas opções de pagamento
```

### Benchmarks de Conversão

| Fase | Taxa Típica | Meta Otimizada |
|------|------------|----------------|
| Carrinho → Checkout start | 50-60% | > 70% |
| Checkout start → Pagamento | 60-70% | > 80% |
| Pagamento → Confirmação | 80-90% | > 92% |
| **Total carrinho → compra** | **25-35%** | **> 50%** |

---

## 2. CARRINHO (PRÉ-CHECKOUT)

### Elementos Obrigatórios no Carrinho

```
PRODUTO:
✅ Imagem thumbnail do produto
✅ Nome + variação selecionada (cor, tamanho)
✅ Quantidade com controles +/-
✅ Preço unitário e total por linha
✅ Botão de remover item

TOTAIS:
✅ Subtotal dos itens
✅ Frete calculado (ou estimativa por CEP)
✅ Desconto aplicado (se houver)
✅ TOTAL FINAL em destaque

AÇÕES:
✅ "Continuar Comprando" (link, não destaque)
✅ "Finalizar Compra" (CTA principal, grande)
✅ Campo de cupom (dobrado/oculto por padrão)
```

### Gatilhos no Carrinho

```
FRETE GRÁTIS PROGRESSIVO:
"Adicione mais R$47 e ganhe frete grátis!"
[Barra de progresso: |████████░░| R$203 / R$250]

CROSS-SELL CONTEXTUAL:
"Clientes que compraram [produto] também levaram:"
→ Case | Película | Carregador (produtos $20-80)

URGÊNCIA REAL:
"2 pessoas estão olhando esses itens agora"
"Preço válido por: [countdown 15min]" (usar com ética)

SALVAR CARRINHO:
"Fazer login para salvar seu carrinho"
(não obrigatório — opcional)
```

---

## 3. FLUXO DE CHECKOUT

### Estrutura Ideal: 3 Passos (Máximo)

```
PASSO 1: Identificação
  → Email (pré-preencher se possível)
  → Nome completo
  → Opções: [Continuar como Convidado] [Fazer Login] [Cadastrar]

PASSO 2: Entrega
  → CEP (autocompletar endereço!)
  → Endereço completo
  → Seleção de modalidade de entrega
  → Data estimada visível

PASSO 3: Pagamento
  → Método de pagamento
  → Dados do pagamento
  → Resumo do pedido
  → CTA Final

NÃO use passo separado para "Revisão" — integre no passo 3.
```

### Alternativa: One-Page Checkout

```
Melhor para:
- Mobile (menos navegação)
- Produtos simples (sem variações complexas)
- Retorno de clientes (dados salvos)

Estrutura:
┌─────────────────────────────┐
│ Resumo do Pedido (fixo top) │
├──────────┬──────────────────┤
│ FORM     │ ORDER SUMMARY    │
│ Left     │ Right (sticky)   │
│ column   │                  │
└──────────┴──────────────────┘
```

---

## 4. FORMULÁRIOS QUE CONVERTEM

### Princípios de Form Design

```
CAMPOS:
✅ Pedir APENAS o necessário
✅ Label acima do campo (não placeholder)
✅ Autocompletar por CEP
✅ Máscara nos campos (CPF, telefone, cartão)
✅ Validação em tempo real (inline)
✅ Mensagens de erro CLARAS e específicas

LAYOUT:
✅ Uma coluna para mobile (sempre!)
✅ Teclado correto por campo (numpad para CEP/cartão)
✅ Avançar automático para próximo campo em mobile
✅ Tamanho de input ≥ 48px touch target

ERROS:
❌ "Erro no campo" — inútil
✅ "CPF inválido — verifique os dígitos"
✅ "CEP não encontrado — tente outro formato (00000-000)"
```

### Campos por Etapa

```
IDENTIFICAÇÃO (mínimo possível):
- Email ← campo único para guest checkout
- Nome completo (pode dividir em First/Last para personalização)
- Telefone (WhatsApp para notificações)

ENTREGA:
- CEP (autocompletar resto!)
- Endereço (auto-preenchido)
- Número
- Complemento (opcional)
- Cidade/Estado (auto-preenchido pelo CEP)

PAGAMENTO — CARTÃO:
- Número do cartão (com máscara automática)
- Nome como no cartão
- Validade (MM/AA)
- CVV (com ícone de info)

NÃO pedir: RG, data de nascimento (exceto obrigatório por lei).
```

### Guest Checkout (OBRIGATÓRIO)

```
❌ ERRADO:
"Para finalizar sua compra, você precisa criar uma conta."
[Formulário de cadastro completo]

✅ CERTO:
[Continue como Convidado] ← CTA Principal
[Fazer Login]              ← Opção secundária
→ Após pedido: "Crie sua conta com 1 clique e acompanhe seu pedido"
```

---

## 5. OPÇÕES DE PAGAMENTO

### Cobertura Mínima (Brasil, 2024)

| Método | % Usuários | Prioridade |
|--------|-----------|-----------|
| **Cartão de crédito** | 75% | 🔴 Obrigatório |
| **Pix** | 65% | 🔴 Obrigatório |
| **Boleto bancário** | 30% | 🟡 Recomendado |
| **Cartão de débito** | 25% | 🟡 Recomendado |
| **Parcelamento** | 60% | 🔴 Obrigatório para ticket > R$500 |

### Apresentação do Pagamento

```
PIX:
- QR Code grande e legível
- Chave copiável (copy-paste)
- Contador de expiração (30 min)
- Instruções passo a passo
- Confirmação automática (polling)

CARTÃO:
- Bandeiras aceitas visíveis (ícones)
- Campo de cartão com formatting automático
- Número de parcelas dinâmico (mudar preço por parcela)
- Mostrar: "Total: R$1.899 = 12x de R$158,25 sem juros"

BOLETO:
- Prazo de vencimento claro
- Botão copiar linha digitável
- Botão baixar PDF
- Alerta: "Confirmação em até 3 dias úteis"
```

### Parcelamento Inteligente

```
Cálculo dinâmico em tempo real:
1x R$1.899,00 ← valor total
2x R$949,50 sem juros
3x R$633,00 sem juros
...
12x R$158,25 sem juros ← DESTACAR (mais popular)

Se com juros: mostrar total final e taxa ao mês.
Regra: Nunca esconder o custo total com juros.
```

---

## 6. TRUST SIGNALS NO CHECKOUT

### Onde e O Quê

```
HEADER DO CHECKOUT:
✅ Ícone de cadeado SSL + "Compra Segura"
✅ Breadcrumb simples (Carrinho → Entrega → Pagamento → Confirmação)
✅ REMOVER: menu de navegação principal (menos distração)

AO LADO DO FORMULÁRIO (sidebar):
✅ Resumo dos itens com imagem
✅ Total com breakdown
✅ Prazo de entrega estimado
✅ "30 dias para devolver — sem perguntas"

AO LADO DO BOTÃO PAGAR:
✅ Selos: Visa/Master/Pix/Boleto
✅ "Dados protegidos por criptografia SSL"
✅ "Sua compra está protegida"

FOOTER DO CHECKOUT (minimalista):
✅ Links: Política de Privacidade | Política de Devolução
✅ CNPJ e razão social
✅ Telefone de suporte / chat
```

### Remover Elementos que Distraem

```
REMOVER do checkout:
❌ Header de navegação completo
❌ Banners promocionais
❌ Links para outras páginas
❌ Pop-ups
❌ Chatbots intrusivos (manter, mas minimizados)

MANTER:
✅ Logo clicável (vai para home — escape hatch)
✅ Link de suporte/chat
✅ Carrinho para revisão
```

---

## 7. EXPERIÊNCIA PÓS-COMPRA

### Página de Confirmação (Thank You Page)

```
Obrigatório:
✅ "Pedido confirmado! 🎉" (celebração clara)
✅ Número do pedido em destaque
✅ Email de confirmação enviado para [email]
✅ Resumo do pedido (itens, valor, endereço)
✅ Prazo de entrega estimado

Oportunidades de conversão:
✅ Criar conta (se comprou como guest)
   → "Crie sua senha em 2 cliques e acompanhe o pedido"
✅ Indicação (referral)
   → "Divida R$50 com amigos — você e seus amigos ganham"
✅ Cross-sell suave
   → "Clientes que compraram também levaram" (1-2 produtos)
✅ WhatsApp / Notificações
   → "Receba atualizações do pedido no WhatsApp"
```

### Email de Confirmação

```
Assunto: "✅ Pedido #[N] confirmado — [Produto]"

Conteúdo:
1. Saudação por nome
2. Confirmação clara do pedido
3. Resumo dos itens
4. Endereço de entrega + prazo
5. Número para rastreamento (quando disponível)
6. Botão "Acompanhar Pedido"
7. Contato de suporte
8. Política de devolução
```

---

## 8. MOBILE CHECKOUT

### Regras Específicas para Mobile

```
TECLADO:
- CEP/número: inputmode="numeric"
- Telefone: inputmode="tel"
- Email: type="email"
- Cartão: inputmode="numeric" pattern="[0-9]*"

AUTOFILL:
- autocomplete="cc-number" para cartão
- autocomplete="cc-exp" para validade
- autocomplete="cc-csc" para CVV
- autocomplete="postal-code" para CEP

DESIGN:
- Botão CTA: full-width, height ≥ 56px
- Campos: height ≥ 48px
- Label sempre visível (não só placeholder)
- Sticky CTA no bottom (não perde de vista)
- Teclado não pode ocultar o CTA
```

### Progress Bar no Mobile

```
[●──────] Identificação → 33%
[●●─────] Entrega → 67%
[●●●────] Pagamento → 100%

Regras:
- Sempre visível no topo
- Clicável (voltar para etapas anteriores)
- Mostrar o próximo passo
```

---

## 9. DIAGNÓSTICO DE ABANDONO

### Onde Investigar

```
Ferramenta: Google Analytics / Hotjar / FullStory

Funil para monitorar:
/carrinho → /checkout/identificacao → /checkout/entrega 
→ /checkout/pagamento → /confirmacao

Perguntas:
1. Em qual etapa há maior queda?
2. Quais campos causam mais erros?
3. Quais métodos de pagamento falham mais?
4. Qual device tem mais abandono?
```

### Red Flags de UX

```
Se taxa de erro no campo cartão > 5%:
→ Melhorar máscara e validação inline

Se drop grande em "Identificação":
→ Adicionar/melhorar guest checkout

Se drop grande em "Frete":
→ Frete caro ou não calculado antes

Se drop grande em "Pagamento":
→ Opção de pagamento faltando ou erro técnico
```

---

## Related Skills

| Skill | Quando Usar |
|-------|------------|
| `ecommerce-conversion` | CRO geral de produto e listagem |
| `sales-psychology` | Gatilhos mentais no checkout |
| `product-copywriting` | Textos do checkout e emails |
