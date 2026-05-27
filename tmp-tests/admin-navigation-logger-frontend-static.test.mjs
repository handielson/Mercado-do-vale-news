import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('App.tsx', 'utf8');
const service = fs.readFileSync('services/adminNavigationLogService.ts', 'utf8');

assert.match(
  app,
  /import \{ installAdminNavigationLogger \} from '\.\/services\/adminNavigationLogService';/,
  'App must import the admin navigation logger installer.'
);

assert.match(
  app,
  /React\.useEffect\(\(\) => installAdminNavigationLogger\(router\), \[\]\);/,
  'App must install the logger once against the central router.'
);

assert.match(
  service,
  /router\.subscribe\(/,
  'Navigation logger must subscribe to the router instead of requiring each page to log manually.'
);

assert.match(
  service,
  /pathname\.startsWith\('\/admin'\) \|\| pathname\.startsWith\('\/pdv'\)/,
  'Navigation logger must limit capture to admin and PDV screens.'
);

assert.match(
  service,
  /vpsClient\.post\('\/admin\/navigation-log'/,
  'Navigation logger must send entries to the VPS navigation endpoint.'
);

assert.match(
  service,
  /redactSensitiveSearch/,
  'Navigation logger must redact sensitive query parameters before sending URLs.'
);

console.log('ok - frontend admin navigation logger is installed and scoped');
