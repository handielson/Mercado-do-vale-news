# v1.2.477-whatsapp-blueprint

Data: 25/09/2026
Status: ready
Branch: main
Tag: v1.2.477-whatsapp-blueprint
Release VPS: /var/www/mdv-site/releases/20260925-045703-v12477-whatsapp-blueprint

## Alterações

- Pedido genérico de fotos de celulares recebe primeiro a lista oficial e a pergunta de qual modelo mostrar.
- Resposta “todos” oferece o link do catálogo; pedidos de até três modelos enviam foto e blueprint cadastrado de cada um. Acima de três, a Val pede uma seleção menor.
- Uma resposta de características que identifica exatamente um modelo e configuração inclui o blueprint cadastrado, sem enviar imagem quando a referência for ambígua.
- A publicação altera apenas três nós de código do workflow ativo do WhatsApp; não altera API, dados comerciais ou outros workflows.

## Validação

- `node --check tmp-tests/n8n-fix-generic-photo-catalog.cjs`
- `node tmp-tests/n8n-fix-generic-photo-catalog.cjs --dry-run-production`
- `node scripts/assert-no-supabase-runtime.cjs`
- `npm.cmd run build`
- `git diff --check`
