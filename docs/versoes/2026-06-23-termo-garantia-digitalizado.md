# Termo de garantia digitalizado

## Objetivo

Permitir que o termo de garantia impresso e assinado seja fotografado, salvo no Synology e convertido automaticamente em PDF de 1 pagina, mantendo o comprovante disponivel na venda certa para cliente e administradores.

## Fluxo

- Admin abre a venda especifica e usa **Digitalizar termo assinado**.
- A tela aceita camera do celular/webcam ou arquivo de imagem JPEG/PNG.
- O sistema salva a imagem privada e gera um PDF A4 de 1 pagina.
- O registro ativo da venda mostra a mensagem: **Documento físico digitalizado, destruído e descartado em DD/MM/AAAA às HH:mm.**
- O cliente logado ve somente o PDF dentro da sua propria venda.
- O admin ve o PDF, pode baixar a imagem original e pode substituir o documento quando necessario.

## Synology

- Pasta privada sugerida/configurada: `termos-garantia`.
- Arquivos enviados diretamente nessa pasta tambem podem ser reconhecidos.
- Nome esperado para reconhecimento automatico: `termo-garantia-venda-{NUMERO}.jpg` ou `termo-garantia-venda-{NUMERO}.png`.
- O `{NUMERO}` deve ser o codigo visivel da venda com 8 caracteres, sem apelidos ou sufixos extras para evitar misturar documentos.
- Depois que um arquivo direto do Synology e processado e confirmado no banco, o arquivo de entrada pode ser apagado automaticamente pelo sincronizador.

## Variaveis de ambiente

- `SIGNED_WARRANTY_SYNOLOGY_FOLDER`: pasta privada no Synology. Padrao: `termos-garantia`.
- `SIGNED_WARRANTY_MAX_IMAGE_MB`: limite de imagem. Padrao: `15`.
- `SIGNED_WARRANTY_SYNC_INTERVAL_MS`: intervalo do sincronizador automatico. Padrao: `300000` ms, minimo de `60000` ms.

## Banco e dependencias

- Migration: `migrations/007_signed_warranty_documents.sql`.
- Tabela: `signed_warranty_documents`.
- Garante um documento ativo por venda e versoes separadas quando houver substituicao.
- Dependencias usadas para processamento: `sharp` para normalizar imagem e `pdf-lib` para gerar PDF.

## APIs

- `POST /admin/sales/:saleId/signed-warranty`: upload admin da imagem assinada.
- `GET /sales/:saleId/signed-warranty`: snapshot do documento da venda; para cliente retorna apenas o ativo e sem caminhos privados.
- `GET /signed-warranty/:id/pdf`: download privado do PDF para admin ou cliente dono da venda.
- `GET /admin/signed-warranty/:id/original`: download admin da imagem original.
- `POST /admin/signed-warranty/sync`: sincronizacao manual da pasta do Synology.

## Verificacao operacional

Check local:

```bash
npm run test:signed-warranty
node tmp-tests/signed-warranty-api-guarded-check.cjs
npm run build
```

O check de API e protegido por ambiente. Sem variaveis, ele apenas pula. Para validar contra um servidor real, informar:

```bash
SIGNED_WARRANTY_API_BASE_URL=https://seu-servidor
SIGNED_WARRANTY_CUSTOMER_TOKEN=token_cliente_dono_da_venda
SIGNED_WARRANTY_SALE_ID=id_da_venda
node tmp-tests/signed-warranty-api-guarded-check.cjs
```

Para tambem disparar a sincronizacao manual, informar `SIGNED_WARRANTY_ADMIN_TOKEN` e `SIGNED_WARRANTY_RUN_SYNC=1`.

## Rollback

- Remover/ocultar a secao de termo digitalizado nas telas de venda e historico do cliente.
- Desativar o sincronizador removendo a chamada agendada ou elevando `SIGNED_WARRANTY_SYNC_INTERVAL_MS`.
- Manter os arquivos no Synology e a tabela no banco ate confirmar que nenhum documento precisa ser consultado.
- Em rollback completo, remover as rotas novas e arquivar a tabela `signed_warranty_documents` antes de qualquer exclusao definitiva.
