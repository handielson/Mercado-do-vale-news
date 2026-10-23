// A commercial model and its catalog parent are separate records. Keep this
// draft explicit so the product form never mistakes the model for a sellable SKU.
export function buildModelParentPrefill(model, brandName) {
  if (!model?.id || !model?.name || !brandName) throw new Error('Confira o modelo e a marca antes de criar o produto pai.');
  return {
    model_id: model.id,
    model: model.name,
    name: model.name,
    brand: brandName,
    category_id: model.category_id || undefined,
    is_parent: true,
    product_format: 'parent',
    track_inventory: false,
    stock_quantity: 0,
    images: [],
    specs: {},
  };
}
