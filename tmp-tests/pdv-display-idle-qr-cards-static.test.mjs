import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const displayPage = readFileSync('pages/display/DisplayPage.tsx', 'utf8');
const displayTypes = readFileSync('types/pdvDisplay.ts', 'utf8');
const adminPage = readFileSync('pages/admin/settings/DisplaysPage.tsx', 'utf8');
const routes = readFileSync('routes/index.tsx', 'utf8');
const updatePage = readFileSync('pages/store/TotemPixUpdatePage.tsx', 'utf8');
const androidActivity = readFileSync('android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt', 'utf8');
const androidManifest = readFileSync('android/totem-pix/app/src/main/AndroidManifest.xml', 'utf8');

assert.match(displayPage, /publicCompanySettingsService/, 'display deve carregar logo e Instagram das configuracoes publicas');
assert.match(displayPage, /import \* as ReactQRCode from 'react-qr-code'/, 'display deve importar react-qr-code como modulo para evitar componente objeto no build');
assert.match(displayPage, /\(ReactQRCode as any\)\.default\?\.QRCode/, 'display deve resolver o componente real do QR Code');
assert.match(displayPage, /buildIdleQrCards/, 'display deve montar cards padrao de site, Instagram e Wi-Fi');
assert.match(displayPage, /type:\s*'site'/, 'display deve incluir card de site');
assert.match(displayPage, /type:\s*'instagram'/, 'display deve incluir card de Instagram');
assert.match(displayPage, /type:\s*'wifi'/, 'display deve incluir card de Wi-Fi');
assert.match(displayPage, /WIFI:T:\$\{escapeWifiQrValue\(card\.security\)\};S:\$\{escapeWifiQrValue\(card\.ssid\)\};P:\$\{escapeWifiQrValue\(card\.password\)\};;/, 'QR Wi-Fi deve usar formato padrao Android/iOS');
assert.match(displayPage, /bottom-4 left-4/, 'nome do display deve ficar no canto inferior esquerdo');
assert.match(displayPage, /DISPLAY_APP_VERSION = 'V1\.19'/, 'display deve mostrar versao visual do aplicativo');
assert.match(displayPage, /getDisplayVersionLabel\(display\?\.name\)/, 'display deve mostrar versao ao lado do nome');
assert.match(displayPage, /fetch\('\/VERSION\.json', \{ cache: 'no-store' \}\)/, 'display deve buscar manifesto publico de versao sem cache');
assert.match(displayPage, /getTotemUpdateNotice\(versionInfo, nativeVersion\)/, 'display deve calcular aviso de atualizacao do app');
assert.match(displayPage, /Atualizacao disponivel/, 'display deve ter mensagem de atualizacao disponivel');
assert.match(displayPage, /whitespace-pre-line/, 'display deve preservar lista de melhorias na mensagem de atualizacao');
assert.match(displayPage, /TOTEM_UPDATE_HELP_URL/, 'display deve ter link de fallback para pagina propria de atualizacao');
assert.match(displayPage, /totem-pix\/atualizar/, 'display deve apontar para a pagina propria de atualizacao');
assert.match(displayPage, /Atualizar agora/, 'display deve mostrar botao de atualizacao');
assert.match(displayPage, /totem_pix_android\?\.update_url/, 'display deve aceitar URL de atualizacao do manifesto publico');
assert.match(displayPage, /getAppVersionName/, 'display deve ler versionName da ponte Android');
assert.match(displayPage, /getAppVersionCode/, 'display deve ler versionCode da ponte Android');
assert.match(displayPage, /function getStandalonePixCode[\s\S]*slice\(-6\)/, 'display deve gerar codigo curto para Pix avulso');
assert.match(displayPage, /return `PIX-\$\{getStandalonePixCode\(payment\)\}`/, 'display deve usar codigo PIX curto em vez da referencia tecnica');
assert.ok(
  displayPage.includes('Pix avulso #${orderNumber.replace(/^PIX-/i, \'\')}'),
  'display deve mostrar Pix avulso com codigo humano',
);
assert.doesNotMatch(displayPage, /message:\s*'Mercado do Vale'/, 'display nao deve usar Mercado do Vale como mensagem ociosa duplicada');
assert.doesNotMatch(displayPage, /<p className="mt-6 text-2xl text-slate-300">\{display\?\.name/, 'display nao deve mostrar nome do display no centro da tela ociosa');

assert.match(displayTypes, /wifi\?:\s*\{/, 'tipo de idle_content deve incluir bloco Wi-Fi opcional');
assert.match(displayTypes, /security:\s*'WPA'/, 'tipo Wi-Fi deve aceitar WPA como padrao');

assert.match(adminPage, /Configurar Wi-Fi/, 'admin deve expor configuracao de Wi-Fi do display');
assert.match(adminPage, /Captar rede pelo app Android/, 'admin deve orientar captura automatica de SSID pelo app');
assert.match(adminPage, /Confirmar senha/, 'admin deve pedir confirmacao de senha para reduzir erro');
assert.doesNotMatch(adminPage, /DISPLAY_APP_VERSION|V1\.\d+\s*-\s*\{display\.name\}/, 'admin nao deve prefixar displays com versao do app Android');

assert.match(androidManifest, /ACCESS_WIFI_STATE/, 'app Android deve declarar permissao para ler estado Wi-Fi');
assert.match(androidManifest, /ACCESS_FINE_LOCATION/, 'app Android deve declarar permissao necessaria para SSID em Android moderno');
assert.match(androidActivity, /addJavascriptInterface/, 'app Android deve expor ponte JavaScript para o WebView');
assert.match(androidActivity, /getWifiSsid/, 'ponte Android deve oferecer metodo getWifiSsid');
assert.match(androidActivity, /getAppVersionName/, 'ponte Android deve oferecer metodo getAppVersionName');
assert.match(androidActivity, /getAppVersionCode/, 'ponte Android deve oferecer metodo getAppVersionCode');
assert.match(androidActivity, /requestScreenSleep/, 'ponte Android deve oferecer metodo para dormir a tela fora do horario da loja');
assert.match(displayPage, /syncNativeDisplayPower/, 'display deve sincronizar estado de energia com o app Android');
assert.match(displayPage, /registerNativeDisplayToken/, 'display deve registrar token no app Android para monitoramento em segundo plano');
assert.match(displayPage, /showNativePaymentScreenNow/, 'display deve pedir ao app Android para reacender a tela quando houver Pix ativo');
assert.match(displayPage, /Modo Totem Pix[\s\S]*Sempre ativo/, 'display deve indicar que o Totem Pix fica sempre ativo');
assert.doesNotMatch(displayPage, /Horario da loja/, 'display nao deve mais usar horario da loja para apagar o Totem Pix dedicado');
assert.doesNotMatch(displayPage, /STORE_SLEEP_CHECK_INTERVAL_MS|getStoreStatus/, 'display nao deve agendar sono automatico por horario da loja');
const syncPowerBody = displayPage.match(/function syncNativeDisplayPower\(shouldStayAwake: boolean\): void \{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(syncPowerBody, /requestScreenSleep/, 'controle automatico de horario nao deve bloquear a tela e parar o polling de Pix');
assert.match(displayPage, /function requestSleepNow\(\)[\s\S]*requestScreenSleep/, 'botao manual Apagar tela deve continuar podendo bloquear a tela');
assert.match(displayPage, /Configuracoes do Totem/, 'display deve ter painel local de configuracoes do app');
assert.match(displayPage, /playPaymentSuccessTone/, 'display deve tocar som configuravel quando o Pix for aprovado');
assert.match(displayPage, /paymentSuccessVolume/, 'display deve salvar volume do som de pagamento aprovado');
assert.match(displayPage, /Volume do som/, 'painel deve permitir ajustar volume do som');
assert.match(displayPage, /Escolher toque do aparelho/, 'painel deve abrir seletor de toque do sistema Android');
assert.match(displayPage, /openAppUpdate/, 'botao de atualizacao deve chamar a ponte nativa do app quando existir');
assert.match(displayPage, /returnToAppHome/, 'painel deve chamar a ponte nativa para voltar para a tela inicial do app');
assert.match(displayPage, /Voltar para tela inicial do app/, 'painel deve ter botao visivel para voltar para o aplicativo');
assert.match(displayPage, /setDisplayAwake\?\.\(true\)[\s\S]*returnToAppHome/, 'voltar para o app deve reacender a tela antes de navegar');
assert.match(displayPage, /function ActionButton/, 'painel deve usar botoes com estado visual de acao');
assert.match(displayPage, /Aguarde\.\.\./, 'botoes do painel devem mostrar estado de processamento');
assert.match(displayPage, /Status atualizado\./, 'botao Atualizar status deve retornar mensagem de confirmacao');
assert.match(displayPage, /active:scale-95/, 'botoes do painel devem animar ao clicar');
assert.match(displayPage, /Administrador do dispositivo/, 'painel deve mostrar status da permissao de administrador');
assert.match(androidActivity, /playPaymentSuccessTone/, 'ponte Android deve expor som nativo de pagamento aprovado');
assert.match(androidActivity, /ACTION_RINGTONE_PICKER/, 'ponte Android deve abrir seletor de toque do aparelho');
assert.match(androidActivity, /openAppUpdate/, 'ponte Android deve abrir a Play Store para atualizar o app');
assert.match(androidActivity, /returnToAppHome/, 'ponte Android deve expor retorno para tela inicial do app');
assert.match(androidActivity, /registerDisplayToken/, 'ponte Android deve receber token do display para monitorar Pix nativamente');
assert.match(androidActivity, /showPaymentScreenNow/, 'ponte Android deve forcar tela Pix ativa quando houver cobranca');
assert.match(androidActivity, /private fun returnToAppHome\(\)[\s\S]*setDisplayAwake\(true\)/, 'retorno nativo deve reacender a tela para sair da tela preta');
assert.match(androidActivity, /FLAG_ACTIVITY_REORDER_TO_FRONT/, 'retorno ao app deve trazer a activity do totem para frente');
assert.match(androidActivity, /STREAM_MUSIC/, 'ponte Android deve tocar no canal de musica para respeitar volume audivel');
assert.match(androidActivity, /shouldOverrideUrlLoading/, 'ponte Android deve abrir atualizacao fora do WebView');
assert.match(routes, /path:\s*"\/totem-pix\/atualizar"/, 'rota publica de atualizacao do Totem Pix deve existir');
assert.match(updatePage, /App not available/, 'pagina de atualizacao deve orientar quando a Play Store negar acesso');
assert.match(updatePage, /play\.google\.com\/apps\/testing\/br\.com\.mercadodovale\.totempix/, 'pagina de atualizacao deve manter link de teste interno como acao secundaria');

console.log('pdv display idle QR cards static checks passed');
