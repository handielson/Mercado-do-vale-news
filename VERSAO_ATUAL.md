# Versao Atual

```text
version: v1.1.62-model-list-options
date: 2026-06-18
status: published
release_vps: /var/www/mdv-site/releases/20260618-144906-v1162-model-list-options
branch: codex/publish-delivery-ops-20260614
```

## O Que Tem Nesta Versao

- Admin > Modelos agora mostra botoes alinhados de adicionar e editar ao lado de campos em formato de lista.
- Novas opcoes podem ser criadas dentro do editor e ja ficam pre-selecionadas no modelo.
- Opcoes existentes podem ser editadas sem sair do modal do modelo.
- O preenchimento por JSON/IA cria automaticamente opcoes ausentes em listas manuais e relacoes de tabela quando o valor e confiavel.
- As opcoes dinamicas sao normalizadas, deduplicadas e protegidas contra recarregamentos antigos sobrescreverem escolhas novas.
- Opcoes genericas/pontuadas da IA continuam bloqueadas para evitar sujeira nos cadastros.

## Como Recuperar

Use a tag/versao `v1.1.62-model-list-options` ou o arquivo copiavel em:

```text
docs/versoes/2026-06-18-v1.1.62-model-list-options.md
```

## Publicacao

- Release VPS publicada: `/var/www/mdv-site/releases/20260618-144906-v1162-model-list-options`.
- Esta versao altera comportamento visivel no admin; site VPS publicado.
- Esta versao nao altera `vps_server.js` nem `vps_server.cjs`; API VPS nao precisa ser reiniciada.
