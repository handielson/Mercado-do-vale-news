import type { Product } from '../types/product';
import type { Unit } from '../types/unit';

export type PdvSerializedUnitOption = {
    id: string;
    unit: Unit;
    label: string;
    detail: string;
    unitData: {
        unitId?: string;
        imei1?: string;
        imei2?: string;
        serial?: string;
    };
};

export type PdvSearchCard =
    | {
        kind: 'serialized-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: true;
        unitOptions: PdvSerializedUnitOption[];
      }
    | {
        kind: 'stock-product';
        id: string;
        product: Product;
        title: string;
        subtitle: string;
        stockLabel: string;
        quantityLocked: false;
        maxQuantity?: number;
        unitOptions: [];
      };

export type PdvSearchCardDeps = {
    listUnitsByProduct(productId: string): Promise<Unit[]>;
};

type HydratedPdvProduct = {
    product: Product;
    available_units?: Unit[];
    has_unit_history?: boolean;
};

function cleanText(value: unknown): string {
    return String(value || '').trim();
}

function normalizeKeyText(value: unknown): string {
    return cleanText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function isAvailableUnit(unit: Unit): boolean {
    return String(unit.status) === 'available';
}

function formatStockLabel(quantity: number | undefined): string {
    const qty = Math.max(0, Math.trunc(Number(quantity || 0)));
    return qty === 1 ? '1 disponivel' : `${qty} disponiveis`;
}

function formatUnitCountLabel(quantity: number): string {
    return quantity === 1 ? '1 unidade disponivel' : `${quantity} unidades disponiveis`;
}

function stripLegacySerializedSpecs(product: Product): Product {
    const specs = { ...((product as any).specs || {}) };
    for (const key of ['imei', 'imei1', 'imei_1', 'imei2', 'imei_2', 'serial', 'serial_number']) {
        delete specs[key];
    }
    return {
        ...product,
        specs,
    };
}

function hasLegacySerializedIdentifier(product: Product): boolean {
    const specs = (product as any).specs || {};
    const imei1 = cleanText(specs.imei1 || specs.imei_1 || specs.imei);
    const imei2 = cleanText(specs.imei2 || specs.imei_2);
    const serial = cleanText(specs.serial || specs.serial_number);
    return Boolean(imei1 || imei2 || serial);
}

function getProductGroupingKey(product: Product): string {
    const modelId = cleanText((product as any).model_id);
    const ram = normalizeKeyText(product.specs?.ram);
    const storage = normalizeKeyText(product.specs?.storage);
    const color = normalizeKeyText(product.specs?.color);

    if (modelId && ram && storage && color) {
        return `model:${modelId}:ram:${ram}:storage:${storage}:color:${color}`;
    }

    const sku = cleanText(product.sku).toLowerCase();
    if (sku) return `sku:${sku}`;
    return `product:${product.id}`;
}

export function buildPdvUnitOption(unit: Unit): PdvSerializedUnitOption {
    const imei1 = cleanText(unit.imei_1);
    const imei2 = cleanText(unit.imei_2);
    const serial = cleanText(unit.serial_number || (unit as any).serial);

    const identifierParts = [
        imei1 ? `IMEI 1: ${imei1}` : '',
        imei2 ? `IMEI 2: ${imei2}` : '',
        serial ? `Serial: ${serial}` : '',
    ].filter(Boolean);
    const label = identifierParts.length > 0
        ? identifierParts.join(' | ')
        : `Unidade: ${String(unit.id || '').slice(0, 8)}`;

    return {
        id: `unit:${unit.id}`,
        unit,
        label,
        detail: '',
        unitData: {
            unitId: unit.id,
            imei1: imei1 || undefined,
            imei2: imei2 || undefined,
            serial: serial || undefined,
        },
    };
}

export function buildStockProductCard(product: Product): Extract<PdvSearchCard, { kind: 'stock-product' }> {
    const displayProduct = stripLegacySerializedSpecs(product);
    return {
        kind: 'stock-product',
        id: `product:${product.id}:stock`,
        product: displayProduct,
        title: displayProduct.name,
        subtitle: `SKU: ${displayProduct.sku || '-'}`,
        stockLabel: displayProduct.track_inventory ? formatStockLabel(displayProduct.stock_quantity) : 'Disponivel',
        quantityLocked: false,
        maxQuantity: displayProduct.track_inventory
            ? Math.max(0, Math.trunc(Number(displayProduct.stock_quantity || 0)))
            : undefined,
        unitOptions: [],
    };
}

export function buildSerializedProductCard(
    product: Product,
    availableUnits: Unit[],
): Extract<PdvSearchCard, { kind: 'serialized-product' }> {
    const displayProduct = stripLegacySerializedSpecs(product);
    const unitOptions = availableUnits.filter(isAvailableUnit).map(buildPdvUnitOption);
    return {
        kind: 'serialized-product',
        id: `product:${product.id}:serialized`,
        product: displayProduct,
        title: displayProduct.name,
        subtitle: displayProduct.sku ? `SKU: ${displayProduct.sku}` : 'Produto serializado',
        stockLabel: formatUnitCountLabel(unitOptions.length),
        quantityLocked: true,
        unitOptions,
    };
}

export async function buildPdvSearchCards(
    products: Product[],
    deps: PdvSearchCardDeps,
): Promise<PdvSearchCard[]> {
    const cards: PdvSearchCard[] = [];

    for (const product of products) {
        const units = product.track_inventory
            ? await deps.listUnitsByProduct(product.id).catch(() => [])
            : [];
        const availableUnits = units.filter(isAvailableUnit);

        if (availableUnits.length > 0) {
            cards.push(buildSerializedProductCard(product, availableUnits));
            continue;
        }

        // Produtos que ja possuem unidades devem ser vendidos somente por uma
        // unidade realmente disponivel. Nunca converta um IMEI vendido/reservado
        // em estoque comum nem reutilize os specs legados do produto.
        if (units.length > 0) continue;

        // Um identificador salvo apenas em products.specs nao e uma unidade de
        // estoque. Nao o ofereca como disponivel: ele precisa ser migrado para
        // units antes que o produto possa ser vendido no PDV.
        if (product.track_inventory && hasLegacySerializedIdentifier(product)) continue;

        cards.push(buildStockProductCard(product));
    }

    return cards;
}

export function fromHydratedPdvSearchPayload(payload: HydratedPdvProduct[]): PdvSearchCard[] {
    const grouped = new Map<string, HydratedPdvProduct[]>();

    for (const entry of payload) {
        const key = getProductGroupingKey(entry.product);
        const entries = grouped.get(key) || [];
        entries.push({
            product: entry.product,
            available_units: (entry.available_units || []).filter(isAvailableUnit),
            has_unit_history: entry.has_unit_history === true,
        });
        grouped.set(key, entries);
    }

    return [...grouped.values()].flatMap((entries) => {
        const canonical = entries.find((entry) => (entry.available_units || []).filter(isAvailableUnit).length > 0) || entries[entries.length - 1];
        const availableUnits = entries.flatMap((entry) => (entry.available_units || []).filter(isAvailableUnit));
        const groupHasUnitHistory = entries.some((entry) => entry.has_unit_history === true);
        const groupHasLegacySerializedIdentifier = entries.some((entry) => (
            entry.product.track_inventory && hasLegacySerializedIdentifier(entry.product)
        ));

        if (availableUnits.length > 0) {
            return [buildSerializedProductCard(canonical.product, availableUnits)];
        }

        // Ha historico de unidades, mas nenhuma disponivel: o produto nao pode
        // aparecer como estoque comum, pois isso contornaria o controle de IMEI.
        if (groupHasUnitHistory) return [];
        if (groupHasLegacySerializedIdentifier) return [];
        return [buildStockProductCard(canonical.product)];
    });
}
