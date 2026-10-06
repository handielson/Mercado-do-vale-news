# v1.2.553-familias-imei

Data: 2026-10-06. Branch: main. Tag: v1.2.553-familias-imei.
Release VPS: /var/www/mdv-site/releases/20261006-034340-familias-imei

Familias organizadas por memoria e cor no painel. Nome publico usa sempre o pai. Painel separa aparelhos disponiveis, vendidos e ocultos. Ocultar preserva historico; reativar no PDV exige confirmacao e depois a confirmacao existente do IMEI. Vendidos e unidades vinculadas a pedidos nao podem ser reativados.

API publicada seletivamente, com backup das tres entradas de servidor e do helper, sem migrations ou alteracoes de parametros fiscais. Validacoes: testes de familia, agrupamento, identificadores, visibilidade, PDV, parcelamento, DANFE, patch seletivo e build com trava Supabase. Conferencia publica obrigatoria apos deploy.

Pendencias: validar gravacao e venda completa usando produto teste; aprovar piloto Poco X8 antes de aplicar familias aos demais modelos; revisar pais antigos vazios. Nenhum aparelho real sera reativado nem venda concluida nesta publicacao. Alteracoes locais anteriores de fiscal, estoque, calculadoras e outros modulos ficam fora desta release.

Publicacao concluida: commit de codigo 07a37ec5 enviado a origin/main; tag v1.2.553-familias-imei. API mdv-api online, mysql.ok=true. Backup: /var/www/mdv-api/backups/families-units-1791258501749. Home e VERSION HTTP 200; versao e release conferidos. Navegador autenticado confirmou painel agrupado, acesso a ocultos e PDV carregado. Dois rascunhos de ocultacao da previa local nao foram enviados a producao.
