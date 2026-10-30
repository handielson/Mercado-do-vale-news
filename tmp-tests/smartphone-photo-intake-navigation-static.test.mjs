import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isScannerValueComplete, nextScannerBurst, SCANNER_FAST_KEY_GAP_MS } from '../services/scannerFieldAdvance.mjs';

const productList = fs.readFileSync(new URL('../pages/admin/products/ProductListPage.tsx', import.meta.url), 'utf8');
const quickAccess = fs.readFileSync(new URL('../components/admin/dashboard/AdminQuickAccessGrid.tsx', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../routes/index.tsx', import.meta.url), 'utf8');
const intakePage = fs.readFileSync(new URL('../pages/admin/products/SmartphonePhotoIntakePage.tsx', import.meta.url), 'utf8');
const reviewCard = fs.readFileSync(new URL('../components/products/photo-intake/PhotoIntakeReviewCard.tsx', import.meta.url), 'utf8');
assert.match(reviewCard, /Versão comercial[\s\S]*<VersionSelect value=\{draft.detected_version/, 'conferencia deve oferecer versoes cadastradas');
assert.match(reviewCard, /specs: \{ ram: draft.detected_ram, storage: draft.detected_storage, version: draft.detected_version/, 'consulta deve usar a versao comercial selecionada');
assert.match(reviewCard, /detected_storage, draft.detected_version, priceRefresh\]/, 'trocar versao ou recarregar valores deve consultar novamente o preco');
assert.match(reviewCard, /detected_version: version,[\s\S]*prices_confirmed: false/, 'trocar versao deve exigir nova confirmacao');
assert.match(reviewCard, /const canFinalize[\s\S]*Boolean\(draft.prices_confirmed\)[\s\S]*draft.detected_version[\s\S]*intake.detected_version/, 'nao finalizar com versao local ainda nao salva e confirmada');
assert.match(reviewCard, /<SearchableSelect[\s\S]*options=\{sortedModels\.map\(model => model.id\)\}[\s\S]*onChange=\{setSelectedModelId\}[\s\S]*placeholder="Pesquisar modelo cadastrado/, 'modelo do sistema deve pesquisar por nome e preservar o ID selecionado');
assert.match(reviewCard, /onClick=\{\(\) => selectedModelId && void onAttachModel\(selectedModelId\)\}/, 'associacao continua explicita no botao');
// Guarda de UI acoplada ao JSX: ao mover os campos, mover esta verificacao com eles.
for (const input of reviewCard.matchAll(/<input\b[\s\S]*?\/>/g)) {
  if (/type="checkbox"/.test(input[0])) continue;
  for (const event of ['onFocus', 'onClick']) {
    assert.match(input[0], new RegExp(`${event}=\\{event => [\\s\\S]*?event\\.currentTarget\\.select\\(\\)`), `campos de texto devem selecionar todo o conteudo em ${event}`);
  }
}
assert.match(reviewCard, /detected_serial: 'detected_imei_1',[\s\S]*detected_imei_1: 'detected_imei_2',[\s\S]*detected_imei_2: 'detected_ean'/, 'bipes devem seguir serial, IMEI 1, IMEI 2 e EAN');
assert.match(reviewCard, /onKeyDown=\{NEXT_SCAN_FIELD\[field\.key\] \? event => handleScanKeyDown\(event, field\.key\)/, 'os campos devem avançar pelo terminador do leitor');
assert.match(reviewCard, /scanInputs\.current\[nextField\]\?\.focus\(\)/, 'o próximo campo deve receber foco');
assert.match(reviewCard, /isScannerValueComplete\(field, input\.value\)/, 'leitor sem Enter deve aguardar valor completo');
let burst = nextScannerBurst(null, 'detected_serial', 100);
for (let index = 1; index < 8; index++) burst = nextScannerBurst(burst, 'detected_serial', 100 + index * 20);
assert.equal(burst.count, 8, 'sequência rápida identifica um bipe sem sufixo');
assert.equal(nextScannerBurst(burst, 'detected_serial', burst.lastAt + SCANNER_FAST_KEY_GAP_MS + 1).count, 1, 'digitação lenta reinicia a detecção');
assert.equal(isScannerValueComplete('detected_serial', '82211/Y6U806689'), true);
assert.equal(isScannerValueComplete('detected_imei_1', '861106080748505'), true);
assert.equal(isScannerValueComplete('detected_imei_2', '86110608074851'), false, 'IMEI incompleto não deve pular');
assert.equal(isScannerValueComplete('detected_ean', '6939093017816'), false, 'EAN é a última etapa e não deve salvar sozinho');
assert.match(reviewCard, /SKU da nova variação \(opcional\)/, 'SKU manual deve ser opcional');
assert.match(reviewCard, /Deixe em branco para gerar automaticamente/, 'deve explicar a geração automática');
assert.doesNotMatch(reviewCard, /setSku\(intake\.detected_product_code/, 'codigo do fabricante nao pode virar SKU comercial');
const queue = fs.readFileSync(new URL('../components/products/photo-intake/PhotoIntakeQueue.tsx', import.meta.url), 'utf8');
const marginEditor = fs.readFileSync(new URL('../components/products/photo-intake/BrandMarginEditor.tsx', import.meta.url), 'utf8');
const intakeService = fs.readFileSync(new URL('../services/smartphonePhotoIntakeService.ts', import.meta.url), 'utf8');
const protectedPhoto = fs.readFileSync(new URL('../components/products/photo-intake/ProtectedIntakePhoto.tsx', import.meta.url), 'utf8');

assert.match(productList, /photo-intake[\s\S]*Smartphones por Foto/, 'Produtos deve exibir acesso ao cadastro por foto');
assert.match(quickAccess, /Smartphones por Foto[\s\S]*\/admin\/products\/photo-intake/, 'Dashboard deve exibir acesso rápido');
assert.match(routes, /path:\s*["']\/admin\/products\/photo-intake["']/, 'rota administrativa deve continuar publicada');
assert.match(intakePage, /colorService\.listActive\(\)[\s\S]*colorService\.refreshActive\(\)[\s\S]*colors=\{colors\}/, 'tela deve carregar e atualizar as cores estruturadas');
assert.match(reviewCard, /Cor do sistema[\s\S]*matched_color_id[\s\S]*Cadastrar nova cor/, 'conferência deve permitir mapear ou cadastrar a cor');
assert.doesNotMatch(reviewCard, /key: 'detected_color', label: 'Cor'/, 'cor não deve continuar como campo de texto livre');
assert.match(intakePage, /hasSamePriceGroup[\s\S]*matched_model_id[\s\S]*matched_color_id[\s\S]*detected_ram[\s\S]*detected_storage/, 'grupo de preço deve usar modelo, RAM, armazenamento e cor');
assert.match(reviewCard, /Aplicar aos \{matchingGroupCount\} aparelhos iguais[\s\S]*IMEIs e seriais permanecem individuais/, 'conferência deve oferecer aplicação dos preços ao grupo sem unir identificadores');
assert.match(intakeService, /confirm-group-prices/, 'frontend deve usar a confirmação transacional do grupo');
assert.match(reviewCard, /const confirmPrices = async \(\) => \{[\s\S]*const saved = await onUpdate\(\{ \.\.\.draft, prices_confirmed: false \}\);\s*if \(!saved\) return;[\s\S]*await onConfirmPrices/, 'alteracoes de cor/modelo devem ser salvas com sucesso antes da confirmacao de precos');
assert.match(reviewCard, /Conferi os dados, estão corretos[\s\S]*hasNonConfirmableIssues/, 'alertas confirmáveis devem oferecer confirmação manual explícita');
assert.match(reviewCard, /review_confirmed: false/, 'alterar um dado conferido deve invalidar a confirmação anterior');

assert.match(protectedPhoto, /onClick=\{\(\) => setZoomed\(true\)\}[\s\S]*Abrir foto da etiqueta em tamanho ampliado[\s\S]*ImageZoomModal[\s\S]*imageUrl=\{objectUrl\}/, 'foto protegida deve abrir em visualizacao ampliada sem expor uma URL publica');
assert.match(intakePage, /Agrupar iguais[\s\S]*groupedQueue\.items[\s\S]*groupSizeById/, 'fila deve oferecer agrupamento visual explicito');
assert.match(intakePage, /queueTab, setQueueTab\] = useState<'pending' \| 'completed'>\('pending'\)/, 'fila deve abrir somente com os pendentes');
assert.match(intakePage, /items\.filter\(item => queueTab === 'completed' \? item\.status === 'completed' : item\.status !== 'completed'\)/, 'abas devem separar concluidos pelo status canonico');
assert.match(intakePage, /Pendentes \(\{pendingCount\}\)[\s\S]*Disponíveis para venda \(\{completedCount\}\)/, 'abas devem mostrar os totais de aparelhos');
assert.match(intakePage, /!visibleItems\.some\(item => item\.id === selectedId\)[\s\S]*setSelectedId\(visibleItems\[0\]\?\.id \|\| null\)/, 'selecao deve permanecer dentro da aba ativa, inclusive quando vazia');
assert.match(intakePage, /setQueueTab\('completed'\);\s*setSelectedId\(finalizedNotice\.id\)/, 'ver aparelho salvo deve abrir a aba de concluidos');
assert.match(intakePage, /function sortPhotoIntakeQueue[\s\S]*left\.status === 'completed'[\s\S]*right\.status === 'completed'[\s\S]*created_at/, 'itens concluidos devem ficar abaixo dos aparelhos ainda pendentes, preservando a ordem por data');
assert.match(intakePage, /sortPhotoIntakeQueue\(\[item, \.\.\.without\]\)[\s\S]*sortPhotoIntakeQueue\(rows\)/, 'a prioridade dos pendentes deve valer ao atualizar e ao carregar a fila');
assert.match(intakePage, /const finalizeSelected = async \(sku\?: string\)[\s\S]*status !== 'completed'[\s\S]*setQueueTab\('pending'\);\s*setSelectedId\(nextPending\?\.id \|\| null\)/, 'ao salvar deve avançar para o próximo pendente ou deixar a fila vazia');
assert.match(intakePage, /sortPhotoIntakeQueue\(\[[\s\S]*updated,[\s\S]*items\.filter\(item => item\.id !== updated\.id\)/, 'aparelhos salvos devem permanecer no final da fila');
assert.match(intakePage, /function getQueueGroupKey[\s\S]*return photoQueueGroupKey\(item\)/, 'fila deve usar a regra de agrupamento testada com configurações reais');
assert.match(queue, /groupSize > 1[\s\S]*\{groupSize\} aparelhos/, 'fila deve mostrar a quantidade de aparelhos do grupo');
assert.match(queue, /Produto encontrado/, 'fila deve distinguir produto encontrado de aparelho concluído');
assert.doesNotMatch(queue, /truncate text-sm font-bold|mt-0\.5 truncate text-xs/, 'fila nao deve truncar modelo, memoria ou cor');
assert.match(queue, /break-words text-sm[\s\S]*break-words text-xs/, 'fila deve permitir quebra de linha para mostrar todos os dados');
assert.match(queue, /grid-cols-\[repeat\(auto-fill,minmax\(min\(100%,190px\),1fr\)\)\]/, 'fila deve quebrar os cards em novas linhas sem rolagem horizontal');
assert.match(queue, /onRequestRemove\(item\)[\s\S]*disabled=\{busy \|\| item\.status === 'analyzing'\}/, 'cada card deve oferecer exclusão individual sem interromper uma análise');
assert.match(queue, /\{selected && \([\s\S]*onClick=\{onGoToFields\}[\s\S]*Ir aos campos de preenchimento/, 'somente o aparelho selecionado deve oferecer o atalho para os campos');
assert.match(intakePage, /onGoToFields=\{goToSelectedFields\}[\s\S]*fieldsRef=\{fieldsRef\}/, 'o atalho da fila deve apontar para os campos do aparelho em conferência');
assert.match(intakePage, /fieldsRef\.current\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)[\s\S]*fieldsRef\.current\?\.focus\(\{ preventScroll: true \}\)/, 'o atalho deve rolar e posicionar o foco nos campos');
assert.match(reviewCard, /ref=\{fieldsRef\} tabIndex=\{-1\} className="scroll-mt-24[\s\S]*Dados identificados/, 'o destino do atalho deve ser a seção de preenchimento, depois da foto');
assert.match(intakePage, /role="alertdialog"[\s\S]*removeFromQueue\(pendingRemoval\)/, 'o X deve confirmar a exclusão do aparelho escolhido');
assert.match(intakePage, /setFinalizedNotice\(updated\)[\s\S]*setSelectedId\(nextPending\?\.id \|\| null\)/, 'a confirmação do aparelho salvo deve persistir ao avançar para o próximo');
assert.match(intakePage, /role="status" aria-live="polite"[\s\S]*Ver aparelho salvo/, 'aparelho cadastrado deve aparecer em aviso acessível com acesso ao registro concluído');
assert.doesNotMatch(intakePage, /lg:grid-cols-\[390px_minmax\(0,1fr\)\]/, 'a conferência não deve voltar para uma coluna lateral estreita');
assert.match(marginEditor, /type="search"[\s\S]*onChange=\{event => setSearch\(event\.target\.value\)\}/, 'margens devem filtrar automaticamente enquanto o usuario digita');
assert.match(marginEditor, /normalize\('NFD'\)[\s\S]*filteredBrands/, 'pesquisa deve ignorar acentos e caixa');
assert.match(marginEditor, /ACTIVE_FILTERS[\s\S]*INACTIVE_FILTERS[\s\S]*CONFIGURED_FILTERS[\s\S]*PENDING_FILTERS/, 'pesquisa inteligente deve reconhecer estados das margens');

console.log('smartphone photo intake navigation static test passed');
