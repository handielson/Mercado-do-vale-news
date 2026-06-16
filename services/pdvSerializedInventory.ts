import type { Product } from '../types/product';
import type { Unit } from '../types/unit';

export type PdvSerializedUnitOption = {
    id: string;
    unit: Unit;
    label: string;
    detail: string;
    unitData: {
        unitId: string;
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
};

function cleanText(value: unknown): string {
    return String(value || '').trim();
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

function getProductGroupingKey(product: Product): string {
    const sku = cleanText(product.sku).toLowerCase();
    if (sku) return `sku:${sku}`;
    return `product:${product.id}`;
}

export function buildPdvUnitOption(unit: Unit): PdvSerializedUnitOption {
    const imei1 = cleanText(unit.imei_1);
    const imei2 = cleanText(unit.imei_2);
    const serial = cleanText(unit.serial_number || (unit as any).serial);

    const label = imei1
        ? `IMEI 1: ${imei1}`
        : serial
            ? `Serial: ${serial}`
            : imei2
                ? `IMEI 2: ${imei2}`
                : `Unidade: ${String(unit.id || '').slice(0, 8)}`;

    const detail = [
        imei1 && imei2 ? `IMEI 2: ${imei2}` : '',
        imei1 && serial ? `Serial: ${serial}` : '',
    ].filter(Boolean).join(' | ');

    return {
        id: `unit:${unit.id}`,
        unit,
        label,
        detail,
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

        cards.push(buildStockProductCard(product));
    }

    return cards;
}

export function fromHydratedPdvSearchPayload(payload: HydratedPdvProduct[]): PdvSearchCard[] {
    const grouped = new Map<string, HydratedPdvProduct>();

    for (const entry of payload) {
        const key = getProductGroupingKey(entry.product);
        const current = grouped.get(key);
        const entryUnits = (entry.available_units || []).filter(isAvailableUnit);

        if (!current) {
            grouped.set(key, { product: entry.product, available_units: entryUnits });
            continue;
        }

        const currentUnits = (current.available_units || []).filter(isAvailableUnit);
        const product = currentUnits.length > 0 && entryUnits.length === 0
            ? current.product
            : entry.product;

        grouped.set(key, {
            product,
            available_units: [...currentUnits, ...entryUnits],
        });
    }

    return [...grouped.values()].map((entry) => {
        const availableUnits = (entry.available_units || []).filter(isAvailableUnit);
        return availableUnits.length > 0
            ? buildSerializedProductCard(entry.product, availableUnits)
            : buildStockProductCard(entry.product);
    });
}
