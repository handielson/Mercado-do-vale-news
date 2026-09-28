# v1.2.503-fluxo-produtos-3dmv

Data: 2026-09-28. Status: pronta para publicação. Branch: main.
Tag: v1.2.503-fluxo-produtos-3dmv
Release principal: /var/www/mdv-site/releases/20260928-204917-v1-2-503-fluxo-produtos-3dmv
Release 3DMV: /var/www/print3d-site/releases/20260928-204917-v1-2-503-fluxo-produtos-3dmv

O cadastro 3D passa a seguir um fluxo único por produto: **Cadastro → Produção 3D → Sites e preços**. Arquivos de impressão, custos, revisão e link de origem ficam vinculados ao SKU vendável; o modelo permanece opcional e reservado para dados reutilizáveis.

A descrição exibida nos sites vem do cadastro central/pai, com HTML sanitizado e editor visual. No localhost, alterações de catálogo ficam em rascunho local e só chegam à API central após aprovação explícita.

Validações: testes de isolamento dos sites, descrição e oferta central, prévia local, ficha 3D, navegação do produto, verificações sintáticas da API e builds dos dois sites.
