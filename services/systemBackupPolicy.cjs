const BACKUP_BASE = /^mdv-system-v[0-9.]+-(\d{8})-(\d{6})$/;
const NAS_ARTIFACT = /^(mdv-system-v[0-9.]+-\d{8}-\d{6})\.tar\.gz(?:\.part-\d{3}|\.parts\.json|\.sha256)?$/;

function backupTimestamp(name) {
  const match = BACKUP_BASE.exec(String(name || ''));
  if (!match) return null;
  const day = match[1];
  const time = match[2];
  const timestamp = Date.UTC(
    Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)),
    Number(time.slice(0, 2)), Number(time.slice(2, 4)), Number(time.slice(4, 6)),
  );
  return Number.isFinite(timestamp) ? timestamp : null;
}

function localBackupNamesToPrune(fileNames, { keep = 3, activeName = null } = {}) {
  const names = new Set(fileNames);
  const complete = [...names]
    .filter((file) => file.endsWith('.tar.gz'))
    .map((file) => file.slice(0, -7))
    .filter((name) => backupTimestamp(name) !== null && names.has(`${name}.tar.gz.sha256`))
    .sort((a, b) => backupTimestamp(b) - backupTimestamp(a));
  const protectedNames = new Set(complete.slice(0, Math.max(1, keep)));
  if (activeName) protectedNames.add(activeName);
  return complete.filter((name) => !protectedNames.has(name));
}

function synologyArtifactsToPrune(fileNames, {
  now = Date.now(), days = 30, keep = 3, confirmedName = null, limit = 100,
} = {}) {
  if (!confirmedName || backupTimestamp(confirmedName) === null) return [];
  const groups = new Map();
  for (const fileName of fileNames) {
    const match = NAS_ARTIFACT.exec(String(fileName || ''));
    if (!match) continue;
    const name = match[1];
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(fileName);
  }
  const sorted = [...groups.keys()].sort((a, b) => backupTimestamp(b) - backupTimestamp(a));
  if (!groups.has(confirmedName)) return [];
  const protectedNames = new Set(sorted.slice(0, Math.max(1, keep)));
  protectedNames.add(confirmedName);
  const cutoff = now - Math.max(1, days) * 86400000;
  return sorted
    .filter((name) => backupTimestamp(name) < cutoff && !protectedNames.has(name))
    .flatMap((name) => groups.get(name).sort())
    .slice(0, Math.max(1, limit));
}

function backupPartRanges(size, chunkBytes) {
  if (!Number.isSafeInteger(size) || size <= 0 || !Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) {
    throw new Error('invalid_backup_part_size');
  }
  const ranges = [];
  for (let start = 0; start < size; start += chunkBytes) {
    const end = Math.min(size - 1, start + chunkBytes - 1);
    ranges.push({ start, end, size: end - start + 1, index: ranges.length });
  }
  return ranges;
}

module.exports = { backupTimestamp, localBackupNamesToPrune, synologyArtifactsToPrune, backupPartRanges };
