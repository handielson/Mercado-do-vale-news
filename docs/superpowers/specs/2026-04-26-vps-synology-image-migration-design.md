# Migração de imagens para VPS com Synology como legado

Data: 2026-04-26

## Objetivo

Concentrar as imagens públicas do Mercado do Vale na VPS (`api.xiaomipetrolina.com.br`) e retirar o Supabase Storage do caminho de entrega de imagens. O Supabase pode continuar existindo para dados/autenticação enquanto isso ainda for necessário, mas não deve permanecer como origem pública de imagens.

O Synology será mantido como ponto de legado, espelho e restauração. Ele não deve ser a fonte principal para carregamento público do site, porque sua disponibilidade depende de tunnel, rede local e integrações auxiliares.

## Problema atual

O Lighthouse mostra payload de rede elevado por causa de múltiplas origens de mídia:

- VPS/proxy próprio, incluindo `/api/bling?resource=image-proxy` e imagens de banner.
- Supabase Storage e tabelas com arrays de URLs de imagem, principalmente `model_color_images`.
- Imgur e URLs externas.
- Bling/S3 com proxy local.

Isso aumenta bytes transferidos, número de domínios, custo de conexão, risco de URL expirada e complexidade operacional.

## Resultado esperado

Ao final do processo:

- Toda imagem usada pelo site público deve apontar para a VPS.
- Novos uploads de banners, produtos e imagens institucionais devem ir para a VPS.
- Imagens herdadas do Supabase, Imgur, Bling/S3 ou Synology devem ser copiadas para a VPS antes de trocar URLs.
- O Synology deve guardar uma cópia de segurança/legado, sem bloquear a experiência pública.
- O Supabase Storage deve ficar sem dependência operacional para imagens.
- Lighthouse deve parar de listar Supabase Storage como grande origem de imagem.

## Escopo de mídia

Entram na migração:

- Imagens de produtos.
- Imagens padrão por modelo/cor (`model_color_images`).
- Banners do catálogo.
- Logo, favicon, marca d'água e imagens institucionais de `company_settings`.
- Imagens externas ainda usadas em cards, catálogo, landing pública ou admin quando afetam a experiência do cliente.

Ficam fora desta primeira etapa:

- PDFs e comprovantes legados, que já seguem fluxo de arquivos no Synology.
- Vídeos de produto, que continuam com fluxo específico de Synology/CDN.
- Remoção completa do Supabase como banco de dados.

## Arquitetura proposta

### Fonte canônica

A VPS será a fonte canônica de imagens públicas:

- Produtos: `https://api.xiaomipetrolina.com.br/images/products/...`
- Banners: `https://api.xiaomipetrolina.com.br/banners/...`
- Institucional/empresa: `https://api.xiaomipetrolina.com.br/images/company/...`
- Imagens migradas sem categoria clara: `https://api.xiaomipetrolina.com.br/images/legacy/...`

### Legado e backup

O Synology permanece como camada de legado/backup:

- Recebe cópia das imagens migradas quando possível.
- Mantém relatórios de correspondência `url_antiga -> url_vps`.
- Pode ser usado para restauração manual se uma imagem da VPS for perdida.

### Dados

O banco deve armazenar a URL da VPS como URL principal. URLs antigas só devem aparecer em relatório de migração ou campos explícitos de legado, nunca como primeira opção de renderização pública.

## Fluxo de migração

### Fase 1: auditoria sem escrita

Criar um auditor que varre as fontes conhecidas e gera relatório com:

- Total de imagens encontradas.
- Contagem por origem: VPS, Supabase Storage, Synology, Imgur, Bling/S3, base64/blob, externa, vazia/inválida.
- Lista de candidatos à migração.
- Campos afetados e entidade de origem.
- URLs potencialmente expiradas ou impossíveis de baixar.

Esta fase não altera banco nem arquivos.

### Fase 2: migrador em dry-run

Criar um migrador que simula:

- Download da imagem antiga.
- Nome final esperado na VPS.
- Entidade que seria atualizada.
- Ação de backup no Synology quando disponível.
- Riscos encontrados, como MIME desconhecido, arquivo muito grande, URL assinada expirada ou duplicidade.

O dry-run deve produzir um JSON/Markdown revisável antes do modo real.

### Fase 3: migração real

Com o relatório aprovado:

- Baixar cada imagem antiga.
- Salvar na VPS em pasta adequada.
- Opcionalmente espelhar no Synology.
- Atualizar a entidade para URL da VPS.
- Registrar `old_url`, `new_url`, entidade, campo, hash/tamanho quando disponível e status.

Falhas devem ser parciais e retomáveis. Um erro em uma imagem não deve parar toda a migração sem relatório.

### Fase 4: corte de fallback

Depois de validar os dados:

- Remover fallback de upload de banner para Supabase Storage.
- Impedir novos cadastros de imagem com URL Supabase como fonte principal.
- Ajustar helpers de mídia para preferirem URL VPS e só aceitarem legado em modo compatibilidade.
- Parar de usar `/api/bling?resource=image-proxy` para imagens já migradas.

### Fase 5: limpeza

Quando produção estiver validada:

- Gerar relatório final de URLs Supabase restantes.
- Remover ou arquivar objetos dos buckets de imagem do Supabase.
- Manter o relatório de restauração junto ao ponto de backup.

## Tratamento de erros

- URL inacessível: marcar como falha e manter URL antiga até intervenção.
- MIME inválido: bloquear migração daquele item e reportar.
- Duplicidade: reaproveitar arquivo já migrado quando hash ou URL original coincidir.
- Falha no Synology: não bloquear VPS; registrar que backup ficou pendente.
- Falha ao atualizar banco: manter arquivo na VPS e registrar item para retentativa.

## Testes e verificação

Antes de aplicar em produção:

- Testes unitários para classificador de origem de mídia.
- Testes do auditor com URLs representativas de VPS, Supabase, Synology, Imgur, Bling/S3, base64 e URLs inválidas.
- Build do frontend.
- Execução de auditoria em modo relatório.

Depois da migração:

- Reexecutar auditoria e confirmar zero URLs Supabase Storage em imagens públicas.
- Validar telas de catálogo, produto, banners, admin de imagens e tema.
- Conferir Lighthouse para payload de rede e origens listadas.
- Conferir que Synology segue acessível como backup/legado, mas não como fonte primária do site público.

## Critérios de aceite

- Relatório inicial mostra exatamente onde ainda há imagens fora da VPS.
- Migração real é retomável e registra sucesso/falha por item.
- Novos uploads relevantes salvam na VPS.
- Site público não depende de Supabase Storage para imagens.
- Synology preserva o papel de legado/backup.
- Nenhuma mudança apaga imagens antigas antes de validação e ponto de restauração.
