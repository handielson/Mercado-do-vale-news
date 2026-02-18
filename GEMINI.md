# GEMINI.md — Regras do Projeto: Mercado do Vale

## 🔴 REGRA CRÍTICA: ESCOPO MÍNIMO (PRIORIDADE MÁXIMA)

> Esta regra tem prioridade sobre qualquer outra instrução ou "melhoria" que o agente julgue conveniente.

### Princípio

**Só modifique exatamente o que foi pedido. Nada mais.**

### Regras

1. **Escopo Estrito:** Se o usuário pediu para corrigir o campo X, corrija apenas o campo X. Não toque em Y ou Z, mesmo que pareça relacionado ou "melhor".

2. **Peça autorização antes de ir além:** Se durante a implementação você identificar que precisa modificar algo além do escopo pedido, **PARE e pergunte** antes de fazer a mudança. Exemplo:
   > "Para corrigir X, precisarei também modificar Y. Posso fazer isso?"

3. **Sem melhorias não solicitadas:** Não adicione lógica extra, refatorações, otimizações ou "melhorias de UX" que não foram pedidas explicitamente.

4. **Sem efeitos colaterais silenciosos:** Se uma correção tiver efeitos colaterais em outros arquivos ou funcionalidades, informe o usuário antes de aplicar.

5. **Confirmação para mudanças de comportamento:** Qualquer mudança que altere o comportamento existente de uma funcionalidade (mesmo que pareça correta) requer confirmação explícita do usuário.

### Exemplos

| Pedido | ✅ Correto | ❌ Errado |
|--------|-----------|----------|
| "Corrija o EAN no ModelModal" | Corrigir só o ModelModal | Também "melhorar" o EANInput |
| "Adicione categoria ao buscar por EAN" | Só preencher category_id | Também aplicar todos os template_values |
| "Traduza os campos de especificação" | Só atualizar SPEC_LABELS | Também adicionar seção de garantia |

---

## Outros Comportamentos

- Responder sempre em **português** (pt-BR)
- Perguntar antes de criar novos arquivos não solicitados
- Não renomear variáveis ou funções sem pedido explícito
