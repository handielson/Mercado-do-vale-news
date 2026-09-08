# Mercado do Vale Entregas

Aplicativo Android próprio para entregadores vinculados à loja.

## Segurança e fonte de dados

- Login pela API VPS existente (`POST /auth/login`).
- O APK não contém `x-sync-key`, senha, token fixo ou credencial de banco.
- A lista usa `GET /delivery/app/jobs` e a API restringe os resultados ao cliente autenticado marcado como entregador.
- A operação reaproveita a tela oficial `/delivery/:token`, mantendo PIX, rota, comprovante e confirmação em uma única fonte de verdade.

## Identidade

- Nome: Mercado do Vale Entregas
- Pacote: `br.com.mercadodovale.entregas`
- Versão inicial: `1.0.0` (`versionCode 1`)

## Build

Requer JDK 17 e Android SDK 35. Opcionalmente informe `VPS_BASE_URL` e `WEB_BASE_URL` em propriedades Gradle.
