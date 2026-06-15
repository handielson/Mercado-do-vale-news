# Versao Atual

```text
version: v1.1.17-admin-pdv-media-fixes
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-103612-v1117-admin-pdv-media
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O PDV volta a declarar o estado `showSuccessModal`, evitando erro fatal apos finalizar venda.
- O PDV volta a importar `customerService`, evitando erro fatal no carregamento dos entregadores/clientes de entrega.
- A lista de produtos do admin preserva o carregamento compacto, mas busca o produto completo quando o card visivel ficou sem capa nem imagem de modelo/cor.
- Foram adicionadas guardas estaticas para impedir regressao do modal de sucesso do PDV e do fallback de imagens do admin.
- A entrega preserva as melhorias de CLS/PageSpeed publicadas na `v1.1.16`.

## Como Recuperar

Use a tag/versao `v1.1.17-admin-pdv-media-fixes` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.17-admin-pdv-media-fixes.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-103612-v1117-admin-pdv-media`.
- Esta versao altera apenas o frontend publico; a API VPS nao precisa ser reiniciada.
