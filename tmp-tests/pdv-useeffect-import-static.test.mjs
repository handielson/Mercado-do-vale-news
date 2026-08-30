import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pdvPage = readFileSync('pages/pdv/PDVPage.tsx', 'utf8');

assert.match(
  pdvPage,
  /import React, \{ useEffect, useRef, useState \} from 'react';/,
  'PDV must import useEffect before rendering the payment synchronization effect',
);
assert.match(
  pdvPage,
  /useEffect\(\(\) => \{\s*setPayments\(/,
  'PDV must keep its payment synchronization effect',
);

console.log('PDV useEffect import static check passed');
