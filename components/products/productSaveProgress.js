export function getProductSaveProgressPercent(progress) {
  if (!progress || !progress.total) return 0;
  const current = Math.max(0, Number(progress.current) || 0);
  const total = Math.max(1, Number(progress.total) || 1);
  return Math.min(100, Math.max(8, Math.round((current / total) * 100)));
}
