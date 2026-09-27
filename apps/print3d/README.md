# Vitrine 3D independente (local)


### Aplicação pública 3D independente — primeira entrada local

- `apps/print3d` contém HTML e entrada React próprios, reutilizando as telas canônicas de loja, conta, checkout, pedidos e produção. Não inicializa App/rotas/admin, analytics, favicon, cashback ou manutenção globais do Mercado do Vale.
- `npm run dev:print3d`: servidor exclusivo em `http://127.0.0.1:3002`. Prévia visual: `/?demo=1`. As APIs desse servidor respondem 503 por padrão; não há proxy para produção.
- `npm run build:print3d`: gera `dist-print3d`, separado de `dist`, sem copiar a pasta pública MDV nem ler seus arquivos `.env`. Clientes compartilhados de catálogo usam um adaptador sem sessão administrativa; as contas 3D conservam seu cliente próprio.
- Validação: build independente passou; Playwright móvel percorreu loja/conta e rejeitou `/admin/login`, com APIs interceptadas. Uma sessão MDV fictícia gravada no navegador não foi enviada, não houve chamada externa nem consultas globais MDV.
- Esta etapa não conclui a separação operacional: permanecem URLs com prefixo `/loja-3d`, gateway/proxy próprio com escopo de canal, callbacks/origens, domínio, SEO definitivo, implantação e homologação completa. O ERP e a prévia atual continuam disponíveis no build existente.


### Gateway local exclusivo da vitrine 3D

- `services/print3dPublicProxy.cjs` aplica lista explícita de rotas/métodos e parâmetros: catálogo publicado 3D, categorias compartilhadas, banners 3D, conta, frete, checkout, pedidos e produção do cliente. O servidor central continua validando sessão, preços e autorização.
- Rotas administrativas, CRUD genérico, outro canal, webhook, parâmetros duplicados e caminhos normalizados/escapados são recusados. Cookies, chaves sync e cabeçalhos de encaminhamento do navegador não são retransmitidos. Bearer só segue para rotas `/print3d/`.
- Configuração opcional de desenvolvimento: `PRINT3D_LOCAL_API_ORIGIN=http://127.0.0.1:<porta>` antes de `npm run dev:print3d`. Só aceita origem HTTP loopback explícita, sem credenciais/caminho. Sem variável, permanece 503. Nenhuma origem real foi configurada.
- Testes com dois servidores HTTP locais validaram encaminhamento, isolamento, limites de corpo e bloqueio de redirecionamento externo. Teste móvel da vitrine e build independente passaram.
- Pendente para implantação: proxy de produção com credencial própria e política de origem/IP confiável, callbacks Google e homologação ponta a ponta. O gateway local não se apresenta como proxy de produção concluído.


### Vitrine → gateway → API local: teste integrado de navegador

- Novo teste `node tmp-tests/print3d-standalone-gateway-browser.cjs` inicia API HTTP fixture e Vite em portas aleatórias, executa catálogo/conta/pedidos pelo proxy real e encerra somente seus processos. Chamadas locais não são interceptadas; rede externa é bloqueada.
- Reproduziu erro na tela do cliente: pedido cancelado ainda consultava a rota de pagamento, que corretamente recusava a operação. A tela agora limpa dados transitórios e não consulta pagamentos de pedidos cancelados, estornados ou com falha. Pedidos ativos continuam consultando normalmente.
- Verificados: catálogo não demo, sessão 3D fixture, navegação até pedidos, estados cancelado/estornado/falha/ativo, ausência de token MDV, bloqueio da rota administrativa e nenhum erro de execução.
- 11 testes focados e build independente passaram. Este teste usa respostas/credenciais fictícias de API, não autenticação real, MySQL ou gateway financeiro; essas integrações continuam exigindo homologação própria.


### Cadastro pela vitrine independente até MySQL local

- Teste opcional: definir `PRINT3D_MYSQL_ACCOUNT_BROWSER=1` e executar `npm run test:print3d:mysql`. O teste cria Vite/API em portas aleatórias, usa as rotas de contas reais e MySQL descartável e encerra os recursos próprios. Não usa sessão pré-fabricada para o cliente desse cenário.
- Confirmou formulário de cadastro por e-mail, conta inicialmente não verificada, confirmação pelo link capturado, login com senha real e restauração da sessão após recarregar. Nenhuma chamada externa permitida.
- Adicionada configuração explícita `PRINT3D_PUBLIC_TURNSTILE_SITE_KEY` no build separado, mapeada para a chave pública usada pelo cliente 3D. Segredo de validação continua somente no servidor; nenhum arquivo `.env` MDV é carregado.
- Teste integrado e build passaram. Widget CAPTCHA, validação no provedor e envio de e-mail são simulados; CAPTCHA/entrega reais permanecem pendentes de homologação.


### Cadastro WhatsApp pela interface até MySQL local

- Ampliado o modo `PRINT3D_MYSQL_ACCOUNT_BROWSER=1`: o navegador sai da conta de e-mail, cadastra outra conta somente com WhatsApp/CPF, recebe código pelo adaptador local, testa código incorreto e confirma o correto.
- Banco real descartável confirmou e-mail nulo, CPF correto e WhatsApp validado. A interface apresentou a confirmação após cadastro e após login separado por telefone e por CPF; sair removeu a sessão 3D.
- Teste integrado passou por vitrine independente → proxy HTTP local → rotas reais → MySQL, sem interceptar as APIs. CAPTCHA e transporte de mensagens continuam simulados; nenhum WhatsApp real ou alteração de n8n ocorreu.
