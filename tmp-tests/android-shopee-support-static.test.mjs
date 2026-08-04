import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync('android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/MainActivity.kt', 'utf8');
const domain = fs.readFileSync('android/admin-estoque/app/src/main/java/br/com/mercadodovale/adminestoque/domain/ShopeeSupport.kt', 'utf8');
const servers = [fs.readFileSync('vps_server.cjs', 'utf8'), fs.readFileSync('vps_server.js', 'utf8')];

for (const server of servers) {
  assert.match(server, /\/api\/v2\/product\/get_comment/);
  assert.match(server, /\/api\/v2\/product\/reply_comment/);
  assert.match(server, /\/api\/v2\/sellerchat\/get_conversation_list/);
  assert.match(server, /\/api\/v2\/sellerchat\/get_message/);
  assert.match(server, /\/api\/v2\/sellerchat\/send_message/);
  assert.match(server, /fastify\.get\('\/admin\/shopee\/product-reviews'/);
  assert.match(server, /fastify\.post\('\/admin\/shopee\/product-reviews\/:commentId\/reply'/);
  assert.match(server, /fastify\.get\('\/admin\/shopee\/chat\/conversations'/);
  assert.match(server, /fastify\.post\('\/admin\/shopee\/chat\/conversations\/:conversationId\/messages'/);
  assert.match(server, /comment_list: \[\{ comment_id: safeId, comment: safeComment \}\]/);
  assert.match(server, /message_type: 'text'/);
  assert.match(server, /while \(milliseconds > 8_640_000_000_000_000\) milliseconds \/= 1000/);
  assert.match(server, /conversation_id: String\(row\?\.conversation_id \|\| ''\)/);
  assert.match(server, /if \(!\/\^\\d\{1,32\}\$\/\.test\(safeConversationId\)\)/);
}

assert.match(main, /Atendimento Shopee/);
assert.match(main, /Copiar texto e abrir Shopee/);
assert.match(main, /SHOPEE_BUYER_RATING_TEMPLATE_KEY/);
assert.match(main, /showShopeeProductReviews/);
assert.match(main, /showShopeeConversations/);
assert.match(main, /showShopeeConversation/);
assert.match(domain, /data class ShopeeProductReview/);
assert.match(domain, /data class ShopeeConversation/);
assert.match(domain, /data class ShopeeChatMessage/);

console.log('Android Shopee support static contract: OK');
