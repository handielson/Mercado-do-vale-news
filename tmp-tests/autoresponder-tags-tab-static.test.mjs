import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagePath = path.join(root, 'pages', 'admin', 'AutoResponderPage.tsx');
const docPath = path.join(root, 'Bot_Whatsapp.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = fs.readFileSync(pagePath, 'utf8');
const doc = fs.readFileSync(docPath, 'utf8');

[
  'TagFormState',
  'emptyTagForm',
  'tagFormToInput',
  'tagSearch',
  'tagForm',
  'isTagModalOpen',
  'editingTag',
  'filteredTags',
].forEach((stateName) => {
  assert(page.includes(stateName), `AutoResponderPage must manage ${stateName}`);
});

[
  'autoResponderService.listTags',
  'autoResponderService.createTag',
  'autoResponderService.updateTag',
  'autoResponderService.deleteTag',
].forEach((callName) => {
  assert(page.includes(callName), `Tags tab must call ${callName}`);
});

[
  'Nova tag',
  'Editar tag',
  'Nome',
  'Cor',
  'Escopo',
  'Descrição',
  'Ações',
  'Salvar tag',
  'Excluir',
  'Conversas',
  'Produtos',
  'Regras',
].forEach((label) => {
  assert(page.includes(label), `Tags tab must render label: ${label}`);
});

assert(page.includes('type="color"'), 'Tag modal must include color selector');
assert(page.includes("tagScopesIncludes(tag, 'conversation')"), 'Tags table must show conversation scope');
assert(page.includes("tagScopesIncludes(tag, 'product')"), 'Tags table must show product scope');
assert(page.includes("tagScopesIncludes(tag, 'rule')"), 'Tags table must show rule scope');
assert(page.includes('toggleTagScope'), 'Tag modal must toggle scopes');

assert(doc.includes('- [x] Tabela com nome / cor / escopo / descrição / ações'), 'Bot_Whatsapp.md must mark tags table checklist item');
assert(doc.includes('- [x] CRUD com seletor de cores + multi-select de escopos'), 'Bot_Whatsapp.md must mark tags CRUD checklist item');

console.log('autoresponder tags tab static checks passed');
