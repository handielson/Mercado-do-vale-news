# v1.2.502-preview-manutencao-3dmv

Data: 2026-09-28. Status: pronta para publicação. Branch: main.
Tag: v1.2.502-preview-manutencao-3dmv
Release principal: /var/www/mdv-site/releases/20260928-163600-v1-2-502-preview-manutencao-3dmv
Release 3DMV: /var/www/print3d-site/releases/20260928-163600-v1-2-502-preview-manutencao-3dmv

A 3DMV permanece em manutenção para o público. O administrador pode abrir uma prévia autenticada pela tela **Configurações do site**, válida por duas horas e limitada à sessão da aba.

O acesso usa token assinado e verificado pela API. A prévia abre pelo mesmo domínio ativo do painel administrativo, permitindo os testes enquanto o DNS próprio da 3DMV ainda é concluído. Depois da validação, o token é removido do endereço e uma faixa amarela identifica a prévia.

Validações: testes de assinatura, expiração, adulteração, rotas e interface; verificação sintática dos servidores; builds principal e 3DMV.
