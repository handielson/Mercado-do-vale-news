import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CurrencyInput } from '../../../components/ui/CurrencyInput';
import { ProductWorkspaceNav } from '../../../components/products/ProductWorkspaceNav';
import { QuickCostSimulator } from '../../../components/print3d/QuickCostSimulator';
import {
  emptyPrint3dCostSettings,
  print3dCostSettingsService,
  type Print3dCostSettings,
} from '../../../services/print3dCostSettings';
import { calculatePrint3dCost } from '../../../utils/print3dCost.mjs';
import { parsePrint3dSummary } from '../../../utils/print3dImport.mjs';
import { buildPrint3dRecipeDraft } from '../../../utils/print3dRecipeDraft.mjs';
import { productService } from '../../../services/products';
import { categoryService } from '../../../services/categories';
import { stockLocationService } from '../../../services/stockLocationService';
import { print3dRecipesService, type Print3dActiveRecipe, type Print3dRecipeDraft, type Print3dRecipeSummary } from '../../../services/print3dRecipes';
import { print3dRecipeFilesService, type Print3dFileKind, type Print3dRecipeFile } from '../../../services/print3dRecipeFiles';
import type { Product } from '../../../types/product';

type FilamentUse = { filamentId: string; consumedGrams: number };
type SupplyUse = { supplyId: string; quantity: number };
type PrintInputMode = 'manual' | 'json';
type CostResult = ReturnType<typeof calculatePrint3dCost>;
type StockSnapshot = {
  productId: string;
  productName: string;
  stockQuantity: number;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  trackInventory: boolean;
  productionDays: number;
  isPrint3d: boolean;
  preorderEnabled: boolean;
  preorderLimit: number | null;
};

const numberClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const newId = () => crypto.randomUUID();

export function Print3dCostPage() {
  const [searchParams] = useSearchParams();
  const selectedProductId = searchParams.get('product_id')?.trim() || '';
  const [settings, setSettings] = useState<Print3dCostSettings>(emptyPrint3dCostSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [inputMode, setInputMode] = useState<PrintInputMode>('manual');
  const [materialGrams, setMaterialGrams] = useState(0);
  const [printMinutes, setPrintMinutes] = useState(0);
  const [pieces, setPieces] = useState(1);
  const [laborMinutes, setLaborMinutes] = useState(0);
  const [printerName, setPrinterName] = useState('');
  const [productionProfile, setProductionProfile] = useState('');
  const [materialIncludesWaste, setMaterialIncludesWaste] = useState<boolean | null>(null);
  const [productionNotes, setProductionNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [filamentUses, setFilamentUses] = useState<FilamentUse[]>([]);
  const [supplyUses, setSupplyUses] = useState<SupplyUse[]>([]);
  const [result, setResult] = useState<CostResult | null>(null);
  const [sku, setSku] = useState('');
  const [revision, setRevision] = useState('r1');
  const [exporting, setExporting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [recipeEnabled, setRecipeEnabled] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<Print3dRecipeSummary[]>([]);
  const [listedProductId, setListedProductId] = useState('');
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [filesEnabled, setFilesEnabled] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [recipeFiles, setRecipeFiles] = useState<Print3dRecipeFile[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<Print3dActiveRecipe | null>(null);
  const [primaryFileId, setPrimaryFileId] = useState('');
  const [selectingActive, setSelectingActive] = useState(false);
  const [fileKind, setFileKind] = useState<Print3dFileKind>('model');
  const [printerProfile, setPrinterProfile] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [verifyingFiles, setVerifyingFiles] = useState(false);
  const [stockSnapshot, setStockSnapshot] = useState<StockSnapshot | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [workspaceProduct, setWorkspaceProduct] = useState<Product | null>(null);
  const packagingSupplies = () => settings.packagingCentsPerPiece > 0
    ? [{ id: 'packaging-per-piece', name: 'Embalagem por peça', unitLabel:'un', quantity: pieces, unitCostCents: settings.packagingCentsPerPiece }]
    : [];

  useEffect(() => {
    let mounted = true;
    print3dCostSettingsService.get()
      .then((data) => {
        if (!mounted) return;
        setSettings(data);
        if (data.filaments[0]) setFilamentUses([{ filamentId: data.filaments[0].id, consumedGrams: 0 }]);
      })
      .catch(() => { if (mounted) setError('Não foi possível carregar os custos cadastrados.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    print3dRecipesService.status()
      .then(({ enabled }) => setRecipeEnabled(enabled))
      .catch(() => setRecipeEnabled(false));
    print3dRecipeFilesService.status()
      .then(({ enabled }) => setFilesEnabled(enabled))
      .catch(() => setFilesEnabled(false));
  }, []);

  const editSettings = (patch: Partial<Print3dCostSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setSettingsDirty(true);
    setResult(null);
    setNotice('');
  };

  const editFilamentUses = (next: FilamentUse[]) => {
    setFilamentUses(next);
    setResult(null);
  };

  const editSupplyUses = (next: SupplyUse[]) => {
    setSupplyUses(next);
    setResult(null);
  };

  const useManualInput = () => {
    setInputMode('manual');
    setFileName('');
    setNotice('Preenchimento manual selecionado. Informe os valores totais do lote e confira todos os campos.');
    setError('');
    setResult(null);
  };

  const editManualSummary = (field: 'material' | 'time', value: number) => {
    setInputMode('manual');
    setFileName('');
    setResult(null);
    if (field === 'material') {
      setMaterialGrams(value);
      setFilamentUses((current) => current.length === 1 ? [{ ...current[0], consumedGrams:value }] : current);
    } else setPrintMinutes(value);
  };

  const importJson = async (file?: File) => {
    if (!file) return;
    setError('');
    setResult(null);
    try {
      if (file.size > 1024 * 1024) throw new Error('O JSON excede 1 MB.');
      const summary = parsePrint3dSummary(await file.text());
      setInputMode('json');
      setMaterialGrams(summary.materialGrams);
      setPrintMinutes(summary.printMinutes);
      setFileName(file.name);
      setFilamentUses((current) => current.length === 1
        ? [{ ...current[0], consumedGrams: summary.materialGrams }]
        : current);
      setNotice('Material e tempo importados. Confira o filamento, as peças e os demais insumos.');
    } catch (cause) {
      setFileName('');
      setMaterialGrams(0);
      setPrintMinutes(0);
      setFilamentUses((current) => current.map((item) => ({ ...item, consumedGrams: 0 })));
      setError(cause instanceof Error ? cause.message : 'Não foi possível ler o JSON.');
    }
  };

  const saveSettings = async () => {
    setError('');
    setNotice('');
    if (!(settings.printerWatts > 0) || !(settings.energyCentsPerKwh > 0) ||
        !Number.isFinite(settings.machineCentsPerHour) || settings.machineCentsPerHour < 0 ||
        !Number.isFinite(settings.laborCentsPerHour) || settings.laborCentsPerHour < 0 ||
        !Number.isSafeInteger(settings.packagingCentsPerPiece) || settings.packagingCentsPerPiece < 0 ||
        !Number.isFinite(settings.taxPercent) || settings.taxPercent < 0 || settings.taxPercent >= 100 ||
        settings.filaments.some((item) => !item.name.trim() || !item.color.trim() || !(item.spoolGrams > 0) || !(item.spoolCostCents > 0)) ||
        settings.supplies.some((item) => !item.name.trim() || !(item.unitCostCents > 0) || !String(item.unitLabel || 'un').trim() || String(item.unitLabel || 'un').length > 40)) {
      setError('Confira potência, energia, insumos, embalagem e imposto (de 0 a menos de 100%).');
      return;
    }
    setSaving(true);
    try {
      await print3dCostSettingsService.save(settings);
      setSettingsDirty(false);
      setNotice('Custos salvos no sistema.');
    } catch {
      setError('Não foi possível salvar os custos. Confira a conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const calculate = () => {
    setError('');
    setNotice('');
    try {
      if (settingsDirty) throw new Error('Salve os custos cadastrados antes de calcular.');
      if (!(materialGrams > 0) || !(printMinutes > 0)) throw new Error('Informe material e tempo da impressão manualmente ou importe o JSON.');
      if (!printerName.trim() || !productionProfile.trim()) throw new Error('Informe a impressora e o perfil de impressão usados.');
      if (materialIncludesWaste === null) throw new Error('Informe se o material total inclui suportes e purga.');
      if (!(settings.printerWatts > 0) || !(settings.energyCentsPerKwh > 0)) throw new Error('Cadastre potência da impressora e tarifa de energia.');
      if (filamentUses.length === 0) throw new Error('Selecione ao menos um filamento.');
      const gramsSum = filamentUses.reduce((sum, item) => sum + item.consumedGrams, 0);
      if (Math.abs(gramsSum - materialGrams) > 0.001) {
        throw new Error('A soma dos gramas por filamento deve ser igual ao material total informado.');
      }
      const filaments = filamentUses.map((item) => {
        const source = settings.filaments.find((filament) => filament.id === item.filamentId);
        if (!source) throw new Error('Um filamento selecionado não está mais no cadastro.');
        return { consumedGrams: item.consumedGrams, spoolGrams: source.spoolGrams, spoolCostCents: source.spoolCostCents };
      });
      const supplies = supplyUses.map((item) => {
        const source = settings.supplies.find((supply) => supply.id === item.supplyId);
        if (!source) throw new Error('Um insumo selecionado não está mais no cadastro.');
        return { quantity: item.quantity, unitCostCents: source.unitCostCents };
      });
      setResult(calculatePrint3dCost({
        pieces, printMinutes, filaments, supplies: [...supplies, ...packagingSupplies()], laborMinutes,
        taxPercent: settings.taxPercent,
        printerWatts: settings.printerWatts,
        energyCentsPerKwh: settings.energyCentsPerKwh,
        machineCentsPerHour: settings.machineCentsPerHour,
        laborCentsPerHour: settings.laborCentsPerHour,
      }));
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'Não foi possível calcular.');
    }
  };

  const prepareDraft = async () => {
    if (!result || settingsDirty) throw new Error('Calcule novamente o custo antes de gerar a ficha.');
    const product = await productService.getBySku(sku);
    if (!product) throw new Error('SKU não encontrado no cadastro de produtos.');
    if (product.is_parent) throw new Error('Escolha o SKU de uma variante vendável, não o produto pai.');
    return buildPrint3dRecipeDraft({
        productId: product.id, productName: product.name,
        sku: product.sku, revision, materialGrams, printMinutes, pieces, laborMinutes, cost: result,
        inputSource:inputMode, printerName, printerProfile:productionProfile,
        materialIncludesSupportsAndPurge:materialIncludesWaste, productionNotes, sourceUrl,
        rates: {
          printerWatts: settings.printerWatts,
          energyCentsPerKwh: settings.energyCentsPerKwh,
          machineCentsPerHour: settings.machineCentsPerHour,
          laborCentsPerHour: settings.laborCentsPerHour,
          taxPercent: settings.taxPercent,
        },
        filaments: filamentUses.map((use) => ({
          ...settings.filaments.find((item) => item.id === use.filamentId),
          consumedGrams: use.consumedGrams,
        })),
        supplies: [...supplyUses.map((use) => ({
          ...settings.supplies.find((item) => item.id === use.supplyId),
          quantity: use.quantity,
        })), ...packagingSupplies()],
    });
  };

  const downloadDraft = (draft: Print3dRecipeDraft) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${draft.sku}-${draft.revision}-ficha-3d-rascunho.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportDraft = async () => {
    setError('');
    setNotice('');
    setExporting(true);
    try {
      const draft = await prepareDraft();
      downloadDraft(draft);
      setNotice(`Rascunho exportado. Pasta privada sugerida: ${draft.suggestedPrivateFolder}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível exportar a ficha.');
    } finally {
      setExporting(false);
    }
  };

  const saveDraft = async () => {
    setError('');
    setNotice('');
    setSavingDraft(true);
    try {
      const draft = await prepareDraft();
      const saved = await print3dRecipesService.save(draft);
      setNotice(saved.saved
        ? `Ficha ${saved.revision} salva para ${draft.sku}. Identificador: ${saved.id}`
        : `Ficha ${saved.revision} já estava salva com o mesmo conteúdo.`);
      try {
        const [listing, active] = await Promise.all([
          print3dRecipesService.list(draft.productId), print3dRecipesService.active(draft.productId),
        ]);
        setSavedRecipes(listing.recipes);
        setActiveRecipe(active.activeRecipe);
        setListedProductId(draft.productId);
        setSelectedRecipeId('');
        setPrimaryFileId('');
        setRecipeFiles([]);
      } catch {
        setSavedRecipes([]);
        setActiveRecipe(null);
        setListedProductId('');
        setNotice(`Ficha ${saved.revision} salva, mas a lista não pôde ser atualizada. Consulte as revisões novamente.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a ficha.');
    } finally {
      setSavingDraft(false);
    }
  };

  const loadRecipes = async (targetSku = sku) => {
    setError('');
    setLoadingRecipes(true);
    try {
      const product = await productService.getBySku(targetSku);
      if (!product) throw new Error('SKU não encontrado no cadastro de produtos.');
      if (product.is_parent) throw new Error('Escolha o SKU de uma variante vendável.');
      setWorkspaceProduct(product);
      const [listing, active] = await Promise.all([
        print3dRecipesService.list(product.id), print3dRecipesService.active(product.id),
      ]);
      setSavedRecipes(listing.recipes);
      setActiveRecipe(active.activeRecipe);
      setListedProductId(product.id);
      setSelectedRecipeId('');
      setPrimaryFileId('');
      setRecipeFiles([]);
    } catch (cause) {
      setSavedRecipes([]);
      setActiveRecipe(null);
      setListedProductId('');
      setSelectedRecipeId('');
      setPrimaryFileId('');
      setRecipeFiles([]);
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar as fichas.');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const loadStockSnapshot = async (targetSku = sku) => {
    setError('');
    setLoadingStock(true);
    try {
      const product = await productService.getBySku(targetSku);
      if (!product || product.is_parent) throw new Error('Escolha o SKU de uma variante vendável.');
      setWorkspaceProduct(product);
      const [distribution, category] = await Promise.all([
        stockLocationService.getProductStockDistribution(product.id),
        product.category_id ? categoryService.getById(product.category_id) : Promise.resolve(null),
      ]);
      const physicalQuantity = distribution.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
      const reservedQuantity = distribution.reduce((sum, row) => sum + Number(row.reserved_quantity || 0), 0);
      setStockSnapshot({
        productId: product.id, productName: product.name,
        stockQuantity: Number(product.stock_quantity || 0), physicalQuantity, reservedQuantity,
        availableQuantity: Math.max(0, physicalQuantity - reservedQuantity),
        trackInventory: product.track_inventory,
        productionDays: Number(product.production_days ?? category?.production_days ?? 0),
        isPrint3d: Boolean(product.is_print3d),
        preorderEnabled: Boolean(product.print3d_preorder_enabled),
        preorderLimit: product.print3d_preorder_limit ?? null,
      });
    } catch (cause) {
      setStockSnapshot(null);
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o estoque do SKU.');
    } finally {
      setLoadingStock(false);
    }
  };

  const downloadSavedRecipe = async (item: Print3dRecipeSummary) => {
    setError('');
    try {
      const response = await print3dRecipesService.get(listedProductId, item.revision);
      downloadDraft(response.draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível baixar a ficha.');
    }
  };

  const selectRecipe = async (item: Print3dRecipeSummary) => {
    setError('');
    setSelectedRecipeId('');
    setRecipeFiles([]);
    setPrimaryFileId('');
    try {
      const listing = await print3dRecipeFilesService.list(item.id);
      setSelectedRecipeId(item.id);
      setRecipeFiles(listing.files);
      setPrimaryFileId(activeRecipe?.recipe_id === item.id ? activeRecipe.primary_file_id : '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar os arquivos.');
    }
  };

  const uploadRecipeFile = async () => {
    if (!selectedRecipeId || !pendingFile) return;
    setError('');
    setNotice('');
    setUploadingFile(true);
    try {
      const outcome = await print3dRecipeFilesService.upload(selectedRecipeId, fileKind, pendingFile, printerProfile);
      setNotice(outcome.saved ? 'Arquivo enviado ao Synology e vinculado à revisão.' : 'Este arquivo já estava vinculado à revisão.');
      setPendingFile(null);
      setFileInputKey((current) => current + 1);
      try {
        const listing = await print3dRecipeFilesService.list(selectedRecipeId);
        setRecipeFiles(listing.files);
      } catch {
        setNotice('Arquivo vinculado à revisão, mas a lista não pôde ser atualizada. Abra Arquivos novamente.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setUploadingFile(false);
    }
  };

  const downloadRecipeFile = async (file: Print3dRecipeFile) => {
    setError('');
    try {
      const blob = await print3dRecipeFilesService.download(file.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível baixar o arquivo.');
    }
  };

  useEffect(() => {
    if (!selectedProductId || loading) return;
    let active = true;
    productService.getById(selectedProductId)
      .then(async (product) => {
        if (!active) return;
        if (product.is_parent) throw new Error('A produção 3D deve ser vinculada a um SKU vendável, não ao produto pai.');
        setWorkspaceProduct(product);
        setSku(product.sku);
        await Promise.all([loadRecipes(product.sku), loadStockSnapshot(product.sku)]);
        if (active && window.location.hash === '#ficha-producao-3d') {
          window.requestAnimationFrame(() => document.getElementById('ficha-producao-3d')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o produto 3D.'); });
    return () => { active = false; };
  }, [selectedProductId, loading]);

  const verifyRecipeFiles = async () => {
    if (!selectedRecipeId) return;
    setError('');
    setNotice('');
    setVerifyingFiles(true);
    try {
      const response = await print3dRecipeFilesService.verifyIntegrity(selectedRecipeId);
      if (!response.verified) throw new Error('Um ou mais arquivos não conferem com o registro da ficha.');
      setNotice(`${response.files.length} arquivo(s) conferido(s) no Synology por tamanho e SHA-256.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível verificar os arquivos no Synology.');
    } finally {
      setVerifyingFiles(false);
    }
  };

  const selectActiveRecipe = async () => {
    if (!listedProductId || !selectedRecipeId || !primaryFileId) return;
    setError('');
    setNotice('');
    setSelectingActive(true);
    try {
      const outcome = await print3dRecipesService.selectActive(listedProductId, selectedRecipeId, primaryFileId);
      setActiveRecipe(outcome.activeRecipe);
      setNotice(outcome.changed ? 'Ficha principal selecionada para futuras produções.' : 'Esta ficha já estava selecionada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível selecionar a ficha.');
    } finally {
      setSelectingActive(false);
    }
  };

  if (loading) return <div className="p-6 text-slate-600">Carregando custos de impressão 3D...</div>;
  const selectedRecipe = savedRecipes.find((item) => item.id === selectedRecipeId);

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <header>
      <h1 className="text-2xl font-bold text-slate-900">Produção, custos e arquivos 3D</h1>
      <p className="mt-1 text-sm text-slate-600">Calcule o custo, salve revisões de produção e mantenha os arquivos de impressão ligados ao SKU correto.</p>
    </header>
    {workspaceProduct && <ProductWorkspaceNav productId={workspaceProduct.id} sku={workspaceProduct.sku} active="production" />}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</div>}

    <QuickCostSimulator settings={settings} />

    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Custos cadastrados</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Potência média da impressora (W)
          <input className={numberClass} type="number" min="0" step="any" value={settings.printerWatts} onChange={(event) => editSettings({ printerWatts: Number(event.target.value) })} />
        </label>
        <CurrencyInput label="Energia por kWh" value={settings.energyCentsPerKwh} onChange={(value) => editSettings({ energyCentsPerKwh: value })} />
        <CurrencyInput label="Uso da máquina por hora" value={settings.machineCentsPerHour} onChange={(value) => editSettings({ machineCentsPerHour: value })} />
        <CurrencyInput label="Mão de obra por hora" value={settings.laborCentsPerHour} onChange={(value) => editSettings({ laborCentsPerHour: value })} />
        <CurrencyInput label="Embalagem por peça" value={settings.packagingCentsPerPiece} onChange={(value) => editSettings({ packagingCentsPerPiece: value })} />
        <label className="text-sm">Imposto estimado sobre a venda (%)<input className={numberClass} type="number" min="0" max="99.99" step="0.01" value={settings.taxPercent} onChange={(event) => editSettings({ taxPercent: Number(event.target.value) })} /></label>
      </div>
      <p className="text-xs text-slate-600">Referências iniciais editáveis: máquina R$ 1,00/h e mão de obra R$ 20,00/h. São hipóteses de simulação, não índices oficiais. Valores já salvos, inclusive zero, são preservados. A máquina cobre desgaste/manutenção; energia é calculada separadamente. Mão de obra usa apenas os minutos de trabalho manual.</p>
      <button type="button" className="text-sm text-violet-700 underline" onClick={() => editSettings({ machineCentsPerHour: 100, laborCentsPerHour: 2000 })}>Usar referências iniciais de máquina e mão de obra</button>
      <p className="text-xs text-slate-600">Embalagem é multiplicada pelas peças do lote e incluída nos insumos da ficha. Não cadastre a mesma embalagem novamente em outros insumos. Caixa de envio coletiva pode ser lançada em outros insumos pela quantidade usada no lote. Informe sua alíquota efetiva; zero significa sem provisão de imposto.</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Filamentos</h3><button className="rounded-lg border px-3 py-1 text-sm" onClick={() => editSettings({ filaments: [...settings.filaments, { id: newId(), name: '', color: '', spoolGrams: 1000, spoolCostCents: 0 }] })}>Adicionar filamento</button></div>
        {settings.filaments.map((item) => <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_1.5fr_auto]" key={item.id}>
          <input aria-label="Nome do filamento" placeholder="Material e marca" className={numberClass} value={item.name} onChange={(e) => editSettings({ filaments: settings.filaments.map((current) => current.id === item.id ? { ...current, name: e.target.value } : current) })} />
          <input aria-label="Cor do filamento" placeholder="Cor" className={numberClass} value={item.color} onChange={(e) => editSettings({ filaments: settings.filaments.map((current) => current.id === item.id ? { ...current, color: e.target.value } : current) })} />
          <input aria-label="Peso do rolo em gramas" title="Peso do rolo em gramas" className={numberClass} type="number" min="0" step="any" value={item.spoolGrams} onChange={(e) => editSettings({ filaments: settings.filaments.map((current) => current.id === item.id ? { ...current, spoolGrams: Number(e.target.value) } : current) })} />
          <CurrencyInput label="Preço do rolo" value={item.spoolCostCents} onChange={(value) => editSettings({ filaments: settings.filaments.map((current) => current.id === item.id ? { ...current, spoolCostCents: value } : current) })} />
          <button className="text-sm text-red-700" onClick={() => editSettings({ filaments: settings.filaments.filter((current) => current.id !== item.id) })}>Remover</button>
        </div>)}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Outros insumos</h3><button className="rounded-lg border px-3 py-1 text-sm" onClick={() => editSettings({ supplies: [...settings.supplies, { id: newId(), name: '', unitLabel:'un', unitCostCents: 0 }] })}>Adicionar insumo</button></div>
        {settings.supplies.map((item) => <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[2fr_5rem_1fr_auto]" key={item.id}>
          <input aria-label="Nome do insumo" placeholder="Ex.: argola para chaveiro" className={numberClass} value={item.name} onChange={(e) => editSettings({ supplies: settings.supplies.map((current) => current.id === item.id ? { ...current, name: e.target.value } : current) })} />
          <input aria-label="Unidade do insumo" placeholder="un, g, ml" maxLength={40} className={numberClass} value={item.unitLabel ?? 'un'} onChange={(e) => editSettings({ supplies: settings.supplies.map((current) => current.id === item.id ? { ...current, unitLabel:e.target.value } : current) })} />
          <CurrencyInput label="Preço por unidade" value={item.unitCostCents} onChange={(value) => editSettings({ supplies: settings.supplies.map((current) => current.id === item.id ? { ...current, unitCostCents: value } : current) })} />
          <button className="text-sm text-red-700" onClick={() => editSettings({ supplies: settings.supplies.filter((current) => current.id !== item.id) })}>Remover</button>
        </div>)}
      </div>
      <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void saveSettings()}>{saving ? 'Salvando...' : 'Salvar custos'}</button>
    </section>

    <section id="ficha-producao-3d" className="scroll-mt-6 space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Simular impressão</h2>
      <div className="grid gap-2 rounded-lg bg-slate-100 p-1 sm:grid-cols-2" role="group" aria-label="Origem dos dados de impressão">
        <button type="button" onClick={useManualInput} className={`rounded-md px-4 py-2 text-sm font-semibold ${inputMode === 'manual' ? 'bg-white text-violet-800 shadow-sm' : 'text-slate-600'}`}>Preencher todos os dados manualmente</button>
        <button type="button" onClick={() => { setInputMode('json'); setResult(null); setNotice('Selecione o JSON gerado pelo programa. Impressora, perfil e demais dados continuam manuais.'); }} className={`rounded-md px-4 py-2 text-sm font-semibold ${inputMode === 'json' ? 'bg-white text-violet-800 shadow-sm' : 'text-slate-600'}`}>Importar material e tempo do JSON</button>
      </div>
      {inputMode === 'json' ? <label className="block text-sm">JSON da impressão
        <input className="mt-1 block w-full text-sm" type="file" accept=".json,application/json" onChange={(e) => void importJson(e.target.files?.[0])} />
      </label> : <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">Use esta opção quando a impressão não passou pelo programa. Os valores ficam registrados na ficha como entrada manual e não exigem arquivo JSON.</p>}
      {fileName && <p className="text-sm text-slate-600">Arquivo lido: {fileName}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">Material total do lote (g)<input className={numberClass} type="number" min="0" step="any" value={materialGrams} onChange={(e) => editManualSummary('material', Number(e.target.value))} /></label>
        <label className="text-sm">Tempo total do lote (min)<input className={numberClass} type="number" min="0" step="any" value={printMinutes} onChange={(e) => editManualSummary('time', Number(e.target.value))} /></label>
        <label className="text-sm">Peças produzidas no lote<input className={numberClass} type="number" min="1" step="1" value={pieces} onChange={(e) => { setPieces(Number(e.target.value)); setResult(null); }} /></label>
        <label className="text-sm">Mão de obra manual (min)<input className={numberClass} type="number" min="0" step="any" value={laborMinutes} onChange={(e) => { setLaborMinutes(Number(e.target.value)); setResult(null); }} /></label>
        <label className="text-sm">Impressora usada<input className={numberClass} maxLength={120} value={printerName} onChange={(e) => { setPrinterName(e.target.value); setResult(null); }} placeholder="Ex.: Bambu Lab A1" /></label>
        <label className="text-sm">Perfil de impressão<input className={numberClass} maxLength={160} value={productionProfile} onChange={(e) => { setProductionProfile(e.target.value); setResult(null); }} placeholder="Ex.: PLA · bico 0,4 mm · camada 0,20 mm" /></label>
        <label className="text-sm">O material total inclui suportes e purga?
          <select className={numberClass} value={materialIncludesWaste === null ? '' : materialIncludesWaste ? 'yes' : 'no'} onChange={(e) => { setMaterialIncludesWaste(e.target.value === '' ? null : e.target.value === 'yes'); setResult(null); }}>
            <option value="">Selecione</option><option value="yes">Sim, já estão incluídos</option><option value="no">Não, serão informados separadamente</option>
          </select>
        </label>
        <label className="text-sm md:col-span-2">Observações de produção<textarea className={`${numberClass} min-h-24`} maxLength={1000} value={productionNotes} onChange={(e) => { setProductionNotes(e.target.value); setResult(null); }} placeholder="Montagem, orientação, acabamento, cuidados e conferências." /></label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Consumo por filamento</h3><button className="rounded-lg border px-3 py-1 text-sm" onClick={() => editFilamentUses([...filamentUses, { filamentId: settings.filaments[0]?.id ?? '', consumedGrams: 0 }])}>Adicionar cor/material</button></div>
        {filamentUses.map((item, index) => <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]" key={index}>
          <select aria-label={`Filamento ${index + 1}`} className={numberClass} value={item.filamentId} onChange={(e) => editFilamentUses(filamentUses.map((current, i) => i === index ? { ...current, filamentId: e.target.value } : current))}><option value="">Selecione</option>{settings.filaments.map((filament) => <option key={filament.id} value={filament.id}>{filament.name} · {filament.color}</option>)}</select>
          <input aria-label={`Gramas do filamento ${index + 1}`} className={numberClass} type="number" min="0" step="any" value={item.consumedGrams} onChange={(e) => editFilamentUses(filamentUses.map((current, i) => i === index ? { ...current, consumedGrams: Number(e.target.value) } : current))} />
          <button className="text-sm text-red-700" onClick={() => editFilamentUses(filamentUses.filter((_, i) => i !== index))}>Remover</button>
        </div>)}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Complementos usados no lote</h3><button className="rounded-lg border px-3 py-1 text-sm" onClick={() => editSupplyUses([...supplyUses, { supplyId: settings.supplies[0]?.id ?? '', quantity: 0 }])}>Adicionar insumo</button></div>
        {supplyUses.map((item, index) => <div className="grid gap-2 md:grid-cols-[2fr_1fr_auto]" key={index}>
          <select aria-label={`Insumo ${index + 1}`} className={numberClass} value={item.supplyId} onChange={(e) => editSupplyUses(supplyUses.map((current, i) => i === index ? { ...current, supplyId: e.target.value } : current))}><option value="">Selecione</option>{settings.supplies.map((supply) => <option key={supply.id} value={supply.id}>{supply.name}</option>)}</select>
          <input aria-label={`Quantidade do insumo ${index + 1}`} className={numberClass} type="number" min="0" step="any" value={item.quantity} onChange={(e) => editSupplyUses(supplyUses.map((current, i) => i === index ? { ...current, quantity: Number(e.target.value) } : current))} />
          <button className="text-sm text-red-700" onClick={() => editSupplyUses(supplyUses.filter((_, i) => i !== index))}>Remover</button>
        </div>)}
      </div>
      <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={calculate}>Calcular custo</button>
      {result && <div className="rounded-lg bg-slate-50 p-4">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p>Filamentos: <strong>{money(result.filamentCents)}</strong></p>
          <p>Energia: <strong>{money(result.energyCents)}</strong></p>
          <p>Máquina: <strong>{money(result.machineCents)}</strong></p>
          <p>Mão de obra: <strong>{money(result.laborCents)}</strong></p>
          <p>Outros insumos: <strong>{money(result.suppliesCents - settings.packagingCentsPerPiece * pieces)}</strong></p>
          <p>Embalagens: <strong>{money(settings.packagingCentsPerPiece * pieces)}</strong></p>
        </div>
        <div className="mt-3 flex flex-wrap gap-6 border-t pt-3 text-lg font-bold"><p>Lote: {money(result.batchCents)}</p><p>Por peça: {money(result.unitCents)}</p></div>
        <div className="mt-3 border-t pt-3 text-sm space-y-2"><p>Provisão de imposto ({result.taxPercent}%): <strong>{money(result.estimatedTaxCents)}</strong></p><p>Mínimo para cobrir custo e imposto: <strong>{money(result.minimumBatchSaleCents)} por lote · {money(result.minimumUnitSaleCents)} por peça</strong></p><p>Estimativa sem lucro, frete ou taxas de venda. Fórmula: custo ÷ (1 − imposto / 100). O arredondamento por peça pode aumentar o total.</p></div>
      </div>}
      <p className="text-xs text-slate-600">Confira também perdas e reimpressões, suportes/purga não incluídos no JSON, acabamento, taxas de pagamento/marketplace, frete subsidiado e rateio de despesas fixas. Estes não são acrescentados automaticamente. Lucro deve ser definido na formação do preço de cada site.</p>
    </section>
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Ficha de produção — rascunho</h2>
      <p className="text-sm text-slate-600">O SKU será conferido no cadastro. A ficha salva é imutável: para mudar parâmetros, use outra revisão. Arquivos e seleção da ficha principal exigem o módulo privado habilitado.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">SKU do produto vendável<input className={numberClass} value={sku} onChange={(event) => { setSku(event.target.value); setSavedRecipes([]); setListedProductId(''); setSelectedRecipeId(''); setRecipeFiles([]); setActiveRecipe(null); setPrimaryFileId(''); setStockSnapshot(null); }} placeholder="Ex.: CHAVEIRO-01" /></label>
        <label className="text-sm">Revisão<input className={numberClass} value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Ex.: r1" /></label>
        <label className="text-sm md:col-span-2">Link de origem do projeto <span className="font-normal text-slate-500">(opcional)</span><input className={numberClass} type="url" maxLength={1000} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://makerworld.com/... ou https://www.printables.com/..." /><span className="mt-1 block text-xs text-slate-500">Referência privada da revisão para localizar a página original. Não é exibida automaticamente no site.</span></label>
      </div>
      <div className="flex flex-wrap gap-3">
        <button disabled={!sku.trim() || loadingStock} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => void loadStockSnapshot()}>{loadingStock ? 'Consultando saldo...' : 'Consultar estoque e prazo'}</button>
        <button disabled={!result || settingsDirty || exporting || savingDraft} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void exportDraft()}>{exporting ? 'Conferindo SKU...' : 'Exportar ficha em JSON'}</button>
        <button disabled={!recipeEnabled || !result || settingsDirty || exporting || savingDraft} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void saveDraft()}>{savingDraft ? 'Salvando ficha...' : 'Salvar rascunho no sistema'}</button>
        <button disabled={!recipeEnabled || !sku.trim() || loadingRecipes} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => void loadRecipes()}>{loadingRecipes ? 'Consultando...' : 'Consultar revisões'}</button>
      </div>
      {stockSnapshot && <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
        <h3 className="font-semibold">Estoque central · {stockSnapshot.productName}</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span>Peças físicas nos locais: <strong>{stockSnapshot.physicalQuantity}</strong></span>
          <span>Reservadas: <strong>{stockSnapshot.reservedQuantity}</strong></span>
          <span>Saldo livre nos locais: <strong>{stockSnapshot.availableQuantity}</strong></span>
          <span>Prazo cadastrado: <strong>{stockSnapshot.productionDays} dias úteis</strong></span>
          <span>Encomendas: <strong>{stockSnapshot.preorderEnabled ? `configuradas (limite ${stockSnapshot.preorderLimit ?? 'não informado'})` : 'desativadas'}</strong></span>
        </div>
        {!stockSnapshot.isPrint3d && <p className="font-medium text-amber-800">Marque este SKU como impressão 3D no cadastro do produto.</p>}
        <p className="text-slate-600">O estoque das peças prontas é o mesmo dos demais canais. O prazo cadastrado não libera vendas sob encomenda até a reserva de produção e o checkout estarem integrados.</p>
        {!stockSnapshot.trackInventory && <p className="font-medium text-amber-800">Este SKU não monitora estoque. Ative o controle antes de vender peças prontas em vários canais.</p>}
        {stockSnapshot.physicalQuantity !== stockSnapshot.stockQuantity && <p className="font-medium text-amber-800">Saldo do produto ({stockSnapshot.stockQuantity}) diverge da soma dos locais ({stockSnapshot.physicalQuantity}); confira a distribuição antes de vender.</p>}
        <Link className="text-blue-700 underline" to={`/admin/products/${stockSnapshot.productId}`}>Abrir cadastro para ajustar quantidade e prazo</Link>
      </div>}
      {!recipeEnabled && <p className="text-sm text-amber-700">Salvamento indisponível até a tabela de revisões e o módulo 3D serem ativados na API. A exportação local continua disponível.</p>}
      {listedProductId && <div className="space-y-2 border-t pt-4">
        <h3 className="font-semibold">Revisões salvas para este SKU</h3>
        <p className="text-sm text-slate-600">Ficha principal: {activeRecipe ? `${activeRecipe.revision} · ${activeRecipe.primary_file_name}${activeRecipe.printer_profile ? ` · ${activeRecipe.printer_profile}` : ''}` : 'nenhuma selecionada'}. A seleção ainda não cria ordens de produção automaticamente.</p>
        {savedRecipes.length === 0 ? <p className="text-sm text-slate-600">Nenhuma revisão cadastrada.</p> : savedRecipes.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <span><strong>{item.revision}</strong> · {item.sku_snapshot} · {item.input_source === 'manual' ? 'dados manuais' : 'JSON importado'} · {new Date(item.created_at).toLocaleString('pt-BR')}{item.source_url ? <> · <a className="text-blue-700 underline" href={item.source_url} target="_blank" rel="noreferrer">abrir origem</a></> : ''}</span>
          <div className="flex gap-3">
            <button className="text-blue-700 underline" onClick={() => void downloadSavedRecipe(item)}>Baixar ficha</button>
            {filesEnabled && <button className="text-blue-700 underline" onClick={() => void selectRecipe(item)}>Arquivos</button>}
          </div>
        </div>)}
      </div>}
      {selectedRecipeId && <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Arquivos privados desta revisão</h3>
          <button disabled={!recipeFiles.length || verifyingFiles} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => void verifyRecipeFiles()}>{verifyingFiles ? 'Verificando...' : 'Verificar integridade'}</button>
        </div>
        <p className="text-xs text-slate-600">Limite inicial: 50 MB por arquivo. Os binários são privados, identificados pelo SHA-256 e reutilizados sem duplicação quando duas fichas usam o mesmo conteúdo.</p>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
          <select aria-label="Tipo de arquivo 3D" className={numberClass} value={fileKind} onChange={(event) => setFileKind(event.target.value as Print3dFileKind)}>
            <option value="model">Modelo</option><option value="project">Projeto</option><option value="gcode">G-code</option><option value="print-json">JSON da impressão</option><option value="preview">Prévia</option><option value="instructions">Instruções</option>
          </select>
          <input key={fileInputKey} aria-label="Arquivo da revisão" type="file" className="w-full text-sm" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
          <button disabled={!pendingFile || uploadingFile || (fileKind === 'gcode' && !printerProfile.trim())} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void uploadRecipeFile()}>{uploadingFile ? 'Enviando...' : 'Enviar ao Synology'}</button>
        </div>
        {fileKind === 'gcode' && <label className="block text-sm">Impressora e perfil compatíveis<input className={numberClass} maxLength={120} value={printerProfile} onChange={(event) => setPrinterProfile(event.target.value)} placeholder="Ex.: Bambu X1C · PLA · bico 0,4 mm" /></label>}
        {recipeFiles.length === 0 ? <p className="text-sm text-slate-600">Nenhum arquivo vinculado.</p> : recipeFiles.map((file) => <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-2 text-sm">
          <span>{file.kind} · {file.original_name}{file.printer_profile ? ` · ${file.printer_profile}` : ''} · {(Number(file.byte_size) / 1024 / 1024).toFixed(2)} MB{file.shared ? ' · compartilhado' : ''}</span>
          <button className="text-blue-700 underline" onClick={() => void downloadRecipeFile(file)}>Baixar</button>
        </div>)}
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm text-slate-600">{selectedRecipe?.input_source === 'manual' ? 'Esta revisão usa material e tempo informados manualmente. Escolha o arquivo principal correto.' : 'Para selecionar esta revisão, envie o JSON de material e tempo e escolha o arquivo principal correto.'}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-64 flex-1 text-sm">Arquivo principal
              <select className={numberClass} value={primaryFileId} onChange={(event) => setPrimaryFileId(event.target.value)}>
                <option value="">Selecione modelo, projeto ou G-code</option>
                {recipeFiles.filter((file) => ['model', 'project', 'gcode'].includes(file.kind)).map((file) =>
                  <option key={file.id} value={file.id}>{file.kind} · {file.original_name}{file.printer_profile ? ` · ${file.printer_profile}` : ''}</option>)}
              </select>
            </label>
            <button disabled={!primaryFileId || (selectedRecipe?.input_source !== 'manual' && !recipeFiles.some((file) => file.kind === 'print-json')) || selectingActive}
              className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void selectActiveRecipe()}>{selectingActive ? 'Selecionando...' : 'Selecionar ficha principal'}</button>
          </div>
        </div>
      </div>}
    </section>
  </div>;
}
