// Conferência do cadastro por foto: quando o servidor devolve o registro atualizado (ex.: depois de
// "Associar modelo"), o rascunho da tela não pode perder o que o usuário escolheu e ainda não salvou
// (ex.: a cor). Regra de 3 vias por campo:
//  - o servidor mudou o campo  → vale o do servidor;
//  - o servidor não mudou e o usuário mexeu → mantém o do usuário;
//  - nada mudou → valor do servidor.

/**
 * @param {Record<string, unknown> | null} previousServer rascunho montado do registro anterior
 * @param {Record<string, unknown>} nextServer rascunho montado do registro novo
 * @param {Record<string, unknown> | null} local rascunho atual da tela
 * @param {{ sameRecord: boolean }} options sameRecord=false (outro aparelho) descarta o local
 */
export function mergePhotoIntakeDraft(previousServer, nextServer, local, { sameRecord }) {
  if (!sameRecord || !previousServer || !local) return { ...nextServer };
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const merged = { ...nextServer };
  for (const key of Object.keys(nextServer)) {
    const serverChanged = !same(previousServer[key], nextServer[key]);
    const userChanged = !same(local[key], previousServer[key]);
    if (!serverChanged && userChanged) merged[key] = local[key];
  }
  return merged;
}
