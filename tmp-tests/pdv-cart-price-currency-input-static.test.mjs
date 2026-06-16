import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('components/pdv/CartItemsSection.tsx', 'utf8');

assert.match(
    source,
    /const parseCurrencyToCents = \(value: string\): number \| null =>/,
    'cart price input must parse BRL text to cents'
);

assert.doesNotMatch(
    source,
    /type="number"[\s\S]{0,260}onUpdatePrice/,
    'unit price input must not be a number input because browser spinners get in the way'
);

assert.match(
    source,
    /type="text"[\s\S]{0,120}inputMode="decimal"/,
    'unit price input must be a decimal text input'
);

assert.match(
    source,
    /const \[editingPriceInputs, setEditingPriceInputs\] = React\.useState<Record<string, string>>\(\{\}\)/,
    'unit price input must keep raw typed text while focused'
);

assert.match(
    source,
    /value=\{editingPriceInputs\[item\.id\] \?\? fmt\(item\.unit_price\)\}/,
    'unit price input must not force currency formatting on every keystroke'
);

assert.match(
    source,
    /setEditingPriceInputs\(current => \(\{ \.\.\.current, \[item\.id\]: e\.target\.value \}\)\)/,
    'unit price input must store each typed character before recalculating the item'
);

assert.match(
    source,
    /onBlur=\{\(\) => setEditingPriceInputs\(current => \{/,
    'unit price input must return to formatted display on blur'
);

assert.match(
    source,
    /onFocus=\{\(e\) => \{[\s\S]*e\.currentTarget\.select\(\)/,
    'unit price input must select all text on focus'
);

console.log('pdv cart price currency input static checks passed');
