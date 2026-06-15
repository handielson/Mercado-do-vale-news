import { readFileSync } from 'node:fs';

const appSource = readFileSync('App.tsx', 'utf8');
const checkinSource = readFileSync('components/catalog/CheckinWidget.tsx', 'utf8');
const indexSource = readFileSync('index.html', 'utf8');

const requiredAppSnippets = [
  'sm:hidden sticky z-40 bg-white border-b border-slate-200 shadow-sm px-3 py-2 flex items-center gap-2',
  'h-10 rounded-xl bg-slate-100 animate-pulse',
  'h-[52px] w-[210px] max-w-[58vw] rounded-full bg-white border border-slate-200 shadow-sm animate-pulse',
  'py-8 sm:py-6',
];

const requiredCheckinSnippets = [
  "if (cardState === 'loading')",
  'aria-hidden="true"',
  'h-[52px] w-[210px] max-w-[58vw] rounded-full bg-white/80 border border-slate-200/60 shadow-sm animate-pulse',
];

const requiredIndexSnippets = [
  'initial-mobile-search',
  'initial-checkin-row',
  'initial-checkin',
  'initial-collections',
];

const missingApp = requiredAppSnippets.filter((snippet) => !appSource.includes(snippet));
const missingCheckin = requiredCheckinSnippets.filter((snippet) => !checkinSource.includes(snippet));
const missingIndex = requiredIndexSnippets.filter((snippet) => !indexSource.includes(snippet));

if (missingApp.length || missingCheckin.length || missingIndex.length) {
  console.error('Catalog mobile loading shell CLS guard failed.');
  if (missingApp.length) console.error('Missing App.tsx snippets:', missingApp);
  if (missingCheckin.length) console.error('Missing CheckinWidget.tsx snippets:', missingCheckin);
  if (missingIndex.length) console.error('Missing index.html snippets:', missingIndex);
  process.exit(1);
}

console.log('catalog mobile loading shell CLS guard passed');
