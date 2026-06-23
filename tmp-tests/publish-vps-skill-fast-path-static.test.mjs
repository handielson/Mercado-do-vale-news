import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const skill = readFileSync('C:/Users/Nitro/.codex/skills/publish-vps/SKILL.md', 'utf8');

assert.match(
  skill,
  /scripts\/publish-vps-plan\.cjs/,
  'Skill must use the deterministic publish preflight script.'
);

assert.match(
  skill,
  /Fluxo Inteligente|Intelligent Fast Path/,
  'Skill must describe the intelligent fast path.'
);

assert.match(
  skill,
  /site, API, ambos ou documentacao/i,
  'Skill must say the plan decides whether the release touches site, API, both, or docs only.'
);

assert.match(
  skill,
  /autoajuste|autoajust/i,
  'Skill must include an auto-adjustment protocol.'
);

assert.match(
  skill,
  /quick_validate\.py/,
  'Skill edits must still be validated with quick_validate.py.'
);

assert.doesNotMatch(
  skill,
  /sandbox_permissions|require_escalated/,
  'Skill must not instruct this desktop environment to set sandbox_permissions.'
);

console.log('publish VPS skill fast-path static checks passed');
