import fs from 'node:fs';
import path from 'node:path';
import { readBotWhatsappDoc } from '../tools/autoresponder-bot-doc.cjs';

const root = process.cwd();
const componentRoot = path.join(root, 'components', 'autoresponder');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedComponents = {
  'TagPicker.tsx': ['export interface TagPickerProps', 'scope?: AutoResponderTagScope', 'selectedTagIds', 'tagHasScope'],
  'ConversationCard.tsx': ['export interface ConversationCardProps', 'AutoResponderConversation', 'onPause', 'onBlock'],
  'BlockNumberModal.tsx': ['export interface BlockNumberModalProps', 'pattern_type', 'regex', 'Salvar bloqueio'],
  'AttachmentUpload.tsx': ['export interface AttachmentUploadProps', 'onDrop', 'accept="image/*"', 'onCaptionChange'],
  'RuleEditor.tsx': ['export interface RuleEditorProps', 'RuleTemplateOption', 'AttachmentUpload', 'MessagePreview', 'TagPicker'],
  'MessagePreview.tsx': ['export interface MessagePreviewProps', 'replyType', 'attachmentUrl', 'Preview ao vivo'],
};

for (const [fileName, tokens] of Object.entries(expectedComponents)) {
  const filePath = path.join(componentRoot, fileName);
  assert(fs.existsSync(filePath), `${fileName} must exist`);
  const source = fs.readFileSync(filePath, 'utf8');
  for (const token of tokens) {
    assert(source.includes(token), `${fileName} must include ${token}`);
  }
}

const doc = readBotWhatsappDoc(root);
for (const fileName of Object.keys(expectedComponents)) {
  assert(
    doc.includes(`- [x] \`components/autoresponder/${fileName}\``),
    `Bot_Whatsapp.md must mark ${fileName} as complete`
  );
}

console.log('autoresponder components static checks passed');
