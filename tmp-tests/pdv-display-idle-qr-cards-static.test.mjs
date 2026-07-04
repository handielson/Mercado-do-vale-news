import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const displayPage = readFileSync('pages/display/DisplayPage.tsx', 'utf8');
const displayTypes = readFileSync('types/pdvDisplay.ts', 'utf8');
const adminPage = readFileSync('pages/admin/settings/DisplaysPage.tsx', 'utf8');
const androidActivity = readFileSync('android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt', 'utf8');
const androidManifest = readFileSync('android/totem-pix/app/src/main/AndroidManifest.xml', 'utf8');

assert.match(displayPage, /publicCompanySettingsService/, 'display deve carregar logo e Instagram das configuracoes publicas');
assert.match(displayPage, /buildIdleQrCards/, 'display deve montar cards padrao de site, Instagram e Wi-Fi');
assert.match(displayPage, /type:\s*'site'/, 'display deve incluir card de site');
assert.match(displayPage, /type:\s*'instagram'/, 'display deve incluir card de Instagram');
assert.match(displayPage, /type:\s*'wifi'/, 'display deve incluir card de Wi-Fi');
assert.match(displayPage, /WIFI:T:\$\{escapeWifiQrValue\(card\.security\)\};S:\$\{escapeWifiQrValue\(card\.ssid\)\};P:\$\{escapeWifiQrValue\(card\.password\)\};;/, 'QR Wi-Fi deve usar formato padrao Android/iOS');
assert.match(displayPage, /bottom-4 left-4/, 'nome do display deve ficar no canto inferior esquerdo');
assert.doesNotMatch(displayPage, /message:\s*'Mercado do Vale'/, 'display nao deve usar Mercado do Vale como mensagem ociosa duplicada');
assert.doesNotMatch(displayPage, /<p className="mt-6 text-2xl text-slate-300">\{display\?\.name/, 'display nao deve mostrar nome do display no centro da tela ociosa');

assert.match(displayTypes, /wifi\?:\s*\{/, 'tipo de idle_content deve incluir bloco Wi-Fi opcional');
assert.match(displayTypes, /security:\s*'WPA'/, 'tipo Wi-Fi deve aceitar WPA como padrao');

assert.match(adminPage, /Configurar Wi-Fi/, 'admin deve expor configuracao de Wi-Fi do display');
assert.match(adminPage, /Captar rede pelo app Android/, 'admin deve orientar captura automatica de SSID pelo app');
assert.match(adminPage, /Confirmar senha/, 'admin deve pedir confirmacao de senha para reduzir erro');

assert.match(androidManifest, /ACCESS_WIFI_STATE/, 'app Android deve declarar permissao para ler estado Wi-Fi');
assert.match(androidManifest, /ACCESS_FINE_LOCATION/, 'app Android deve declarar permissao necessaria para SSID em Android moderno');
assert.match(androidActivity, /addJavascriptInterface/, 'app Android deve expor ponte JavaScript para o WebView');
assert.match(androidActivity, /getWifiSsid/, 'ponte Android deve oferecer metodo getWifiSsid');

console.log('pdv display idle QR cards static checks passed');
