# v1.2.528-product-handoff-notification

Data: 2026-10-01. Status: publicada. Branch: main.
Tag: `v1.2.528-product-handoff-notification`.
Release principal: `/var/www/mdv-site/releases/20261001-144559-v12528-product-handoff-notification`.

Buscas de produto sem resultado conclusivo que precisem de conferência humana agora usam o handoff `bot-handoff-request`. Esse identificador aciona o sistema existente de aviso aos administradores antes de deixar o atendimento sob responsabilidade humana.

A correção elimina o caso em que o bot dizia ter encaminhado o pedido, pausava a conversa por duas horas e não avisava ninguém da equipe.
