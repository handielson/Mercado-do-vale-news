# v1.2.512-shopee-conta-g-cascata

Data: 2026-09-29. Status: pronta para publicacao. Branch: main.
Tag: v1.2.512-shopee-conta-g-cascata
Release principal: /var/www/mdv-site/releases/20260929-214846-v1-2-512-shopee-conta-g-cascata

Esta versao conclui o fluxo controlado de copia dos anuncios da conta Shopee M para a conta G. O envio individual e a cascata preservam variacoes, atributos, imagens e video; excluem anuncios ja vinculados; reconciliam anuncios que ja existem na Shopee; registram sucesso, bloqueio, erro, restante e previsao de termino em checkpoint persistente.

O upload de video passa a retornar o identificador logo apos concluir o envio dos bytes. O cliente consulta o processamento da Shopee separadamente, evitando o limite do proxy. Bloqueios regulatorios continuam seguros: dados ANATEL, ANVISA ou INMETRO nao sao inventados.

Validacoes: testes estaticos focados do envio individual, cascata, tunel e API de midia; sintaxe dos scripts e servidores; build de producao; saude publica da API e teste real controlado do SKU XD540.
