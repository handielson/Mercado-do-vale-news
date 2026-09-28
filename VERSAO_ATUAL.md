# v1.2.491-oferta-autopreenchida

Data: 2026-09-27. Status: pronta para publicação. Branch: main.
Tag: v1.2.491-oferta-autopreenchida
Release: /var/www/mdv-site/releases/20260927-214245-v12491-oferta-autopreenchida

A configuração comercial de cada site agora preenche nome, descrição, categoria, preços, endereço e dados de busca com as informações já existentes no cadastro central. Os valores continuam editáveis e dados específicos previamente salvos para o site são preservados.

A tela explica quais campos são obrigatórios ou opcionais e como funciona cada estado de visibilidade. A publicação exige categoria e preço de venda; na Loja 3D, também fica bloqueada até o SKU estar marcado como produto 3D no cadastro central.

Validação: 21 testes de ofertas, catálogo e isolamento comercial aprovados; build de produção concluído com a trava contra dependência operacional do Supabase.
