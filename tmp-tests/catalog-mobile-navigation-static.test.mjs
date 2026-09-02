import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalogPage = readFileSync('pages/catalog/index.tsx', 'utf8');
const catalogFilters = readFileSync('components/catalog/CatalogFilters.tsx', 'utf8');
const shareCatalog = readFileSync('components/catalog/ShareCatalogButton.tsx', 'utf8');
const cartIcon = readFileSync('components/store/CartIcon.tsx', 'utf8');
const feedbackButton = readFileSync('components/catalog/FeedbackFloatingButton.tsx', 'utf8');
const feedbackModal = readFileSync('components/catalog/FeedbackModal.tsx', 'utf8');
const catalogSection = readFileSync('components/catalog/CatalogSection.tsx', 'utf8');
const checkinWidget = readFileSync('components/catalog/CheckinWidget.tsx', 'utf8');
const publicProductPage = readFileSync('pages/store/PublicProductPage.tsx', 'utf8');

assert.match(
  catalogPage,
  /<Menu className="h-3\.5 w-3\.5" \/>[\s\S]*Categorias/,
  'mobile catalog must expose a single explicit Categories button',
);
assert.match(
  catalogPage,
  /aria-controls="mobile-category-menu"/,
  'mobile catalog must expose the full category menu with a discoverable control',
);
assert.match(
  catalogPage,
  /aria-label="Escolher categoria"[\s\S]*fixed left-3 right-3 bottom-3/,
  'category chooser must follow the mobile filter panel pattern and stay inside the viewport',
);
assert.match(
  catalogPage,
  /aria-label="Colecoes de produtos"[\s\S]*className="mt-4 hidden gap-2 sm:flex/,
  'collection shortcuts must stay hidden on mobile to avoid repeating the page heading',
);
assert.match(
  catalogFilters,
  /fixed left-3 right-3 bottom-3[\s\S]*sm:absolute/,
  'filter panel must stay inside the mobile viewport and preserve the desktop dropdown',
);
assert.match(
  shareCatalog,
  /fixed left-3 right-3 top-1\/2[\s\S]*-translate-y-1\/2[\s\S]*sm:absolute/,
  'share panel must stay centered inside the mobile viewport and preserve the desktop dropdown',
);
assert.match(
  shareCatalog,
  /<span className="sm:hidden">Compartilhar<\/span>/,
  'share trigger must use a compact mobile label',
);
assert.match(
  cartIcon,
  /relative flex h-10 w-10 shrink-0/,
  'cart button must be an inline action aligned with the catalog controls',
);
assert.doesNotMatch(cartIcon, /className="[^"]*\bfixed\b/, 'cart button must not float over products');
assert.ok(
  catalogPage.indexOf('<ShareCatalogButton') < catalogPage.indexOf('<CartIcon />'),
  'cart button must appear immediately after the share action',
);
assert.match(
  feedbackButton,
  /inline-flex h-10 items-center gap-1\.5[\s\S]*Dúvidas\?/,
  'feedback must be a discreet in-flow action instead of covering product cards',
);
assert.doesNotMatch(feedbackButton, /className="[^"]*\bfixed\b/, 'feedback trigger must not float over products');
assert.match(
  feedbackModal,
  /items-end justify-center[\s\S]*sm:items-center/,
  'feedback must open as a bottom panel on mobile and remain centered on larger screens',
);
assert.match(
  feedbackModal,
  /max-h-\[calc\(100dvh-1\.5rem\)\][\s\S]*overflow-y-auto overscroll-contain/,
  'feedback panel must fit the mobile viewport and keep the form scrollable',
);
assert.match(
  catalogPage,
  /Check-in, dúvidas e atalho de favoritos[\s\S]*<FeedbackFloatingButton \/>[\s\S]*<CheckinWidget \/>/,
  'home feedback action must stay beside daily check-in',
);
assert.match(
  catalogPage,
  /customer \? 'justify-between' : 'justify-center sm:justify-end'/,
  'guest feedback and daily check-in actions must be centered together on mobile',
);
assert.doesNotMatch(
  catalogPage,
  /\) : \(\s*<div \/>\s*\)\}/,
  'guest home actions must not use an empty spacer that pushes them to the right',
);
assert.match(
  catalogPage,
  /top-\[var\(--catalog-actions-top-mobile\)\][^\"]*sm:top-\[var\(--catalog-actions-top-desktop\)\][\s\S]*'--catalog-actions-top-mobile': `\$\{headerHeight \+ 57\}px`[\s\S]*'--catalog-actions-top-desktop': `\$\{headerHeight\}px`/,
  'catalog actions and desktop search must remain sticky below the appropriate public header offset',
);
assert.match(
  catalogSection,
  /!\['recent', 'featured', 'bestsellers'\]\.includes\(section\.section_type\)/,
  'recent, featured and bestselling sections must suppress redundant subtitles',
);
assert.match(
  catalogSection,
  /inline-flex shrink-0 items-center[^"]*whitespace-nowrap[\s\S]*Ver todos/,
  'view-all action must remain compact and on one line',
);
assert.doesNotMatch(
  checkinWidget,
  /Entre para ganhar moedas/,
  'guest check-in must not render the redundant secondary legend',
);
assert.match(
  checkinWidget,
  /group relative flex h-10 items-center/,
  'guest check-in must share the same 40px height as the feedback action',
);
assert.match(
  catalogPage,
  /mb-8 space-y-2 sm:mb-12 sm:space-y-12/,
  'catalog sections must use compact spacing on mobile and preserve desktop rhythm',
);
assert.doesNotMatch(
  catalogPage,
  /!isHomeCatalogPage && \([\s\S]*?<FeedbackFloatingButton \/>[\s\S]*?\)[\s\S]*?<nav/,
  'non-home feedback must not reserve a separate row below sticky actions',
);
assert.match(
  publicProductPage,
  /const persistentCatalogSearch = \([\s\S]*sticky top-\[64px\] z-40[^\"]*border-b[\s\S]*<SearchBar/,
  'product detail must keep the canonical catalog search below the public header on mobile and desktop',
);
assert.match(
  catalogPage,
  /setHeaderHeight\(Math\.max\(64, Math\.ceil\(header\.getBoundingClientRect\(\)\.height\)\)\)/,
  'catalog sticky controls must retain a safe public header offset while scrolling',
);
assert.ok(
  publicProductPage.match(/\{persistentCatalogSearch\}/g)?.length === 2,
  'product detail must preserve the same search during loading and after product content is ready',
);
assert.match(
  publicProductPage,
  /navigate\(`\/\?search=\$\{encodeURIComponent\(normalizedQuery\)\}`\)/,
  'product detail search must route into the catalog search results',
);
assert.match(
  publicProductPage,
  /aria-label="Navegação estrutural"[\s\S]*overflow-hidden whitespace-nowrap[\s\S]*max-w-\[38%\] truncate[\s\S]*flex-1 truncate/,
  'product breadcrumb must stay compact on one line and truncate long category and product labels',
);

console.log('catalog mobile navigation guard passed');
