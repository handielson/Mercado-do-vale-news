import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cart = readFileSync('pages/store/CartPage.tsx', 'utf8');
const checkout = readFileSync('pages/store/CheckoutPage.tsx', 'utf8');
const deliveryOptions = readFileSync('components/catalog/DeliveryOptions.tsx', 'utf8');

assert.match(cart, /const openMercadoPagoCheckout = \(\) => \{[\s\S]*?navigate\('\/checkout', \{[\s\S]*?delivery,/, 'desktop and mobile Mercado Pago actions must preserve the cart delivery selection');
assert.equal((cart.match(/onClick=\{openMercadoPagoCheckout\}/g) || []).length, 2, 'desktop and mobile must share the same checkout navigation');
assert.match(cart, /Mercado Pago[\s\S]*?min-w-0 flex-1 text-left/, 'Mercado Pago text must align with the other right-side actions');

assert.match(checkout, /import \{ DeliveryOptions, type DeliveryOption \}/, 'checkout must reuse the canonical delivery selector');
assert.match(checkout, /sessionStorage\.getItem\('mv_cart_delivery'\)/, 'checkout must recover delivery after login or reload');
assert.match(checkout, /<DeliveryOptions[\s\S]*?selected=\{delivery\}[\s\S]*?onSelect=/, 'checkout must display CEP and freight selection before payment');
assert.match(checkout, /Math\.round\(\(delivery\.shippingOption\?\.price \?\? 0\) \* 100\)/, 'freight must be converted from reais to order cents');
assert.match(checkout, /delivery_type: delivery\.type[\s\S]*?shipping_address: shippingAddress[\s\S]*?shipping_cost: shippingCost/, 'created order must include delivery type, address and freight');
assert.match(checkout, /delivery\.address\.cep[\s\S]*?delivery\.address\.number/, 'created order must use the address returned by CEP selection');
assert.match(checkout, /!delivery\.address\?\.number\?\.trim\(\)/, 'home delivery must require the address number');

assert.equal((deliveryOptions.match(/type="button"/g) || []).length, 5, 'delivery controls inside checkout must never submit the order accidentally');
assert.doesNotMatch(deliveryOptions, /onBlur=\{handleCEPLookup\}/, 'CEP button must not duplicate the quote through blur and click');
assert.match(deliveryOptions, /event\.key === 'Enter'[\s\S]*?handleCEPLookup\(\)/, 'CEP quote must remain keyboard accessible');
assert.match(deliveryOptions, /shippingOption: type === 'pickup' \? undefined/, 'pickup must clear stale freight from the delivery state');
assert.match(deliveryOptions, /const refreshedOption = res\.options\.find[\s\S]*?shippingOption: refreshedOption \|\| res\.options\[0\]/, 'recalculation must refresh the selected freight price');

console.log('cart and checkout delivery checks passed');
