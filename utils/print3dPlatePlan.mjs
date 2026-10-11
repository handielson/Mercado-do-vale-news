// The immutable recipe owns the plate plan. File references use content hashes,
// never public URLs or mutable filenames as their identity.
export function normalizePrint3dPlates(plates, filaments, summary) {
  if (plates === undefined) return undefined; // Preserve legacy recipe hashes.
  if (!Array.isArray(plates) || !plates.length || plates.length > 50) throw new TypeError('Informe de 1 a 50 placas.');
  const ids = new Set();
  const allocated = new Map();
  const result = plates.map((plate, index) => {
    const id = String(plate?.id || '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw new TypeError('Identificador de placa inválido ou repetido.');
    ids.add(id);
    const name = String(plate.name || `Placa ${index + 1}`).trim();
    const notes = String(plate.notes || '').trim();
    if (!name || name.length > 120 || notes.length > 1000 || /[\x00-\x1f\x7f]/.test(name) || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(notes)) throw new TypeError('Nome ou observação da placa inválidos.');
    const printMinutes = plate.printMinutes;
    if (!Number.isFinite(printMinutes) || printMinutes <= 0) throw new TypeError(`${name}: informe o tempo de impressão.`);
    if (!Array.isArray(plate.filaments) || !plate.filaments.length) throw new TypeError(`${name}: informe os filamentos.`);
    const seen = new Set();
    const lines = plate.filaments.map(line => {
      if (!filaments.some(f => f.id === line.id) || seen.has(line.id) || !Number.isFinite(line.consumedGrams) || line.consumedGrams <= 0) throw new TypeError(`${name}: filamento ou consumo inválido.`);
      seen.add(line.id);
      allocated.set(line.id, (allocated.get(line.id) || 0) + line.consumedGrams);
      return { id: line.id, consumedGrams: line.consumedGrams };
    });
    const files = (plate.files || []).map(file => {
      if (!['model', 'project', 'gcode', 'print-json', 'preview', 'instructions'].includes(file.kind) || !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.byte_size) || file.byte_size <= 0 || file.byte_size > 50 * 1024 * 1024) throw new TypeError(`${name}: referência de arquivo inválida.`);
      const originalName = String(file.original_name || '').trim();
      if (!originalName || originalName.length > 255 || /[\\/\x00-\x1f\x7f]/.test(originalName)) throw new TypeError('Nome de arquivo inválido.');
      return { kind: file.kind, sha256: file.sha256, byte_size: file.byte_size, original_name: originalName };
    });
    return { id, name, notes, printMinutes, filaments: lines, files };
  });
  if (Math.abs(result.reduce((sum, p) => sum + p.printMinutes, 0) - summary.printMinutes) > 0.001 || filaments.some(f => Math.abs((allocated.get(f.id) || 0) - f.consumedGrams) > 0.001)) throw new TypeError('Os totais das placas divergem do tempo ou filamento do lote.');
  return result;
}

export function resolvePrint3dPlateFiles(draft, files, { requirePrintable = false } = {}) {
  return (draft.plates || []).map(plate => {
    const resolved = plate.files.map(reference => {
      const file = files.find(f => f.kind === reference.kind && f.sha256 === reference.sha256 && Number(f.byte_size) === reference.byte_size);
      if (!file || (file.kind === 'gcode' && !file.printer_profile)) throw new Error(`${plate.name}: arquivo ausente ou divergente da revisão (${reference.original_name}).`);
      return file;
    });
    if (requirePrintable && !resolved.some(f => ['model', 'project', 'gcode'].includes(f.kind))) throw new Error(`${plate.name}: envie um arquivo de impressão antes de usar esta revisão.`);
    return { ...plate, files: resolved };
  });
}
