# v1.2.496-fix-destino-3dmv

Data: 2026-09-28. Status: pronta para publicação. Branch: main.
Tag: v1.2.496-fix-destino-3dmv
Release principal: /var/www/mdv-site/releases/20260928-114800-v1-2-496-fix-destino
Release 3D: /var/www/print3d-site/releases/20260928-114521-v1-2-496-3dmv

Esta correção garante que a Loja 3D seja publicada em `/var/www/print3d-site`, mesmo quando o ambiente local contém `VPS_SITE_ROOT=/var/www/mdv-site` para o site principal.

O release principal do Mercado do Vale foi restaurado imediatamente após a detecção. A proteção automatizada agora exige o destino independente no wrapper do deploy 3D.

O domínio usa Cloudflare com registros para a VPS e nameservers atribuídos à zona. O deploy separado grava releases em `/var/www/print3d-site`, mantendo rollback independente do site Mercado do Vale.

Validações: builds principal e 3D, testes de famílias, herança de variações, ofertas por site, SEO do produto e contrato de implantação do domínio.
