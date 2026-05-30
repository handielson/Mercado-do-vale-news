import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const routeSource = readFileSync('routes/index.tsx', 'utf8');
const settingsSource = readFileSync('pages/admin/settings/CatalogSettingsPage.tsx', 'utf8');

assert.equal(
  existsSync('services/catalogEditorService.ts'),
  false,
  'legacy catalog editor service must be removed instead of keeping direct Supabase draft/publish writes',
);

assert.equal(
  existsSync('pages/admin/catalog-editor.tsx'),
  false,
  'legacy catalog editor page must be removed from the active admin bundle',
);

assert.equal(
  existsSync('components/admin/BannerEditor.tsx'),
  false,
  'legacy BannerEditor component should not remain after retiring the catalog editor route',
);

assert.doesNotMatch(
  routeSource,
  /catalog-editor|CatalogEditorPage/,
  'admin routes must not expose the retired /admin/catalog-editor page',
);

assert.doesNotMatch(
  settingsSource,
  /\/admin\/catalog-editor/,
  'catalog settings shortcut must not navigate to the retired editor route',
);

assert.match(
  settingsSource,
  /navigate\('\/admin\/settings\/banners'\)/,
  'catalog settings shortcut should point admins to the current VPS-backed banner management page',
);

console.log('legacy catalog editor retirement static checks passed');
