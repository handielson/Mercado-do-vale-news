# Versao Atual

```text
version: v1.1.17-admin-pdv-media-fixes
date: 2026-06-15
status: pending
release_vps: pendente
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O PDV volta a declarar o estado `showSuccessModal`, evitando erro fatal apos finalizar venda.
- A lista de produtos do admin preserva o carregamento compacto, mas busca o produto completo quando o card visivel ficou sem capa nem imagem de modelo/cor.
- Foram adicionadas guardas estaticas para impedir regressao do modal de sucesso do PDV e do fallback de imagens do admin.
- A entrega preserva as melhorias de CLS/PageSpeed publicadas na `v1.1.16`.

## Como Recuperar

Use a tag/versao `v1.1.17-admin-pdv-media-fixes` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.17-admin-pdv-media-fixes.md
```

## Publicacao

- Release VPS planejada/publicada: `pendente`.
- Esta versao altera apenas o frontend publico; a API VPS nao precisa ser reiniciada.
