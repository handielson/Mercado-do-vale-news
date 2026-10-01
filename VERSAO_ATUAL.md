# v1.2.527-payjoy-boleto-mensagens

Data: 2026-10-01. Status: pronta para publicação. Branch: main.
Tag: `v1.2.527-payjoy-boleto-mensagens`.
Release principal: `/var/www/mdv-site/releases/20261001-144717-v12527-payjoy-boleto-mensagens`.

Quando o cliente pergunta se há boleto, o fluxo PayJoy responde em três mensagens curtas: apresenta boleto ou Pix, explica a análise e envia o link, depois orienta o cliente a retornar com o resultado.

O atualizador reconhece a integração PayJoy já instalada e substitui somente a política de pagamento, preservando os outros nós, conexões e ajustes atuais do workflow.
