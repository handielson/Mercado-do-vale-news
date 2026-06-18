import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

const fieldInput = read('components/settings/ModelListFieldInput.tsx');
const optionModal = read('components/settings/ModelListOptionModal.tsx');

assert.ok(fieldInput, 'ModelListFieldInput.tsx must exist');
assert.match(
  fieldInput,
  /grid-cols-\[minmax\(0,1fr\)_2\.5rem_2\.5rem\]/,
  'list field must use stable select and action columns',
);
assert.match(fieldInput, /import\s*\{[^}]*Plus[^}]*\}\s*from\s*['"]lucide-react['"]/, 'list field must import the Plus icon');
assert.match(fieldInput, /import\s*\{[^}]*Pencil[^}]*\}\s*from\s*['"]lucide-react['"]/, 'list field must import the Pencil icon');
assert.match(fieldInput, /title=["']Adicionar opcao["']/, 'add action must expose its tooltip');
assert.match(fieldInput, /title=["']Editar opcao selecionada["']/, 'edit action must expose its tooltip');
assert.match(fieldInput, /disabled=\{[^}]*!selectedOption[^}]*\}/, 'edit action must be disabled without a selected option');
assert.match(fieldInput, /<select[\s\S]*value=\{String\(value\s*\?\?\s*['"]{2}\)\}[\s\S]*onChange=\{/, 'select must be controlled');
assert.ok((fieldInput.match(/type=["']button["']/g) || []).length >= 2, 'both action buttons must use type=button');
assert.match(fieldInput, /String\(option\.value\)\s*===\s*String\(value\)/, 'selected option must compare values as strings');
assert.ok((fieldInput.match(/h-10\s+w-10|w-10\s+h-10/g) || []).length >= 2, 'action buttons must have stable h-10/w-10 dimensions');
assert.match(fieldInput, /min-w-0/, 'list field must allow text to shrink without overflow');
assert.match(fieldInput, /value:\s*string\s*;/, 'value prop must be exactly string');
assert.match(fieldInput, /onAdd:\s*\(\)\s*=>\s*void\s*;/, 'onAdd prop must not receive field');
assert.match(fieldInput, /onEdit:\s*\(option:\s*TableOption\)\s*=>\s*void\s*;/, 'onEdit prop must receive only the selected option');
assert.match(fieldInput, /onClick=\{onAdd\}/, 'add button must call onAdd without arguments');
assert.match(fieldInput, /onEdit\(selectedOption\)/, 'edit button must call onEdit with only selectedOption');
assert.doesNotMatch(fieldInput, /onAdd\(field\)/, 'add callback must not receive field');
assert.doesNotMatch(fieldInput, /onEdit\(field\s*,/, 'edit callback must not receive field');

assert.ok(optionModal, 'ModelListOptionModal.tsx must exist');
assert.match(optionModal, /field\??\.table_config\?\.table_name\s*===\s*['"]colors['"]/, 'modal must detect the colors table');
assert.match(optionModal, /type=["']color["']/, 'color options must show a native color picker');
assert.match(optionModal, /await\s+onSave\(\{\s*label:\s*label\.trim\(\),\s*hexCode:/, 'modal must submit trimmed label and hexCode');
assert.match(optionModal, /z-\[60\]/, 'modal must render above the model modal');
assert.match(optionModal, /max-w-md/, 'modal must remain compact');
assert.match(optionModal, /Loader2/, 'modal must show Loader2 while saving');
assert.match(optionModal, /current\?\.meta\?\.row\?\.hex_code/, 'modal must initialize color hex from option metadata');
assert.match(optionModal, /<form[\s\S]*onSubmit=\{handleSubmit\}/, 'modal must submit through a form');
assert.match(optionModal, /label\.trim\(\)/, 'modal must reject or normalize blank labels locally');
assert.match(optionModal, /disabled=\{!label\.trim\(\)\s*\|\|\s*saving\s*\|\|\s*submitting\}/, 'save must be disabled for blank labels and while saving or submitting');
assert.match(optionModal, /const\s+submittingRef\s*=\s*useRef\(false\)/, 'modal must keep a synchronous submit lock');
assert.match(optionModal, /if\s*\(submittingRef\.current\s*\|\|\s*saving\)\s*return/, 'submit handler must reject duplicate submissions synchronously');
assert.match(optionModal, /submittingRef\.current\s*=\s*true[\s\S]*setSubmitting\(true\)[\s\S]*await\s+onSave/, 'submit lock must be active before awaiting onSave');
assert.match(optionModal, /finally\s*\{[\s\S]*submittingRef\.current\s*=\s*false[\s\S]*setSubmitting\(false\)/, 'submit lock must always be released');
assert.match(optionModal, /role=["']dialog["']/, 'modal must expose dialog semantics');
assert.match(optionModal, /aria-modal=["']true["']/, 'modal must be marked modal');
assert.match(optionModal, /aria-labelledby=["']model-list-option-title["']/, 'dialog must reference its title');
assert.match(optionModal, /id=["']model-list-option-title["']/, 'modal title must have a stable id');
assert.match(optionModal, /event\.key\s*===\s*['"]Escape['"][\s\S]*onClose\(\)/, 'Escape must close the modal');
assert.match(optionModal, /event\.key\s*(?:===|!==)\s*['"]Tab['"]/, 'modal must trap Tab navigation');
assert.match(optionModal, /querySelectorAll<HTMLElement>\(/, 'focus trap must discover focusable elements');
assert.match(optionModal, /previousFocusRef\.current\s*=\s*document\.activeElement/, 'modal must remember the previously focused element');
assert.match(optionModal, /previousFocusRef\.current\?\.focus\(\)/, 'modal must restore focus after closing');
assert.match(optionModal, /labelInputRef\.current\?\.focus\(\)/, 'modal must focus the label input on open');
assert.match(optionModal, /if\s*\(!isOpen\s*\|\|\s*!field\)\s*return\s+null/, 'closed modal must render nothing');
assert.match(optionModal, /key=\{modalKey\}/, 'modal content must remount from a field/current-derived key');
assert.match(optionModal, /useState\(\(\)\s*=>\s*current\?\.label\s*\|\|\s*['"]{2}\)/, 'label state must initialize synchronously from current');
assert.match(optionModal, /current\?\.meta\?\.row\?\.hex_code\s*\|\|\s*['"]#000000['"]/, 'hex state must initialize synchronously from current');

console.log('model list option UI static tests passed');
