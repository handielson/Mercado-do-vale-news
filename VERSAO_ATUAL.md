# v1.2.495-dominio-3dmv

Data: 2026-09-28. Status: pronta para publicação. Branch: main.
Tag: v1.2.495-dominio-3dmv
Release 3D: pendente

Esta versão publica a Loja 3D em um frontend isolado para `www.3dmv.com.br`, sem expor o painel ou as páginas públicas do Mercado do Vale no novo domínio.

O catálogo administrativo passa a reunir pai e variações em famílias, permite marcar a família inteira como produto 3D, publicar todas as variações e completar os dados próprios do canal. A página pública de produto usa a família como endereço canônico, permite selecionar somente variações publicadas e entrega metadados de SEO.

O domínio usa Cloudflare com registros para a VPS e nameservers atribuídos à zona. O deploy separado grava releases em `/var/www/print3d-site`, mantendo rollback independente do site Mercado do Vale.

Validações: builds principal e 3D, testes de famílias, herança de variações, ofertas por site, SEO do produto e contrato de implantação do domínio.
