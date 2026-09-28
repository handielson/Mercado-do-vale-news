# Pendências consolidadas — Loja 3D

Atualizado em 27/09/2026.

Esta é a lista operacional vigente. O arquivo `CHECKLIST-LOJA-3D.md` permanece como histórico técnico detalhado das decisões, implementações e testes.

## Estado atual

- [x] Estrutura de banco 3D, migrations 028–052 e empresa operacional preparadas.
- [x] Vitrine 3D e painel administrativo publicados no site principal para homologação, com catálogo e ofertas por site; a aplicação e o domínio independentes ainda não foram publicados.
- [x] Contas, checkout, regra de entrada de 50% a 100%, produção parcial, saldo e expedição estão no código publicado, protegidos pelas flags operacionais desligadas.
- [x] Produtos 3D separados de IMEI e de grupos de preço de smartphones.
- [x] Arquivos privados no Synology organizados por SHA-256, com revisões, compartilhamento e verificação de integridade.
- [x] Caminho privado do Synology configurado na VPS.
- [x] Empresa, pagamento e estrutura fiscal central podem ser compartilhados operacionalmente, mantendo clientes, ofertas e comunicações separados por loja.
- [x] Versão `v1.2.490-ficha-3d-manual` publicada na VPS; site, Calculadora 3D, API e MySQL responderam corretamente após a implantação.
- [x] API reiniciada com empresa e caminho privado do Synology configurados.
- [x] Todas as flags operacionais 3D continuam desligadas em produção; a publicação não abriu vendas nem produção reais.

## 1. Produto piloto e dados reais

Estas tarefas liberam os primeiros testes reais e devem ser executadas antes das integrações externas.

- [ ] Definir a identidade visual final e confirmar o nome comercial da loja 3D.
- [ ] Selecionar de 3 a 5 produtos representativos: pronta entrega, somente encomenda, pedido misto e produto com variantes.
- [x] Inventariar candidatos existentes na pasta local de projetos próprios, sem copiar ou alterar os arquivos; resultado em `docs/print3d-pilot-candidates.md`.
- [x] Escolher o primeiro produto piloto: Suporte LNB 3x3, lote com 11 unidades completas e duas partes por unidade; manifesto em `docs/print3d-pilots/suporte-lnb-3x3/manifest.json`.
- [ ] Criar no cadastro central o produto piloto Suporte LNB 3x3, marcar como impressão 3D e confirmar o SKU vendável definitivo.
- [ ] Confirmar as categorias desses produtos em cada site; o mesmo SKU pode usar categorias diferentes.
- [ ] Cadastrar variantes reais de material, cor, tamanho, acabamento e acessórios, atribuindo um SKU único a cada combinação vendável.
- [x] Permitir cadastrar a ficha inteira manualmente quando a impressão não passou pelo programa, registrando essa origem na revisão e dispensando o arquivo JSON.
- [ ] Informar manualmente, para o piloto, material total e tempo total do lote de 11 pares; preencher também quantidade de peças, filamentos por cor, impressora, perfil, preparação, montagem, acabamento e perdas.
- [ ] Enviar STL/3MF/G-code e instruções reais ao Synology, selecionar a revisão ativa e executar a verificação de integridade.
- [ ] Conferir fotos, vídeo, descrição, peso e dimensões reais de cada variante.

## 2. Custos, insumos e capacidade

- [ ] Cadastrar filamentos reais por material, marca, cor, peso comprado e valor de aquisição.
- [ ] Cadastrar embalagens, peças para chaveiro, ímãs, parafusos, cola e demais insumos com suas unidades.
- [ ] Conferir tarifa de energia, potência e custo por hora de cada impressora.
- [ ] Conferir mão de obra, manutenção/depreciação, impostos, embalagem, perdas e margem desejada.
- [ ] Lançar e conferir os saldos físicos iniciais de filamentos e demais insumos; as tabelas operacionais ainda estão vazias.
- [ ] Definir capacidade diária, calendário de dias úteis, limite de encomendas e regra de atribuição de impressora/operador.
- [ ] Fazer uma impressão física piloto e comparar tempo, material e custo previstos com os realizados.

## 3. Estoque central compartilhado

Esta fase protege o Mercado do Vale e os demais canais antes de aceitar pedidos 3D reais.

- [ ] Corrigir e reconciliar o estoque legado: a última auditoria encontrou 2 produtos com saldo central negativo e 396 divergências entre o total central e os locais.
- [ ] Auditar os escritores restantes de estoque, especialmente IMEI/serializados, Bling, cargas iniciais, importações e eventos externos fora de ordem.
- [ ] Resolver a compatibilidade entre reservas por localização e a rotina de estoque serializado que recria locais.
- [ ] Conferir os saldos iniciais dos produtos piloto por localização.
- [ ] Testar simultaneamente os dois sites tentando reservar a última unidade do mesmo SKU.
- [ ] Testar pronta entrega, encomenda e pedido misto sem estoque negativo, reserva duplicada ou ordem duplicada.

## 4. Arquivos e backup do Synology

- [ ] Incluir a pasta privada `producao-3d` em uma política do Hyper Backup.
- [ ] Executar uma restauração de teste do banco e da pasta privada.
- [ ] Abrir a ficha restaurada e confirmar todos os arquivos pelo verificador de tamanho e SHA-256.

## 5. Separação dos dois sites

- [ ] Publicar a aplicação pública 3D com build, domínio, sessão, cookies, cache, SEO e configuração próprios.
- [ ] Concluir o registro do domínio 3D na janela de baixo movimento já planejada, verificando os demais domínios antes e depois da alteração no Registro.br.
- [ ] Configurar Cloudflare, HTTPS, redirecionamento para o domínio canônico, CORS e CSP da loja 3D.
- [ ] Validar preços, títulos, descrições, categorias, visibilidade e URLs diferentes para o mesmo SKU nos dois sites.
- [ ] Migrar as consultas de produto da Val/n8n para a oferta `mercado_do_vale`, incluindo busca, categoria, detalhes, variações e links.
- [ ] Confirmar que a Val não consulta nem revela clientes, pedidos, preços, links ou identidade da loja 3D.
- [ ] Validar o cadastro real de banners separado por site.

## 6. Cadastro, segurança e comunicações 3D

- [ ] Configurar SMTP e validar cadastro, confirmação e recuperação por e-mail no domínio 3D.
- [ ] Provisionar número, Evolution API e n8n exclusivos da loja 3D.
- [ ] Copiar apenas a lógica de envio de código do fluxo já validado, usando credenciais, webhook e armazenamento próprios; não copiar Val, memória ou contatos do Mercado do Vale.
- [ ] Validar cadastro inicial por e-mail ou WhatsApp, login por CPF ou telefone e senha, além da exigência de WhatsApp verificado para encomendas.
- [ ] Configurar Turnstile exclusivo da loja 3D e homologar bloqueio após tentativas de senha, espera de 15 minutos e recuperação imediata por canal cadastrado.
- [ ] Criar e configurar OAuth Google exclusivo da loja 3D, com callback e origens do domínio definitivo.
- [ ] Confirmar que a mesma pessoa pode possuir contas independentes nas duas lojas sem cruzar pedidos, aniversários, consentimentos ou campanhas.
- [ ] Configurar preferências e automações de comunicação próprias da loja 3D.

## 7. Frete, pagamento e fiscal

- [ ] Cadastrar e conferir embalagem e preparação reais para os produtos piloto.
- [ ] Homologar cotação real usando o mesmo CEP de origem e as transportadoras do Mercado do Vale.
- [ ] Configurar credenciais PIX exclusivas do fluxo 3D e a URL HTTPS do webhook.
- [ ] Homologar entrada de 50% a 100%, os três modos de frete, segunda cobrança, repetição de webhook e quitação antes do envio.
- [ ] Homologar expiração, cancelamento remoto, pagamento tardio, estorno integral/parcial e recuperação após timeout no provedor.
- [ ] Implementar a ação administrativa de solicitar e acompanhar estornos com trilha de auditoria.
- [ ] Validar emissão fiscal usando a mesma empresa, certificado e configuração fiscal já escolhidos.
- [ ] Integrar documento fiscal, etiqueta/rastreio e entrega à transportadora ao fluxo de expedição 3D.

## 8. Operação completa e experiência do cliente

- [ ] Testar pedido completo com arquivo correto, revisão imutável, custo histórico e prazo prometido.
- [ ] Testar produção parcial, rejeição, reimpressão, falta de material e conclusão repetida.
- [ ] Confirmar que administrador e cliente acompanham, por exemplo, 20 de 100 unidades produzidas.
- [ ] Confirmar que o cliente paga o saldo no momento permitido e que o sistema bloqueia envio com valor pendente.
- [ ] Validar fila por prazo/capacidade, atribuição de impressora e instruções para o operador.
- [ ] Validar celular, acessibilidade, filtros, carrinho, checkout, área do cliente e recuperação de sessão.
- [ ] Testar indisponibilidade do NAS, n8n, transportadora, SMTP, Google e gateway sem misturar dados nem duplicar operações.
- [ ] Testar acesso negado a arquivos, custos, clientes e pedidos por usuários sem permissão.

## 9. Piloto e publicação gradual

- [x] Criar backup integral, restaurá-lo em MySQL 8.4 descartável e homologar as migrations 028–051 antes de aplicá-las ao banco operacional.
- [x] Aplicar e validar a migration 052 dos arquivos compartilhados por SHA-256 com as funções desligadas.
- [x] Publicar os incrementos pela versão `v1.2.490-ficha-3d-manual`, usando o processo `publish-vps`.
- [x] Reiniciar a API em janela controlada e confirmar HTTP 200 com `mysql.ok=true`.
- [ ] Entrar no painel publicado com uma conta administrativa e homologar visualmente o preenchimento manual completo da ficha.
- [ ] Habilitar primeiro cadastro e leitura, depois arquivos, frete, produção, pagamentos, expedição e trabalhadores, uma flag por vez.
- [ ] Executar um pedido interno de ponta a ponta sem cliente real.
- [ ] Executar um piloto controlado com poucos SKUs e acompanhar estoque, custo, pagamentos, produção e fiscal.
- [ ] Verificar Mercado do Vale, bot, n8n, painel, Bling, marketplaces e estoque compartilhado após cada ativação.
- [ ] Registrar evidências, limitações, procedimento de reversão e instruções operacionais antes da abertura comercial.

## Ordem recomendada imediata

1. Cadastrar o Suporte LNB 3x3 como produto 3D e confirmar SKU, categoria e variante vendável.
2. Cadastrar filamento, energia, máquina, mão de obra, embalagem e demais insumos reais.
3. Preencher manualmente material, tempo, impressora, perfil e demais dados do lote piloto de 11 pares.
4. Habilitar somente fichas/arquivos em uma janela controlada, enviar os arquivos reais ao Synology, selecionar a revisão ativa e verificar sua integridade.
5. Conferir estoque inicial e reconciliar as divergências legadas antes de liberar qualquer checkout.
6. Executar localmente um pedido completo do produto piloto, incluindo reserva, pagamento simulado, produção parcial, saldo e expedição.
7. Homologar serviços externos: domínio, autenticação, WhatsApp, frete, PIX e fiscal.
8. Configurar backup/restauração dos arquivos, ativar uma flag por vez e executar o piloto controlado.

## Incremento: prazo sob consulta por quantidade

- [x] Implementar prazo editável por produto, usando `Prazo sob consulta` quando o campo ficar vazio.
- [x] Criar solicitação de prazo com quantidade, protocolo, registro no painel, status, prazo negociado e observação administrativa. A solicitação não cria pedido, reserva ou cobrança.
- [x] Manter o aviso do Mercado do Vale no canal administrativo existente e impedir que a Loja 3D use esse remetente como alternativa.
- [ ] Habilitar no n8n exclusivo da Loja 3D o evento `print3d_deadline_request` depois de cadastrar o novo número e a nova instância Evolution. Até lá, as solicitações ficam no painel com o aviso de WhatsApp aguardando configuração.
