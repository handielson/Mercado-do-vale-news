# v1.2.494-registro-rota-prazo-3d

Data: 2026-09-27. Status: pronta para publicação. Branch: main.
Tag: v1.2.494-registro-rota-prazo-3d
Release: /var/www/mdv-site/releases/20260928-013502-v1-2-494-registro-rota-prazo-3d

O runtime `vps_server.js`, executado pelo PM2 como `server.js`, agora registra a rota de solicitações de prazo e garante a criação da tabela correspondente durante a inicialização.

A validação em produção mostrou que a permissão do proxy já funcionava, mas o pedido chegava a uma rota não registrada e recebia `404`. O runtime alternativo já continha a implementação; esta versão mantém os dois sincronizados nessa função.

As regras permanecem: prazo e limite podem ficar em branco, solicitações não criam pedido ou cobrança, e o WhatsApp da Loja 3D continua isolado enquanto seu número próprio não for configurado.

Validação: sintaxe dos runtimes, teste que exige registro e migração nos dois arquivos implantáveis, rotas de solicitação, pacote de implantação e verificação pública após o deploy.
