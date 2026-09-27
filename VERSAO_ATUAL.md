# v1.2.483-loja-3d-teste

Data: 27/09/2026. Status: preparada para publicacao. Branch destino: main.

Release: /var/www/mdv-site/releases/20260927-125730-v1483-loja-3d-teste

Tag: v1.2.483-loja-3d-teste

Loja 3D para testes, catalogo por site, entrada de 50 a 100 por cento e frete escolhido; checkout real desativado.

## Escopo

Vitrine /loja-3d, contas independentes preparadas, pedidos e producao em demonstracao, calculadora, campos3D e ofertas comerciais por site, banners isolados e protecoes entre canais. Entrada 50–100% de todos os produtos, frete no saldo/integral/proporcional.

## Banco e ativacao

Deploy seletivo com backup remoto privado aplica somente031/032/039, aditivas. Sem criar dados comerciais. Demais migrations aguardam homologacao/ativacao. Checkout/pagamento/producao/contas reais desligados; falta cancelamento e expiracao de reservas antes da ativacao financeira. Nao altera DNS, n8n, credenciais ou operacao fiscal.

Teste publico: https://www.mercadodovale.com.br/loja-3d?demo=1 e /loja-3d/pedidos?demo=1.

## Validacao

- testes focados 3D/auth/catalogo/estoque com banco e provedor simulados
- browser local isolado checkout e producao
- node --check entradas API e deploy
- assert-no-supabase-runtime
- npm run build
- regressoes publicadas: parcelamento e backup
- preflight VPS somente leitura e schema031/032/039

## Limitacoes

- TypeScript completo tem erros em areas legadas fora do escopo; build e testes focados passam.
- Contas, Google, WhatsApp, fichas privadas, producao e pagamento reais permanecem desligados.
- Migrations028-030,033-038,040-044 apenas preparadas; sem ativacao comercial ou DNS.
