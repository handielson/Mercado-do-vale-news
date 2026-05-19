import assert from 'node:assert/strict';

const { selectFirstModelIds } = await import('../pages/admin/settings/modelBulkSelection.js');

{
  const models = Array.from({ length: 30 }, (_, index) => ({ id: `model-${index + 1}` }));
  const selected = selectFirstModelIds(models, 25);

  assert.equal(selected.size, 25);
  assert.deepEqual([...selected], models.slice(0, 25).map((model) => model.id));
}

{
  const selected = selectFirstModelIds([{ id: 'a' }, { id: 'b' }], 25);

  assert.deepEqual([...selected], ['a', 'b']);
}

console.log('model-bulk-selection tests passed');
