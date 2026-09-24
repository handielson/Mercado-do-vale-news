# v1.2.469-nfce-homologation

Data: 24/09/2026
Status: ready
Branch: main
Tag: v1.2.469-nfce-homologation
Release VPS: /var/www/mdv-site/releases/20260924-214500-nfce-homologation

## Alterações

- NFC-e modelo 65 apenas em homologação: prévia da venda, sequência própria, XML assinado e validado, transmissão manual única, consulta de tentativa incerta e DANFE de teste após autorização.
- CSC de homologação criptografado e separado do ambiente de produção.
- OP01 da matriz exige ICMS, PIS e COFINS confirmados explicitamente. A preparação fiscal exige revisão atual por contador com acesso ativo; o recorte atual só aceita CSOSN 400, PIS 07, COFINS 07 e alíquotas zero.
- PDV distingue comprovante comercial do DANFE fiscal e permite imprimir apenas a NFC-e de homologação já autorizada.
- Migração 026 cria sequência e tentativas separadas por ambiente sem alterar vendas ou números do Bling.

## Limites

- Emissão real continua bloqueada. Depende de credenciamento e CSC de produção, implementação fiscal para as alíquotas efetivas, homologação da operação e corte controlado da numeração.
- O emissor de testes atende apenas venda presencial paga da empresa principal, sem descontos, com pagamento em dinheiro e itens com cadastro fiscal completo.
- A revisão e os códigos ainda estão pendentes na base de produção. Nenhuma nota foi enviada à SEFAZ nesta publicação.

## Validação

- `npm run test:company-fiscal`
- `npm run test:company-fiscal:mysql`
- `node deploy-vps-server-only.cjs --nfce-homologation-check`
- `npm run build`
- `git diff --check`
