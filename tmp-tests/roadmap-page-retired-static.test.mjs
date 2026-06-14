import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routes = readFileSync('routes/index.tsx', 'utf8');
const adminLayout = readFileSync('layouts/AdminLayout.tsx', 'utf8');

assert.equal(
  existsSync('pages/admin/settings/RoadmapPage.tsx'),
  false,
  'RoadmapPage should be removed because it is static internal documentation'
);

assert.doesNotMatch(routes, /RoadmapPage/, 'router must not lazy-load the retired roadmap page');
assert.doesNotMatch(routes, /\/admin\/settings\/roadmap/, 'retired roadmap route must not remain reachable');
assert.doesNotMatch(adminLayout, /\/admin\/settings\/roadmap/, 'admin menu must not link to the retired roadmap page');
assert.doesNotMatch(adminLayout, /Roadmap & Docs/, 'admin menu must not show the retired roadmap label');

console.log('roadmap page retirement static checks passed');
