# Versao Atual

```text
version: v1.1.18-admin-image-sibling-fallback
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260615-110000-v1118-admin-image-sibling
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- A lista de produtos do admin continua usando a carga compacta, mas agora tem um terceiro fallback de imagem.
- Quando o produto atual vem sem `images` e nao ha galeria em `model_color_images`, o card procura produtos irmaos do mesmo `model_id`.
- A escolha prioriza produto irmao com a mesma cor e depois o mesmo slug/nome, cobrindo SKUs novos do Poco X7 Pro sem imagem propria.
- A guarda estatica do fallback de imagens do admin foi ampliada para impedir regressao desse fluxo.
- A entrega preserva as correcoes do PDV publicadas na `v1.1.17`.
- A entrega preserva as melhorias de CLS/PageSpeed publicadas na `v1.1.16`.

## Como Recuperar

Use a tag/versao `v1.1.18-admin-image-sibling-fallback` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.18-admin-image-sibling-fallback.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260615-110000-v1118-admin-image-sibling`.
- Esta versao altera apenas o frontend publico; a API VPS nao precisa ser reiniciada.
