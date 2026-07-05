import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const buildGradle = readFileSync('android/totem-pix/app/build.gradle', 'utf8');
const gitignore = readFileSync('.gitignore', 'utf8');
const playDoc = readFileSync('docs/android-play-console-totem-pix.md', 'utf8');
const keystoreExample = readFileSync('android/totem-pix/keystore.properties.example', 'utf8');
const androidManifest = readFileSync('android/totem-pix/app/src/main/AndroidManifest.xml', 'utf8');
const mainActivity = readFileSync('android/totem-pix/app/src/main/java/br/com/mercadodovale/totempix/MainActivity.kt', 'utf8');

assert.match(buildGradle, /applicationId 'br\.com\.mercadodovale\.totempix'/, 'package name deve ser estavel para Google Play');
assert.match(buildGradle, /targetSdk 35/, 'targetSdk deve atender a exigencia atual do Google Play');
assert.match(buildGradle, /versionCode 113/, 'versionCode deve estar preparado para V1.13');
assert.match(buildGradle, /versionName '1\.13'/, 'versionName deve refletir V1.13');
assert.match(buildGradle, /keystore\.properties/, 'release signing deve ler keystore.properties local');
assert.match(buildGradle, /storeFile rootProject\.file/, 'keystore deve ser resolvida relativa a raiz do projeto Android');
assert.match(buildGradle, /signingConfig signingConfigs\.release/, 'build release deve usar signingConfig release');

assert.match(gitignore, /android\/totem-pix\/keystore\.properties/, 'senha da keystore nao deve entrar no Git');
assert.match(gitignore, /android\/totem-pix\/\*\.jks/, 'arquivo da keystore nao deve entrar no Git');
assert.match(keystoreExample, /storeFile=totem-pix-upload-key\.jks/, 'exemplo deve documentar a chave de upload');
assert.match(playDoc, /app-release\.aab/, 'documentacao deve indicar o AAB para Play Console');
assert.match(androidManifest, /android:icon="@mipmap\/ic_launcher"/, 'app deve declarar icone no launcher Android');
assert.match(androidManifest, /android:roundIcon="@mipmap\/ic_launcher_round"/, 'app deve declarar icone redondo no launcher Android');
assert.match(androidManifest, /WAKE_LOCK/, 'app deve declarar WAKE_LOCK para manter rede ativa no totem');
assert.match(androidManifest, /BIND_DEVICE_ADMIN/, 'app deve declarar receiver de administrador para apagar a tela no fechamento');
assert.match(mainActivity, /PARTIAL_WAKE_LOCK/, 'app deve manter CPU\/rede ativas mesmo se a tela bloquear');
assert.match(mainActivity, /FLAG_KEEP_SCREEN_ON/, 'app deve tentar impedir bloqueio da tela durante exibicao');
assert.match(mainActivity, /requestScreenSleep/, 'ponte Android deve permitir apagar a tela quando a loja estiver fechada');
assert.match(mainActivity, /setDisplayAwake/, 'ponte Android deve voltar a manter a tela ligada quando a loja abrir');
assert.match(mainActivity, /DevicePolicyManager/, 'app deve usar DevicePolicyManager para bloqueio imediato quando autorizado');
assert.match(mainActivity, /playPaymentSuccessTone/, 'ponte Android deve tocar som de pagamento aprovado');
assert.match(mainActivity, /ToneGenerator/, 'app deve usar som nativo para confirmacao de pagamento');
assert.match(mainActivity, /volumePercent/, 'som nativo deve receber volume configurado pelo display');
assert.match(mainActivity, /STREAM_MUSIC/, 'som nativo deve usar canal de musica para ficar audivel no totem');
assert.match(mainActivity, /ACTION_RINGTONE_PICKER/, 'app deve permitir escolher toque do sistema para pagamento aprovado');
assert.match(mainActivity, /MediaPlayer/, 'app deve tocar toque escolhido respeitando volume configurado');
assert.match(mainActivity, /fun getAppVersionName\(\): String/, 'ponte Android deve expor versionName ao display');
assert.match(mainActivity, /fun getAppVersionCode\(\): Int/, 'ponte Android deve expor versionCode ao display');
assert.match(mainActivity, /shouldOverrideUrlLoading/, 'WebView deve interceptar links externos de atualizacao');
assert.match(mainActivity, /market:\/\/details\?id=\$appPackageName/, 'atualizacao deve tentar abrir a Play Store pelo aplicativo do aparelho');
assert.match(mainActivity, /play\.google\.com\//, 'WebView deve abrir links do Google Play fora do display');
assert.match(mainActivity, /returnToAppHome/, 'ponte Android deve permitir voltar para tela inicial do app');
assert.match(mainActivity, /FLAG_ACTIVITY_REORDER_TO_FRONT/, 'retorno ao app deve trazer a activity do totem para frente');

console.log('android play console config static checks passed');
