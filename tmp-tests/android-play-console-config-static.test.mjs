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
assert.match(buildGradle, /versionCode 104/, 'versionCode deve estar preparado para V1.04');
assert.match(buildGradle, /versionName '1\.04'/, 'versionName deve refletir V1.04');
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
assert.match(mainActivity, /PARTIAL_WAKE_LOCK/, 'app deve manter CPU\/rede ativas mesmo se a tela bloquear');
assert.match(mainActivity, /FLAG_KEEP_SCREEN_ON/, 'app deve tentar impedir bloqueio da tela durante exibicao');
assert.match(mainActivity, /fun getAppVersionName\(\): String/, 'ponte Android deve expor versionName ao display');
assert.match(mainActivity, /fun getAppVersionCode\(\): Int/, 'ponte Android deve expor versionCode ao display');

console.log('android play console config static checks passed');
