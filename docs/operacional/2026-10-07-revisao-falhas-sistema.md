# Fila de correções — revisão de catálogo e PDV

Revisão em 07/10/2026. Não é auditoria integral. As consultas de produção foram somente leituras, sem exibir valores privados.

| # | Prioridade | Problema | Estado |
|---|---|---|---|
| 1 | Alta | API pública expõe custo e preços comerciais sem autenticação | Publicado e validado — v1.2.572-protecao-precos |
| 2 | Alta | Filtros `in_ids` e `min_price` das seções ignorados pela API | Pendente |
| 3 | Alta | Venda e baixa de IMEIs não são uma operação atômica | Pendente |
| 4 | Alta | Confirmação de WhatsApp iniciada antes da baixa dos aparelhos | Pendente |
| 5 | Média | Categoria filtrada após buscar amostra limitada de produtos | Pendente |
| 6 | Média | Recentes, novidades e mais vendidos não agrupam famílias | Pendente |
| 7 | Média | Reordenação das seções com gravações independentes | Pendente |
| 8 | Média | Fallback de produtos em cache sem conferir validade | Pendente |

## Item 1 — proteção de preços na resposta

Fonte dos valores: MySQL, sem alteração de preço ou estoque. Fonte da autorização: sessão Bearer validada pela API e tipo atual do cliente no banco. Parâmetros do navegador não concedem acesso.

- Visitante e cliente de varejo: preço de varejo/promoção; sem custo, revenda ou atacado.
- Conta comercial autenticada (`resale`, `reseller`, `wholesale`): preços comerciais; sem custo.
- Administrador autenticado: preserva os campos operacionais. Chave de transporte/proxy, mesmo válida, não libera custo nas rotas públicas; integrações internas mantêm suas rotas protegidas de operação.
- Proteção central em `services/productReadPrivacy.cjs`, montada nos três entrypoints, para listagem, ID, slug, EAN, categoria, IDs, combos e ofertas públicas por site.
- Respostas de produtos não podem entrar em cache compartilhado. Frontend não armazena respostas autenticadas no cache anônimo nem no localStorage do catálogo; namespaces antigos não são reutilizados.
- Publicação autorizada pelo usuário via publish-vps e concluída na versão v1.2.572-protecao-precos. API direta e proxy: lista, ID e slug sem campos privados e com no-store. Login administrativo real conserva custo e preços comerciais. Demais perfis cobertos nos testes HTTP com dados sintéticos.

Testes: `node --test tmp-tests/product-read-privacy.test.cjs`. Exercitam HTTP Fastify com dados sintéticos, visitante, token inválido, varejo, comercial, administrador, chave interna, custos aninhados, datas e troca de sessão no cache. Não acessam banco/WhatsApp real.

Validação local: cinco testes de privacidade e 17 testes de rotas de ofertas passaram, além das regressões de configuração pública de seções, responsável no CRUD, categorias, normalização de tipos de conta, nome público e preço da variação. Teste do deploy seletivo e regressão de baixa por local do PDV passaram. Sintaxe dos três entrypoints e módulo validada. Build de produção e trava contra runtime Supabase passaram. Produção: mysql.ok=true, home HTTP 200, VERSION correspondente e navegador com catálogo/ficha administrativa sem erros de console. Nenhum preço ou estoque alterado.
