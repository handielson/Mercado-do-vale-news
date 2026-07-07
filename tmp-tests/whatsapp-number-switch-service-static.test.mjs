import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('services/autoResponderService.ts', 'utf8');

const requiredMethods = [
  ['getWhatsAppSwitchStatus', "vpsClient.get<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/status')"],
  ['startWhatsAppNumberSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/start', {})"],
  ['disconnectWhatsAppForSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/disconnect', {})"],
  ['connectWhatsAppForSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/connect', {})"],
  ['confirmWhatsAppNumberSwitch', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/confirm', { reactivate })"],
  ['keepWhatsAppSwitchPaused', "vpsClient.post<WhatsAppSwitchStatus>('/n8n-bot/whatsapp-switch/keep-paused', {})"],
];

assert.match(source, /export interface WhatsAppSwitchStatus/, 'service must export WhatsAppSwitchStatus');
for (const [method, call] of requiredMethods) {
  assert.match(source, new RegExp(`${method}:`), `service must expose ${method}`);
  assert.ok(source.includes(call), `${method} must call ${call}`);
}

console.log('whatsapp number switch service static checks passed');
