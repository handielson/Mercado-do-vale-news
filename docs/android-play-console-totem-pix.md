# Publicacao Google Play - Totem Pix

## App

- Nome sugerido: Totem Pix Mercado do Vale
- Package name: `br.com.mercadodovale.totempix`
- Version code: `108`
- Version name: `1.08`
- Target SDK: `35`
- Formato para upload: Android App Bundle (`.aab`)

## Build de release

O Google Play usa Android App Bundle para apps novos. Gere o bundle assinado com:

```powershell
cd android\totem-pix
gradle.bat bundleRelease
```

Arquivo esperado:

```text
android/totem-pix/app/build/outputs/bundle/release/app-release.aab
```

## Assinatura

Crie `android/totem-pix/keystore.properties` a partir de `keystore.properties.example`.

Nao commitar:

- `keystore.properties`
- `*.jks`
- senhas da chave

## Play Console

Fluxo recomendado para o primeiro envio:

1. Criar app no Play Console.
2. Escolher app, gratis, idioma padrao `pt-BR`.
3. Aceitar Play App Signing.
4. Enviar `app-release.aab` em Teste interno.
5. Preencher ficha da loja.
6. Preencher privacidade/conteudo.
7. Adicionar testers e instalar pela Play Store.

## Declaracoes importantes

O app usa:

- Internet: abre o display web do Mercado do Vale.
- Estado do Wi-Fi: permite captar o nome da rede no app.
- Localizacao precisa: exigida pelo Android para ler SSID da rede Wi-Fi em versoes modernas.
- Wake lock: mantem CPU/rede ativas para o totem continuar recebendo Pix mesmo se a tela bloquear.

Na Data Safety do Google Play, declarar a permissao de localizacao conforme o uso real. Se a captura automatica de SSID nao for necessaria para a versao publica, considere remover `ACCESS_FINE_LOCATION` para reduzir revisao e friccao.
