# MDV Admin Estoque

Aplicativo Android nativo para consulta e movimentacao de estoque e impressao de etiquetas.

## Fontes oficiais

- Produtos e estoque: API VPS/MySQL existente.
- Sessao: `POST /auth/login`, com token bearer da VPS.
- Etiquetas: `GET/PATCH /admin/label-templates` como fonte central de formatos.

O aplicativo nunca incorpora `x-sync-key`, `VITE_VPS_SYNC_KEY`, Supabase ou credenciais de banco.

## Limites desta base

O adaptador da Marklife P50 e propositalmente uma interface: a P50 usa protocolo Bluetooth proprietario e precisa de validacao com uma impressora fisica antes de gerar comandos de impressao. O leitor QR tambem esta isolado em uma interface; a implementacao sera adicionada com CameraX/ML Kit na etapa de integracao.

## Compilacao

Requer JDK 17 e Android SDK Platform 35. Defina `VPS_BASE_URL` em `~/.gradle/gradle.properties` ou passe `-PVPS_BASE_URL=https://...` para apontar a API VPS autorizada. O valor padrao acompanha o painel web atual.
