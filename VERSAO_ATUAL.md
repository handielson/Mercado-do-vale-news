# v1.2.497-seo-dominio-3dmv

Data: 2026-09-28. Status: pronta para publicação. Branch: main.
Tag: v1.2.497-seo-dominio-3dmv
Release principal: /var/www/mdv-site/releases/20260928-115100-v1-2-497-seo-3dmv
Release 3D: /var/www/print3d-site/releases/20260928-114521-v1-2-496-3dmv

Esta versão entrega sitemap e `robots.txt` próprios para `www.3dmv.com.br`. O sitemap do novo domínio inclui somente a Loja 3D e seus produtos publicados, sem URLs do Mercado do Vale.

A proteção automatizada também mantém o destino isolado do deploy 3D em `/var/www/print3d-site`.

O domínio usa Cloudflare com registros para a VPS e nameservers atribuídos à zona. O deploy separado grava releases em `/var/www/print3d-site`, mantendo rollback independente do site Mercado do Vale.

Validações: builds principal e 3D, testes de famílias, herança de variações, ofertas por site, SEO do produto e contrato de implantação do domínio.
