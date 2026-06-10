import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const fileName of ['vps_server.js', 'vps_server.cjs']) {
  const source = readFileSync(fileName, 'utf8').replace(/\r\n/g, '\n');

  assert.match(
    source,
    /async function findAutoresponderProductGroupPageByCategory\(categoryId, pageSize = AUTORESPONDER_PRODUCT_PAGE_SIZE, groupOffset = 0\)/,
    `${fileName} must page category results by grouped models`
  );

  const helperBody = source.match(/async function findAutoresponderProductGroupPageByCategory[\s\S]*?\n}\n\nasync function countAutoresponderProductsByCategory/)?.[0] || '';
  assert.match(
    helperBody,
    /targetGroupCount \* 6/,
    `${fileName} must fetch extra raw rows before grouping model variations`
  );
  assert.match(
    helperBody,
    /sortAutoresponderProductGroupsByBrand\(groupAutoresponderProductsByModel\(rows\)\)/,
    `${fileName} must group and sort before slicing visible category options`
  );
  assert.doesNotMatch(
    helperBody,
    /AUTORESPONDER_PRODUCT_RESPONSE_LIMIT/,
    `${fileName} category group paging must not cap complete smartphone lists at the generic 50-product response limit`
  );
  assert.match(
    helperBody,
    /groups\.slice\(safeGroupOffset, safeGroupOffset \+ safePageSize\)/,
    `${fileName} must slice by grouped options, not raw product rows`
  );

  const completeKeywordBody = source.match(/function isAutoresponderCompleteProductListKeyword[\s\S]*?\n}\n\nfunction getAutoresponderProductQueryLimit/)?.[0] || '';
  assert.match(
    completeKeywordBody,
    /AUTORESPONDER_SMARTPHONE_CATEGORY_NAMES\.has\(text\)/,
    `${fileName} must treat exact Smartphones/Celulares category names as complete lists`
  );

  const initialPageSizeBody = source.match(/function getAutoresponderInitialProductPageSize[\s\S]*?\n}\n\nfunction chunkAutoresponderArray/)?.[0] || '';
  assert.match(
    initialPageSizeBody,
    /isAutoresponderSmartphoneCategoryName\(keyword\)[\s\S]*AUTORESPONDER_SMARTPHONE_COMPLETE_PRODUCT_RESPONSE_LIMIT/,
    `${fileName} must use the smartphone complete-list limit for Smartphones/Celulares categories`
  );

  const categoryReplyStart = source.indexOf('async function buildAutoresponderCatalogCategoryReplyData');
  const categoryReplyEnd = source.indexOf('async function buildAutoresponderGreetingCatalogReplyData', categoryReplyStart);
  const categoryReplyBody = categoryReplyStart >= 0 && categoryReplyEnd > categoryReplyStart
    ? source.slice(categoryReplyStart, categoryReplyEnd)
    : '';
  assert.match(
    categoryReplyBody,
    /findAutoresponderProductGroupPageByCategory\(selectedCategory\.id, pageSize, 0\)/,
    `${fileName} category replies must use grouped model paging`
  );
  assert.doesNotMatch(
    categoryReplyBody,
    /rows\.slice\(0, pageSize\)/,
    `${fileName} category replies must not slice raw rows before grouping`
  );

  const phoneOptInStart = source.indexOf('async function handleAutoresponderPhoneListOptIn');
  const phoneOptInEnd = source.indexOf('function getAutoresponderAiCatalogQuery', phoneOptInStart);
  const phoneOptInBody = phoneOptInStart >= 0 && phoneOptInEnd > phoneOptInStart
    ? source.slice(phoneOptInStart, phoneOptInEnd)
    : '';
  assert.match(
    phoneOptInBody,
    /findAutoresponderProductGroupPageByCategory\(selectedCategory\.id, pageSize, 0\)/,
    `${fileName} phone opt-in replies must use grouped model paging`
  );
  assert.doesNotMatch(
    phoneOptInBody,
    /rows\.slice\(0, pageSize\)/,
    `${fileName} phone opt-in replies must not slice raw rows before grouping`
  );
}

console.log('autoresponder category group page static checks passed');
