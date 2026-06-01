import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const service = readFileSync('services/reviews.ts', 'utf8');
const page = readFileSync('pages/admin/catalog/ReviewsPage.tsx', 'utf8');

assert.match(service, /vpsClient/, 'reviews service must use vpsClient');
assert.match(service, /\/table-data\/product_reviews/, 'reviews service must use VPS table-data for product_reviews');
assert.match(service, /loadTableRows<CustomerSummary>\('customers'\)/, 'reviews service must enrich customers through VPS table-data');
assert.match(service, /deleteReview/, 'reviews service must expose deleteReview for the admin page');
assert.doesNotMatch(service, /\.from\('product_reviews'\)|supabase\.from\('product_reviews'\)/, 'reviews service must not use Supabase for product_reviews');
assert.doesNotMatch(page, /from ['"]\.\.\/\.\.\/\.\.\/services\/supabase['"]|supabase\.from\('product_reviews'\)/, 'reviews admin page must not delete reviews through Supabase');
assert.match(page, /reviewService\.deleteReview/, 'reviews admin page must delete reviews through reviewService');

console.log('reviews service VPS static checks passed');
