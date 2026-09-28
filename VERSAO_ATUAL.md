# v1.2.493-hotfix-proxy-prazo-3d

Data: 2026-09-27. Status: pronta para publicação. Branch: main.
Tag: v1.2.493-hotfix-proxy-prazo-3d
Release: /var/www/mdv-site/releases/20260928-012920-v1-2-493-hotfix-proxy-prazo-3d

Hotfix de publicação: os runtimes do proxy VPS agora reconhecem como pública a criação de solicitações de prazo por quantidade para o Mercado do Vale e para a Loja 3D.

Sem essa permissão, o formulário público recebia `Admin required` antes de alcançar a rota da API. A liberação é restrita ao método `POST` e aos dois caminhos de vitrine previstos.

As regras implantadas na versão anterior permanecem: prazo e limite podem ficar em branco, solicitações não criam pedido ou cobrança, e o WhatsApp da Loja 3D continua isolado enquanto seu número próprio não for configurado.

Validação: sintaxe dos dois runtimes VPS, testes do proxy público, rotas de solicitação e pacote de implantação, além da verificação pública após o deploy.
