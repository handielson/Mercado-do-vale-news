// Suggestions for the shared color registry, not extra selectable inventory colors.
// Persist only the existing name + #RRGGBB fields; translucency is a display convention.
export const TRANSLUCENT_COLOR_PALETTE = [
  ['Azul', '#3B82F6'], ['Verde', '#10B981'], ['Vermelho', '#EF4444'],
  ['Amarelo', '#EAB308'], ['Laranja', '#F97316'], ['Roxo', '#8B5CF6'],
  ['Rosa', '#EC4899'], ['Branco', '#FFFFFF'], ['Preto', '#000000'],
  ['Cinza', '#6B7280'], ['Dourado', '#F59E0B'], ['Marrom', '#8B4513'],
].map(([name, hex]) => ({ name: `${name} Translúcido`, hex }));
TRANSLUCENT_COLOR_PALETTE.push({ name: 'Translúcido', hex: '#FFFFFF' });

const normalize = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
export const isTranslucentColor = name => /\btranslucid[oa]s?\b/.test(normalize(name));
export const translucentPresetHex = name => TRANSLUCENT_COLOR_PALETTE.find(color => normalize(color.name) === normalize(name))?.hex;

const validHex = hex => typeof hex === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex);
const checker = 'conic-gradient(#e2e8f0 25%, #fff 0 50%, #e2e8f0 0 75%, #fff 0)';

function translucentHex(hex) {
  const expanded = hex.length <= 5 ? '#' + [...hex.slice(1)].map(char => char + char).join('') : hex;
  const alpha = expanded.length === 9 ? parseInt(expanded.slice(7), 16) : 255;
  // Fixed visual cue only, not a measured optical property of the filament.
  return expanded.slice(0, 7) + Math.round(alpha * 0.55).toString(16).padStart(2, '0');
}

export function colorSampleStyle(name, hex) {
  if (!validHex(hex)) return undefined;
  if (!isTranslucentColor(name)) return { backgroundColor: hex };
  const tint = translucentHex(hex);
  return { backgroundImage: `linear-gradient(${tint}, ${tint}), ${checker}`, backgroundSize: '100% 100%, 8px 8px' };
}

export function combinedColorSampleStyle(names, hexes) {
  if (!hexes.length || names.length !== hexes.length || hexes.some(hex => !validHex(hex))) return undefined;
  if (hexes.length === 1) return colorSampleStyle(names[0], hexes[0]);
  if (!names.some(isTranslucentColor)) return { background: `linear-gradient(90deg, ${hexes.join(', ')})` };
  const tints = hexes.map((hex, index) => isTranslucentColor(names[index]) ? translucentHex(hex) : hex);
  return { backgroundImage: `linear-gradient(90deg, ${tints.join(', ')}), ${checker}`, backgroundSize: '100% 100%, 8px 8px' };
}
