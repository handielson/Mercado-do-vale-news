import fs from 'node:fs';

const page = fs.readFileSync('pages/admin/settings/WhatsAppPage.tsx', 'utf8');
const service = fs.readFileSync('services/autoResponderService.ts', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  !page.includes('WhatsAppResponseCenterPanel'),
  'WhatsApp settings page must not render the legacy response/rules center'
);

assert(
  !fs.existsSync('components/whatsapp/WhatsAppResponseCenterPanel.tsx'),
  'legacy WhatsApp response center component must be removed'
);

assert(
  !fs.existsSync('components/autoresponder/RuleEditor.tsx'),
  'legacy autoresponder rule editor must be removed'
);

assert(
  !fs.existsSync('components/autoresponder/AttachmentUpload.tsx'),
  'unused legacy autoresponder attachment upload component must be removed'
);

assert(
  !fs.existsSync('components/autoresponder/MessagePreview.tsx'),
  'unused legacy autoresponder message preview component must be removed'
);

assert(
  !service.includes('/autoresponder/rules') && !service.includes('listRules') && !service.includes('createRule'),
  'frontend service must not expose legacy autoresponder rule endpoints'
);

assert(
  !service.includes('uploadAttachment') && !service.includes('/autoresponder/upload-attachment'),
  'frontend service must not expose the legacy attachment upload endpoint'
);

assert(
  service.includes('listAiTraining') && service.includes('/autoresponder/ai-training'),
  'AI procedure editor must remain available'
);

console.log('Legacy WhatsApp response center is not exposed in the admin page.');
