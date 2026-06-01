import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('services/team.ts', 'utf8');

assert.doesNotMatch(
  service,
  /from ['"]\.\/supabase['"]|\.from\('team_members'\)/,
  'teamService must not use Supabase table calls for team_members after VPS migration',
);

assert.match(
  service,
  /\/table-data\/team_members\?limit=\$\{pageSize\}&offset=\$\{offset\}/,
  'team member reads should use explicit paged VPS table-data',
);

assert.match(
  service,
  /vpsClient\.post<TeamMember>\('\/table-data\/team_members'/,
  'team member creation should use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.patch<TeamMember>\(`\/table-data\/team_members\/\$\{id\}`/,
  'team member updates should use VPS table-data',
);

assert.match(
  service,
  /vpsClient\.delete\(`\/table-data\/team_members\/\$\{id\}`/,
  'team member deletes should use VPS table-data',
);

console.log('team members VPS static checks passed');
