import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/whatsapp/WhatsAppAiTeachingPanel.tsx', 'utf8');

assert.match(source, /function autoResizeTextarea/, 'teaching panel must auto-expand textarea height');
assert.match(source, /useAutoResizeTextarea/, 'teaching panel must apply textarea auto-resize hook');
assert.match(source, /overflow-hidden/, 'teaching panel textareas must avoid internal scrollbars');
assert.doesNotMatch(source, /resize-y/, 'teaching panel must not use manually resized textarea scroll boxes');
assert.doesNotMatch(source, /line-clamp-3/, 'teaching panel preview must not hide training content behind a clamp');
assert.match(source, /Quando acionar/, 'keywords field must be named in plain language');
assert.match(source, /Como a IA deve responder/, 'instruction field must be named in plain language');

console.log('whatsapp IA teaching panel layout static checks passed');
