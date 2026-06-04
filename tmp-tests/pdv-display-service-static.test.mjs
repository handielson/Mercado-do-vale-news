import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const typesPath = resolve(root, 'types', 'pdvDisplay.ts');
const servicePath = resolve(root, 'services', 'pdvDisplayService.ts');

assert.ok(existsSync(typesPath), 'types/pdvDisplay.ts deve existir');
assert.ok(existsSync(servicePath), 'services/pdvDisplayService.ts deve existir');

const types = readFileSync(typesPath, 'utf8');
const service = readFileSync(servicePath, 'utf8');

for (const expected of [
  'export type PdvDisplayType',
  'export type PdvDisplayOrientation',
  'export type PdvPixPaymentStatus',
  'export interface PdvDisplay',
  'export interface PdvPixPayment',
  'export interface PdvPixPrintData',
]) {
  assert.ok(types.includes(expected), `types/pdvDisplay.ts deve conter ${expected}`);
}

for (const expected of [
  'normalizePdvPixStatus',
  'buildPdvPixPrintData',
  'pdvDisplayService',
  "vpsClient.get<PdvDisplay[]>('/pdv/displays')",
  "vpsClient.post<PdvDisplay>('/pdv/displays'",
  "vpsClient.post<PdvDisplayPairingCodeResponse>(`/pdv/displays/${encodeURIComponent(displayId)}/pairing-code`",
  "vpsClient.post<PdvDisplayPairResponse>('/pdv/displays/pair'",
  "vpsClient.post<PdvPixPayment>('/pdv/pix-payments'",
  "vpsClient.get<PdvPixPayment>(`/pdv/pix-payments/${encodeURIComponent(id)}/status`",
  "vpsClient.get<PdvDisplayState>('/pdv/display-state'",
]) {
  assert.ok(service.includes(expected), `services/pdvDisplayService.ts deve conter ${expected}`);
}

console.log('pdv display service static checks passed');
