export type BlingComboSelection = {
    group_key?: string | null;
    quantity?: number | string | null;
    option?: {
        id?: string | null;
        name?: string | null;
        sku?: string | null;
    } | null;
};

export type BlingComboChild = {
    id?: string | null;
    child_id?: string | null;
    quantity?: number | string | null;
    component_type?: string | null;
    group_key?: string | null;
};

export type BlingStockDeductionTarget = {
    productId: string;
    quantity: number;
};

function positiveQuantity(value: unknown, fallback = 1): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function targetProductId(child: BlingComboChild): string | null {
    return child.id || child.child_id || null;
}

function isChoiceChild(child: BlingComboChild): boolean {
    return child.component_type === 'choice_group';
}

function addTarget(
    targets: Map<string, number>,
    productId: string | null,
    quantity: number
) {
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) return;
    targets.set(productId, (targets.get(productId) || 0) + quantity);
}

export function buildComboStockDeductionTargets(
    children: BlingComboChild[] | null | undefined,
    saleQuantity: number,
    selections: BlingComboSelection[] = []
): BlingStockDeductionTarget[] {
    const comboQuantity = positiveQuantity(saleQuantity, 0);
    if (!children?.length || comboQuantity <= 0) return [];

    const targets = new Map<string, number>();

    for (const child of children) {
        if (isChoiceChild(child)) continue;
        addTarget(targets, targetProductId(child), comboQuantity * positiveQuantity(child.quantity));
    }

    for (const selection of selections || []) {
        const optionId = selection.option?.id;
        if (!optionId) continue;

        const matchingChild = children.find(child => {
            if (!isChoiceChild(child)) return false;
            if (targetProductId(child) !== optionId) return false;
            return !selection.group_key || !child.group_key || selection.group_key === child.group_key;
        });

        if (!matchingChild) continue;

        addTarget(
            targets,
            targetProductId(matchingChild),
            comboQuantity * positiveQuantity(selection.quantity, positiveQuantity(matchingChild.quantity))
        );
    }

    return Array.from(targets, ([productId, quantity]) => ({ productId, quantity }));
}
