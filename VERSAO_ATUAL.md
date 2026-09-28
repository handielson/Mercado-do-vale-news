# v1.2.490-ficha-3d-manual

Data: 2026-09-27. Status: pronta para publicação. Branch: main.
Tag: v1.2.490-ficha-3d-manual
Release: /var/www/mdv-site/releases/20260927-212312-v12490-ficha-3d-manual

A Calculadora 3D agora permite criar uma ficha de produção inteira manualmente quando a impressão não passou pelo programa que gera o JSON. A revisão registra material, tempo, impressora, perfil, suporte/purga, filamentos, insumos, custos e observações, identifica a origem manual e pode ser ativada sem um arquivo JSON, mantendo obrigatório um modelo, projeto ou G-code principal.

Esta entrega também inclui a organização dos arquivos privados no Synology por SHA-256, com compartilhamento seguro entre revisões, verificação de integridade e preparação documentada do produto piloto Suporte LNB 3x3. A empresa operacional continua compartilhada com separação comercial da Loja 3D.

Validação: 17 testes focados de fichas, arquivos e seleção ativa; teste MySQL das migrations e estoque 3D; validação do manifesto do piloto; sintaxe da API; build de produção e trava contra dependência operacional do Supabase.

As flags operacionais da Loja 3D permanecem desligadas. A publicação disponibiliza o código e o painel para homologação, sem abrir automaticamente checkout, pagamentos ou produção ao público.
