# Migração do endereço da loja 3D para gcode3d.com.br

Autorização: operador solicitou substituir 3dmv.com.br em todo o sistema e eliminar dependências do endereço antigo. Mesmo site, catálogo, banco e armazenamento; nome da marca 3DMV e identificadores internos preservados. Não habilitar contas, Google, pagamentos ou produção por causa desta troca.

## Estado externo verificado em 14/10/2026

Domínio registrado e pago por dois anos, status Publicado no Registro.br, expiração em 14/10/2028. Cloudflare: zona própria e0a7a641b1200a55cc971d48f867ae91, plano Free, A na raiz e em www para 76.13.232.162, ambos com proxy. Não existe CNAME para 3dmv.com.br. Robots gerenciado pela aplicação; sincronização adicional de preferências de bots desligada.

Registro.br salvou carlos.ns.cloudflare.com e jill.ns.cloudflare.com. Informou transição obrigatória de aproximadamente duas horas, iniciada perto de 16h11 (São Paulo); durante a transição, a delegação pública permanece nos DNS automáticos do Registro.br. Esse período bloqueia a validação pública/ACME do domínio; não declarar migração finalizada antes da liberação.

VPS: bootstrap HTTP somente para os novos hostnames instalado em /etc/nginx/sites-available/gcode3d-acme-bootstrap.conf, com webroot ACME /var/www/certbot e resposta 503 para o restante. Não altera a configuração do site antigo. Certbot 2.9.0 disponível. A loja atual usa certificado origin com nome api.xiaomipetrolina.com.br; o novo domínio terá certificado próprio.

Auditoria da API: nenhum valor de .env ou ambiente PM2 contém 3dmv.com.br. Nenhuma referência encontrada nas colunas de configuração de admin_preferences/company_settings/companies/print3d_storefront_settings. Contas, Google e verificação de telefone 3D estão desligados, public URL/callback Google e Turnstile ausentes. Preservar essas flags e credenciais; não criar novos fluxos de autenticação. Sessões do navegador têm origem própria e não migram entre os domínios.

## Fontes preparadas

Atualizados canonical, origem pública do build 3D, atalho administrativo, allowlist da página de ações de conta, origem padrão da API/contas/prévia, identificação do sitemap e CORS do Node/Nginx. O endereço antigo não é aceito como origem de aplicação no estado final. Arquivos históricos permanecem históricos.

Nginx final usa gcode3d.com.br → www.gcode3d.com.br, certificado próprio e /var/www/print3d-site/current. O bloco 3dmv.com.br/www.3dmv.com.br é somente um redirecionamento opcional para o novo domínio: sua remoção/cancelamento não interfere no bloco novo, certificado, DNS, API ou arquivos. Nada no endereço novo consulta ou utiliza o antigo.

## Conclusão após liberação do DNS

1. Confirmar delegação pública e zona Cloudflare ativa. Conferir A raiz/www sem endereços alheios. Não desativar segurança por tentativa.
2. Emitir certificado próprio na VPS com a conta ACME existente: `certbot certonly --webroot -w /var/www/certbot --cert-name gcode3d.com.br -d gcode3d.com.br -d www.gcode3d.com.br --non-interactive --keep-until-expiring`. Conferir SAN e renovação. Não aceitar avisos inseguros no navegador nem reutilizar o certificado do domínio antigo.
3. Seguir publish-vps e publicar API por `node deploy-vps-server-only.cjs --print3d-domain-check`, depois `--print3d-domain-only`. Patch preserva runtime alheio e diário; backup/checagem de sintaxe/readback/rollback reutilizam o publicador seletivo.
4. Publicar build principal e build independente 3D, com `PRINT3D_PUBLIC_ORIGIN=https://www.gcode3d.com.br` e nomes de releases da versão registrada. Só o site 3D define essa origem; não carregar secrets MDV no bundle público.
5. `APPLY_PRINT3D_NGINX=1 node scripts/install-print3d-site-nginx.cjs` aplica os vhosts finais, troca somente as duas origens CORS 3D da configuração API e desativa o bootstrap. Exige certificado, confere drift, preserva backups e restaura arquivos se nginx -t/reload falhar.
6. Na Cloudflare, SSL/TLS Full (strict) após certificado válido. Conferir HTTPS, canonical, produto, sitemap, robots, catálogo, permissões CORS, VERSION das duas releases e redirecionamentos com caminho/query preservados. Não enviar mensagens ou concluir compras em teste.
7. Varredura de bundles alcançáveis e fontes operacionais não deve encontrar URLs 3dmv.com.br. Validar o novo host diretamente na origem, sem consulta ao antigo. Conta/login em produção deve seguir a configuração existente, sem habilitar funcionalidades desligadas.

O site antigo permanece no ar até concluir DNS/HTTPS/publicação. Não cancelar o registro antigo antes de finalizar a migração e validar o novo endereço; o cancelamento não foi solicitado nesta etapa. Se a migração precisar ser revertida, restaurar código/vhosts e releases dos backups, preservando banco e dados.
