# Shopee Sync Modal Design

**Context**

O modal de sincronizacao da Shopee hoje tem um fluxo rapido de 3 passos, mas ainda publica com um payload simplificado. Isso gera tres problemas práticos:

- o layout do passo "Dados" ficou apertado e pouco claro;
- o fluxo rapido nao aproveita bem fotos e video ja existentes no sistema;
- o payload de criacao envia `weight` como string, o que quebra o endpoint `add_item`.

**Objetivo**

Evoluir o modal rapido de sincronizacao para que ele:

- publique com payload valido para a Shopee;
- permita usar fotos e video cadastrados no sistema como midia da publicacao;
- mostre um layout mais claro, com resumo do produto e area de midia visiveis durante o preenchimento.

**Decisao**

Manter o modal rapido de 3 passos, mas alinhar o passo "Dados" e o passo de publicacao com o fluxo mais robusto ja existente no editor detalhado da Shopee.

**Abordagem**

1. Reaproveitar a logica de upload de imagens e video do fluxo detalhado, para o modal rapido publicar via `image_id_list` e `video_info.video_id_list`.
2. Corrigir o payload do `add_item` para enviar `weight` como numero.
3. Reorganizar o passo "Dados" em duas colunas:
   - coluna esquerda: resumo do produto, indicadores e midia selecionada;
   - coluna direita: atributos, estoque, preco, descricao e campos logisticos.
4. Usar como selecao inicial:
   - fotos de `product.images`;
   - video de `product.video_url`, quando existir.
5. Preservar fallback seguro:
   - sem video, publicar apenas com imagens;
   - sem token de Bling, nao bloquear o modal, mas evitar erro silencioso sempre que possivel.

**Arquivos Principais**

- `pages/admin/settings/ShopeePage.tsx`
  - modal rapido de sincronizacao;
  - layout do passo "Dados";
  - montagem do payload `add_item`;
  - selecao e upload de imagens/video.
- `pages/admin/settings/shopeeSyncDefaults.js`
  - defaults derivados de Bling/local.
- `api/shopee-catalog.ts`
  - endpoints de upload de imagem e video ja existentes; manter compatibilidade.

**Riscos e Cuidados**

- upload de video pode demorar mais do que o upload de imagem; o modal precisa mostrar estado de carregamento;
- algumas contas Shopee podem aceitar criacao sem video, mas nao sem imagem;
- o modal rapido e o editor detalhado compartilham conceitos, mas nao devem divergir no formato do payload.

**Validacao**

- publicar um item com imagens apenas;
- publicar um item com imagens + video;
- confirmar que `weight` e enviado como numero no payload;
- confirmar que o passo "Dados" continua funcional em telas menores.
