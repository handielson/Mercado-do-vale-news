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
const modelModal = read('components/settings/ModelModal.tsx');
const templateFieldInputBlock = modelModal.match(
  /const\s+TemplateFieldInput:[\s\S]*?\n\};\s*\n\s*\/\*\*\s*\n\s*\*\s*Model Modal Component/,
)?.[0] || '';

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
assert.match(
  optionModal,
  /useLayoutEffect\(\(\)\s*=>\s*\{[\s\S]*previousFocusRef\.current\s*=\s*document\.activeElement[\s\S]*labelInputRef\.current\?\.focus\(\)[\s\S]*return\s*\(\)\s*=>\s*\{[\s\S]*previousFocusRef\.current\?\.focus\(\)/,
  'the same layout effect must capture focus before focusing the input and restore it on cleanup',
);
assert.doesNotMatch(optionModal, /useEffect\(\(\)\s*=>\s*\{[\s\S]*previousFocusRef/, 'modal must not use a competing passive effect for focus restoration');
assert.match(optionModal, /if\s*\(!isOpen\s*\|\|\s*!field\)\s*return\s+null/, 'closed modal must render nothing');
assert.match(optionModal, /key=\{modalKey\}/, 'modal content must remount from a field/current-derived key');
assert.match(optionModal, /useState\(\(\)\s*=>\s*current\?\.label\s*\|\|\s*['"]{2}\)/, 'label state must initialize synchronously from current');
assert.match(optionModal, /current\?\.meta\?\.row\?\.hex_code\s*\|\|\s*['"]#000000['"]/, 'hex state must initialize synchronously from current');
assert.match(
  optionModal,
  /className=["'][^"']*max-h-\[calc\(100vh-2rem\)\][^"']*overflow-y-auto[^"']*["']/,
  'dialog panel must fit low viewports and scroll internally',
);

assert.ok(modelModal, 'ModelModal.tsx must exist');
assert.match(modelModal, /resolveMissingListChoices/, 'model modal must resolve missing AI list choices');
assert.match(
  modelModal,
  /const\s+applyNormalizedModelPayload\s*=\s*async/,
  'normalized payload application must wait for missing choice persistence',
);
assert.match(
  modelModal,
  /const\s+\[applyingModelPayload,\s*setApplyingModelPayload\]\s*=\s*useState\(false\)/,
  'model modal must expose applying state',
);
assert.match(
  modelModal,
  /const\s+applyingModelPayloadRef\s*=\s*useRef\(false\)/,
  'model modal must keep a synchronous application lock',
);
assert.ok(
  (modelModal.match(/if\s*\(applyingModelPayloadRef\.current\)\s*return/g) || []).length >= 3,
  'all three application flows must reject concurrent entry synchronously',
);
assert.ok(
  (modelModal.match(/applyingModelPayloadRef\.current\s*=\s*true[\s\S]{0,120}setApplyingModelPayload\(true\)/g) || []).length >= 3,
  'all three application flows must acquire state and ref locks',
);
assert.ok(
  (modelModal.match(/finally\s*\{[\s\S]{0,180}applyingModelPayloadRef\.current\s*=\s*false[\s\S]{0,120}setApplyingModelPayload\(false\)/g) || []).length >= 3,
  'all three application flows must release the lock in finally',
);
assert.ok(
  (modelModal.match(/await\s+applyNormalizedModelPayload\(normalized\)/g) || []).length >= 3,
  'all JSON apply and generation flows must await missing choice resolution',
);
assert.match(
  modelModal,
  /disabled=\{generatingModelJson\s*\|\|\s*applyingModelPayload\s*\|\|\s*loading\}/,
  'generate button must combine generation and application busy states',
);
assert.match(
  modelModal,
  /disabled=\{!modelJsonInput\.trim\(\)\s*\|\|\s*applyingModelPayload\s*\|\|\s*generatingModelJson\}/,
  'model JSON apply button must disable while applying or generating',
);
assert.match(
  modelModal,
  /disabled=\{!jsonInput\.trim\(\)\s*\|\|\s*applyingModelPayload\}/,
  'legacy JSON apply button must disable while applying',
);
assert.match(modelModal, /applyingModelPayload\s*\?\s*['"]Aplicando\.\.\.['"]/, 'apply buttons must show applying state');
assert.match(
  modelModal,
  /action:\s*\{\s*label:\s*['"]Editar['"]/,
  'created AI choices must expose an Editar toast action',
);
assert.match(
  modelModal,
  /setListEditor\(\{\s*field:\s*firstCreated\.persisted\.field,\s*current:\s*firstCreated\.persisted\.option\s*\}\)/,
  'Editar must open the first created option as the current modal value',
);
assert.match(
  modelModal,
  /const\s+createdFieldsById\s*=\s*new\s+Map[\s\S]*createdFieldsById\.set\(created\.persisted\.field\.id,\s*created\.persisted\.field\)[\s\S]*createdFieldsById\.get\(field\.id\)/,
  'manual fields must keep the latest field returned when AI creates multiple choices',
);
assert.match(modelModal, /import\s*\{\s*ModelListFieldInput\s*\}\s*from\s*['"].\/ModelListFieldInput['"]/, 'model modal must import ModelListFieldInput');
assert.match(modelModal, /import\s*\{\s*ModelListOptionModal\s*\}\s*from\s*['"].\/ModelListOptionModal['"]/, 'model modal must import ModelListOptionModal');
assert.match(modelModal, /import\s*\{\s*saveModelListOption\s*,\s*type\s+ModelListOptionDraft\s*\}\s*from\s*['"]\.\.\/\.\.\/services\/modelListOptions['"]/, 'model modal must import list option persistence');
assert.match(modelModal, /const\s+\[listEditor,\s*setListEditor\]\s*=\s*useState<\{\s*field:\s*CustomField;\s*current:\s*TableOption\s*\|\s*null;\s*\}\s*\|\s*null>\(null\)/, 'model modal must keep the active list editor');
assert.match(modelModal, /const\s+\[savingListOption,\s*setSavingListOption\]\s*=\s*useState\(false\)/, 'model modal must track list option saves');
assert.match(
  modelModal,
  /const\s+fieldChoiceOptionsGenerationRef\s*=\s*useRef\(0\)/,
  'model modal must version asynchronous choice loads with a ref',
);
assert.match(
  modelModal,
  /useEffect\(\(\)\s*=>\s*\{\s*let\s+cancelled\s*=\s*false;\s*const\s+requestId\s*=\s*\+\+fieldChoiceOptionsGenerationRef\.current;/,
  'each choice-loading effect must capture a new request generation and cancellation flag',
);
assert.match(
  modelModal,
  /if\s*\(\s*!cancelled\s*&&\s*requestId\s*===\s*fieldChoiceOptionsGenerationRef\.current\s*\)\s*\{\s*setFieldChoiceOptions\(nextOptions\);\s*\}/,
  'only the latest non-cancelled choice request may replace option state',
);
assert.match(
  modelModal,
  /loadFieldChoiceOptions\(\);\s*return\s*\(\)\s*=>\s*\{\s*cancelled\s*=\s*true;\s*\};\s*\},\s*\[customFields\]\);/,
  'choice-loading effect cleanup must cancel its request',
);
assert.match(modelModal, /const\s+handleOpenListOptionEditor\s*=\s*\(field:\s*CustomField,\s*current:\s*TableOption\s*\|\s*null\s*=\s*null\)/, 'model modal must expose a list editor opener');
assert.match(modelModal, /const\s+handleSaveListOption\s*=\s*async\s*\(draft:\s*ModelListOptionDraft\)/, 'model modal must save list options');
assert.match(modelModal, /saveModelListOption\(\{\s*field:\s*listEditor\.field,\s*options:\s*fieldChoiceOptions\[listEditor\.field\.key\]\s*\|\|\s*\[\],\s*draft,\s*current:\s*listEditor\.current,\s*\}\)/, 'save handler must persist against current field choices');
assert.match(modelModal, /setCustomFields\(\(fields\)\s*=>\s*fields\.map\(\(field\)\s*=>\s*field\.id\s*===\s*persisted\.field\.id\s*\?\s*persisted\.field\s*:\s*field\)\)/, 'manual list saves must replace the returned custom field');
assert.match(modelModal, /setFieldChoiceOptions\(\(currentOptions\)\s*=>/, 'list saves must update choices immediately');
assert.match(
  modelModal,
  /const\s+normalizeChoiceOptions\s*=\s*\(options:\s*TableOption\[\]\):\s*TableOption\[\]\s*=>\s*\[\.\.\.new\s+Map\([\s\S]*String\(option\.value\)[\s\S]*\.values\(\)\][\s\S]*\.sort\(\(left,\s*right\)\s*=>\s*left\.label\.localeCompare\(right\.label\)\)/,
  'model modal must define one helper that deduplicates choices by value and sorts by label',
);
assert.match(
  modelModal,
  /nextOptions\[field\.key\]\s*=\s*normalizeChoiceOptions\(\s*field\.options[\s\S]*\.map\(\(option\)\s*=>\s*\(\{\s*value:\s*option,\s*label:\s*option\s*\}\)\)\s*\)/,
  'manual choices loaded by the effect must use the shared normalizer',
);
assert.match(
  modelModal,
  /nextOptions\[field\.key\]\s*=\s*normalizeChoiceOptions\(\s*options\.map\(\(option\)\s*=>\s*\(\{[\s\S]*meta:\s*option\.meta,[\s\S]*\}\)\)\s*\)/,
  'relation choices loaded by the effect must use the shared normalizer',
);
assert.match(
  modelModal,
  /const\s+sorted\s*=\s*normalizeChoiceOptions\(\[\.\.\.withoutEdited,\s*persisted\.option\]\)/,
  'immediate save updates must use the same choice normalizer',
);
assert.match(
  modelModal,
  /fieldChoiceOptionsGenerationRef\.current\s*\+=\s*1;\s*setFieldChoiceOptions\(\(currentOptions\)\s*=>/,
  'saving a list option must invalidate older fetch generations before applying immediate state',
);
assert.match(modelModal, /handleTemplateValueChange\(listEditor\.field\.key,\s*String\(persisted\.option\.value\)\)/, 'saved options must become selected immediately');
assert.match(modelModal, /toast\.success\(listEditor\.current\s*\?\s*['"]Opcao atualizada com sucesso\.['"]\s*:\s*['"]Opcao adicionada com sucesso\.['"]\)/, 'save handler must report create and edit success');
assert.match(modelModal, /catch\s*\(saveError\)\s*\{[\s\S]*toast\.error\([\s\S]*\)[\s\S]*\}\s*finally\s*\{[\s\S]*setSavingListOption\(false\)/, 'save errors must toast and always release saving state');
assert.doesNotMatch(templateFieldInputBlock, /tableDataService\.loadOptions/, 'TemplateFieldInput must not load list options per field');
assert.doesNotMatch(templateFieldInputBlock, /field\.field_type\s*===\s*['"](?:select|table_relation)['"]/, 'TemplateFieldInput must not render list fields');
assert.match(modelModal, /\(field\.field_type\s*===\s*['"]select['"]\s*\|\|\s*field\.field_type\s*===\s*['"]table_relation['"]\)\s*\?\s*\([\s\S]*<ModelListFieldInput/, 'list fields must render through ModelListFieldInput');
assert.match(modelModal, /options=\{fieldChoiceOptions\[field\.key\]\s*\|\|\s*\[\]\}/, 'list field input must use centralized field choices');
assert.match(modelModal, /value=\{String\(templateValues\[field\.key\]\s*\?\?\s*['"]{2}\)\}/, 'list field input value must be a controlled string');
assert.match(modelModal, /onAdd=\{\(\)\s*=>\s*handleOpenListOptionEditor\(field\)\}/, 'add action must open a new option editor');
assert.match(modelModal, /onEdit=\{\(option\)\s*=>\s*handleOpenListOptionEditor\(field,\s*option\)\}/, 'edit action must open the selected option');
assert.equal((modelModal.match(/<ModelListOptionModal/g) || []).length, 1, 'model modal must render one list option modal');
assert.match(modelModal, /<ModelListOptionModal[\s\S]*key=\{[\s\S]*listEditor\?\.field\.id[\s\S]*listEditor\?\.current\?\.value[\s\S]*isOpen=\{!!listEditor\}[\s\S]*saving=\{savingListOption\}[\s\S]*onClose=\{\(\)\s*=>\s*\{[\s\S]*if\s*\(!savingListOption\)\s*setListEditor\(null\)/, 'list option modal must use a stable editor key and block close while saving');

console.log('model list option UI static tests passed');
