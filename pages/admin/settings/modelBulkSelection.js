export const MODEL_SEO_BATCH_SIZE = 25;

export function selectFirstModelIds(models, limit = MODEL_SEO_BATCH_SIZE) {
  return new Set(
    models
      .slice(0, Math.max(0, limit))
      .map((model) => model.id)
      .filter(Boolean),
  );
}
