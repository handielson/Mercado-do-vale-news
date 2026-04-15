# 🚨 DIAGNÓSTICO: BUGS APÓS PROTOCOLO DE SEGURANÇA

**Data:** 13 de Abril de 2026  
**Fase:** Investigação e Fixes Aplicados  
**Status:** ✅ Parcialmente Resolvido

---

## Resumo Executivo

Após implementação de "protocolo de segurança" (mudança de chaves/env vars), 3 bugs críticos surgiram:

| # | Bug | Impacto | Status |
|----|-----|--------|--------|
| **BUG-001** | Ícone de vídeo azul falso | Produtos sem vídeo aparecem com ícone azul | ✅ CORRIGIDO |
| **BUG-002** | Produtos do Bling inativos com estoque | Importação não atualiza status de produtos | ⏳ INVESTIGAÇÃO |
| **BUG-003** | Inconsistência de estoque Bling ↔ Sistema | Estoque divergente entre sistemas | ⏳ INVESTIGAÇÃO |

---

## BUG-001: Ícone de Vídeo Azul Incorreto (CORRIGIDO ✅)

### Sintoma
- **Afetado:** Produto `A13A04SRC` (exemplo do usuário)
- **Descrição:** Ícone de vídeo mostrava "azul" (indicando vídeo existente) mesmo quando o produto NÃO tinha vídeo
- **User impact:** Admin confunde status visual, produtos aparecem com informação errada

### Investigação

#### Código problemático (vps_server.js, linhas 2460-2467)
```javascript
} catch (synoErr) {
  console.warn('[check-video] Synology inatível, fallback otimista:', synoErr.message);
  return { exists: true, url: canonicalUrl };  // ← BUG: sempre true!
}
...
} catch {
  return { exists: true, url: canonicalUrl };  // ← BUG: sempre true!
}
```

**Raiz do problema:** Endpoint `/check-video` tinha fallback "**otimista**" (retornava `exists: true` em erros) em vez de verificar o CDN.

### Causa Provável
O "protocolo de segurança" provavelmente:
- Desabilitou/isolou o Synology (rotação de credenciais não completada)
- Quebrou a autenticação SYNO_USER / SYNO_PASS
- Endpoint sempre caía na exceção e retornava `exists: true` como fallback

### Solução Implementada ✅

**Arquivo:** `vps_server.js` + `vps_server.cjs` (linhas 2434-2488)

Mudança de fallback "**otimista**" para "**pessimista com validação**":

```javascript
// ❌ ANTES: Fallback otimista (bugado)
} catch (synoErr) {
  return { exists: true, url: canonicalUrl };
}

// ✅ DEPOIS: Fallback pessimista com HEAD validation
} catch (synoErr) {
  console.warn('[check-video] Synology indisponível, tentando HEAD fallback no CDN:', synoErr.message);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const headResp = await fetch(canonicalUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    if (headResp.ok) {
      return { exists: true, url: canonicalUrl };
    }
  } catch (headErr) {
    console.warn('[check-video] HEAD fallback falhou:', headErr.message);
  }
  
  // Sem Synology e sem confirmação via CDN: retorna false (pessimista)
  return { exists: false, url: null };
}
```

**Mudanças:**
1. Adicionado HEAD request ao CDN como fallback
2. Timeout de 3 segundos para evitar travamentos
3. Retorna `exists: false` apenas quando não confirmar a existência

### Validação
```bash
# Teste: Produto inexistente
$ curl https://api.xiaomipetrolina.com.br/check-video?sku=INEXISTENTE999
{"exists":false,"url":null}  ✅ Retorna false (antes retornava true)

# Teste: Produto existente no CDN
$ curl https://api.xiaomipetrolina.com.br/check-video?sku=KTS-W009V
{"exists":true,"url":"https://videos.mercadodovale.com.br/KTS-W009V.mp4"}  ✅
```

### Commits
- **d651e03** - fix: fallback pessimista no endpoint /check-video com HEAD fallback no CDN
- **1c7adfe** - fix: adicionar timeout 3s ao HEAD fallback no /check-video
- **PM2 Deploy** - Restart automático com mudanças (PID 2050208 → 2050368)

---

## BUG-002: Produtos do Bling Inativos com Estoque (⏳ INVESTIGAÇÃO)

### Sintoma
- **Descrição:** Produtos importados do Bling com:
  - ✅ Estoque > 0
  - ❌ Status = "inactive" (inativo)
- **Expected:** Status = "active" (ativo) quando `situacao === 'A'` no Bling

### Investigação

#### Lógica correta (services/blingService.ts, linha 661)
```typescript
status: item.situacao === 'A' ? 'active' : 'inactive',
```

A lógica está **correta** no código. Possíveis causas:

1. **❓ Row Level Security (RLS)** quebrado no Supabase
   - Protocolo de segurança mudou chaves RLS
   - UPDATE de status está sendo bloqueado silenciosamente
   - Verificar logs do Supabase

2. **❓ Token do Bling expirado/inválido**
   - `situacao` vindo como `null` ou não-'A'
   - Protocolo rotacionou credenciais do Bling incompletamente
   - Verificar `bling_access_token` em company_settings

3. **❓ Mapeamento de campos desabilitado**
   - Campo `status` pode estar fora de `enabledFields`
   - Importação pularia o mapeamento de status
   - Verificar UI de seleção de campos

### Próximos Passos de Diagnóstico

```sql
-- Verificar status de produtos com bling_id
SELECT id, sku, name, status, stock_quantity, bling_id
FROM products
WHERE status = 'I' AND bling_id IS NOT NULL AND stock_quantity > 0
LIMIT 10;

-- Produto A-607 especificamente
SELECT id, sku, name, status, stock_quantity, bling_id
FROM products
WHERE sku LIKE '%A-607%' OR sku LIKE '%A607%';
```

---

## BUG-003: Inconsistência de Estoque Bling ↔ Sistema (⏳ INVESTIGAÇÃO)

### Sintoma
- "Outros produtos não constam estoque no Bling,  mas constam estoque aqui no sistema"
- Estoque divergente após protocolo de segurança

### Causa Provável
Webhook de sincronização de estoque pode estar:
- ❌ Desabilitado no Bling
- ❌ Apontando para URL errada
- ❌ Com falha de autenticação (token expirado)

### Verificação

**URL do webhook esperada:**
```
https://www.mercadodovale.com.br/api/bling?resource=webhook
```

**Checklist:**
- [ ] Webhook cadastrado no Bling (Aplicativo → Webhooks → Servidores)
- [ ] EventosPDF habilitados: `stock.updated`, `virtual_stock.updated`, `movimentacaoEstoque`
- [ ] URL retorna 200 OK no GET de validação do Bling
- [ ] Logs de webhook em `/api/bling?resource=webhook` mostram tentativas recentes

---

## Recomendações Imediatas

### 1. **Validar Protocolo de Segurança**
```bash
# Checklist de credenciais
- [ ] SYNO_USER / SYNO_PASS ainda válidas?
- [ ] BLING_CLIENT_ID / BLING_CLIENT_SECRET atualizadas corretamente?
- [ ] SUPABASE_SERVICE_ROLE_KEY está com RLS correto?
- [ ] Token JWT para autenticação VPS foi regenerado?
```

### 2. **Testar Endpoints Críticos**
```bash
# Testar vídeo
curl https://api.xiaomipetrolina.com.br/check-video?sku=A13A04SRC

# Testar importação Bling
curl -X POST https://www.mercadodovale.com.br/api/bling?resource=products

# Testar webhook de estoque
curl https://www.mercadodovale.com.br/api/bling?resource=webhook
```

### 3. **Monitoramento**
```bash
# Acompanhar logs do VPS
pm2 logs 0 --lines 50

# Verificar histórico de refreshes de token Bling
SELECT * FROM company_settings 
LIMIT 1 \G
```

---

## Timeline de Correções

| Hora | Ação | Status |
|------|------|--------|
| 14:30 | Bug-001 investigado | ✅ Identificado |
| 14:45 | Fix HEAD fallback implementado | ✅ Commitado |
| 15:00 | Deploy no VPS (PID 2050208)| ✅ Deployado |
| 15:05 | Timeout 3s adicionado | ✅ Deployado |
| 15:30 | Documentação | ✅ Feito |

---

## Próximas Ações

- [ ] Usuário testa admin com Ctrl+Shift+R (hard refresh)
  - Verificar: Ícone de vídeo A13A04SRC fica **cinza** (not blue)?
  - Verificar: Ícone de vídeo KTS-W009V fica **azul**?
  
- [ ] Investigar Bug-002 (status inativo)
  - Verificar RLS Supabase
  - Validar token Bling
  - Revisar logs de importação
  
- [ ] Revisar status de webhook Bling
  - Pode estar desabilitado ou inválido após protocolo de segurança

---

## Notas de Desenvolvimento

**Arquivo afetados:**
- `vps_server.js` - Endpoint `/check-video` (pesimista com timeout)
- `vps_server.cjs` - Cópia compilada (sincronizado)
- `vps_server.js` - Endpoint `/public/check-video` (não modificado neste diagnóstico)
- `services/blingService.ts` - Lógica de importação (sem mudanças necessárias)

**Variáveis de debug:**
- `SYNO_USER`, `SYNO_PASS`, `SYNO_URL` → Autenticação Synology
- `BLING_ACCESS_TOKEN` → Token do Bling (renovado automaticamente)
- RLS policies no Supabase → Bloqueia UPDATEs?

**Cache impactado:**
- `videoExistenceCache` no VPS (TTL ~5min) - Será limpo automaticamente

