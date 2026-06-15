# Versao Atual

```text
version: v1.1.20-admin-public-regressions
date: 2026-06-15
status: pending-deploy
release_vps: pendente
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Corrige crash em `/admin/sales` removendo chamada a setter inexistente depois da refatoracao de resumo local.
- Corrige o sumico da aba publica `Mais Recentes` ao tratar `track_inventory = "0"` como falso e limpar o cache da vitrine.
- Banners passam a renderizar sem corte lateral (`object-contain`) e aceitam link completo, caminho, ID ou slug de produto.
- `Adicionar igual` nao herda EAN do produto original, evitando bloqueio por EAN duplicado no cadastro serializado.
- IMEI 1 e IMEI 2 agora sao bloqueados quando nao tiverem exatamente 15 numeros, tanto no formulario quanto na lista em massa.
- A precificacao ganhou botao para reaproveitar medias de estoque em custo, varejo, revenda e atacado.
- Modelos ganharam botao para preencher a lista padrao de brindes de smartphones mantendo o campo editavel.
- A pagina publica do produto prioriza imagens por cor cadastradas no modelo, corrigindo produtos legados com cor/imagem trocada.

## Como Recuperar

Use a tag/versao `v1.1.20-admin-public-regressions` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-15-v1.1.20-admin-public-regressions.md
```

## Publicacao

- Release VPS planejada/publicada: `pendente`.
- Esta versao altera apenas o frontend; a API VPS nao precisa ser reiniciada.
