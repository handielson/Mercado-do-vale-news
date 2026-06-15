# Versao Atual

```text
version: v1.1.16-sections-cls-reserve
date: 2026-06-15
status: published
release_vps: /var/www/mdv-site/releases/20260614-231648-v1116-sections-cls-reserve
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- O catalogo agora reserva uma secao de produtos enquanto as secoes assincronas carregam, evitando que "Mais Recentes" seja inserido acima do grid sem espaco.
- O shell inline mobile reserva a segunda linha do header publico e ajusta o `top` da busca sticky para a altura real do header.
- O shell inline tambem reserva o cabecalho da primeira secao antes dos cards.
- A entrega preserva o preload/imagem inicial do banner LCP publicado na `v1.1.15`.
- Foram adicionadas guardas estaticas para impedir regressao da reserva de secoes e da geometria mobile do shell.

## Como Recuperar

Use a tag/versao `v1.1.16-sections-cls-reserve` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.16-sections-cls-reserve.md
```

## Publicacao

- Release VPS planejada/publicada: `/var/www/mdv-site/releases/20260614-231648-v1116-sections-cls-reserve`.
- Esta versao altera apenas o frontend publico; a API VPS nao precisa ser reiniciada.
