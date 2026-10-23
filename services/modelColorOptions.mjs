// Model photos refer to canonical color IDs. Keep those colors available in
// the family editor even if they are no longer active in the general list.
export function modelColorOptions(colors, imageRows) {
  const photoIds = new Set(imageRows.filter(row => row.images?.length > 0).map(row => row.color_id));
  const suggested = colors.filter(color => photoIds.has(color.id));
  const otherActive = colors.filter(color => color.active && !photoIds.has(color.id));
  return { suggested, options: [...suggested, ...otherActive] };
}
