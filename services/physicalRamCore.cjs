'use strict';

function formatRamCapacity(value, unit = 'GB') {
  const number = String(value || '').replace(',', '.');
  if (!number) return '';
  return `${number}${String(unit || 'GB').toUpperCase().startsWith('T') ? 'TB' : 'GB'}`;
}

function normalizePhysicalRamValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const expansion = raw.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(GB|G|TB|T)?\s*\+\s*\d/i);
  if (expansion) return formatRamCapacity(expansion[1], expansion[2]);

  const sum = raw.match(/(\d+(?:[.,]\d+)?)\s*(GB|G|TB|T)?\s*\+\s*\d/i);
  if (sum) return formatRamCapacity(sum[1], sum[2]);

  const simple = raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*(GB|G|TB|T)\s*$/i);
  if (simple) return formatRamCapacity(simple[1], simple[2]);

  return raw.replace(/\s+/g, '').toUpperCase();
}

function normalizeProductSpecsRam(specs) {
  let parsed = specs;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return {}; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const normalized = { ...parsed };
  const explicitPhysical = normalized.ram_fisica || normalized.memoria_ram_fisica || normalized.physical_ram;
  const physicalRam = normalizePhysicalRamValue(explicitPhysical || normalized.ram || normalized.memoria_ram || normalized.memory_ram);
  if (physicalRam) normalized.ram = physicalRam;
  return normalized;
}

module.exports = {
  normalizePhysicalRamValue,
  normalizeProductSpecsRam,
};
