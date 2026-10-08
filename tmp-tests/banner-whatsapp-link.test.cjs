const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
function load(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, require: dependencies, alert: message => { throw new Error(message); }, console });
  return exports;
}
const welcome = load('services/welcomeMessageService.ts', () => ({ vpsApiService: {} }));
const links = load('utils/bannerWhatsAppLink.ts', () => welcome);
test('link normaliza país e DDD, codifica mensagem e recupera edição', () => {
  const message = 'Quero um celular no boleto\nOlá! 📱 & preço?';
  for (const phone of ['(87) 98803-2612', '+55 (87) 98803-2612', '5587988032612']) {
    const link = links.getBannerWhatsAppLink(phone, message);
    assert.equal(new URL(link).pathname, '/5587988032612');
    assert.equal(new URL(link).searchParams.get('text'), message);
    assert.equal(links.parseBannerWhatsAppLink(link).message, message);
  }
  assert.equal(new URL(links.getBannerWhatsAppLink('(55) 99999-1234', message)).pathname, '/5555999991234');
  assert.equal(links.getBannerWhatsAppLink('123', message), '');
  assert.equal(links.getBannerWhatsAppLink('87988032612', '  '), '');
  assert.equal(links.parseBannerWhatsAppLink('https://evil.example/5587988032612'), null);
  assert.equal(links.parseBannerWhatsAppLink('https://wa.me.evil.example/5587988032612'), null);
  assert.equal(links.parseBannerWhatsAppLink('https://api.whatsapp.com/send?phone=5587988032612&text=Oi').message, 'Oi');
});

test('formulário gera e salva link externo, reabre WhatsApp e preserva URLs comuns', async () => {
  const states = []; let index = 0;
  const mockReact = { ...React, useState: initial => {
    const slot = index++;
    if (!(slot in states)) states[slot] = initial;
    return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
  }, useEffect: () => {}, useRef: () => ({ current: null }) };
  const { BannerForm } = load('components/admin/BannerForm.tsx', name => {
    if (name === 'react') return mockReact;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    if (name.includes('bannerWhatsAppLink')) return links;
    if (name.includes('uploadService')) return { uploadService: {} };
    if (name.includes('companySettingsService')) return { companySettingsService: {} };
    throw new Error(name);
  });
  let saved;
  const props = { onSave: async data => { saved = data; }, onClose: () => {},
    banner: { title: 'Boleto', image_url: '/image.png', link_type: 'external', link_target: links.getBannerWhatsAppLink('87988032612', 'Quero um celular no boleto') } };
  function render() { index = 0; return BannerForm(props); }
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props?.children)) { const match = find(child, predicate); if (match) return match; }
    return null;
  }
  let tree = render();
  assert.equal(states[0].link_type, 'whatsapp');
  find(tree, node => node.props.id === 'banner-whatsapp-message').props.onChange({ target: { value: 'Quero outra oferta & mais detalhes' } });
  tree = render();
  const generated = find(tree, node => node.props.id === 'banner-whatsapp-link').props.value;
  assert.equal(new URL(generated).searchParams.get('text'), 'Quero outra oferta & mais detalhes');
  await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(saved.link_type, 'external');
  assert.equal(saved.link_target, generated);
  assert.equal('whatsapp_message' in saved, false);
  states.length = 0;
  props.banner.link_target = 'https://example.com/oferta';
  tree = render();
  assert.equal(states[0].link_type, 'external');
  await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(saved.link_target, 'https://example.com/oferta');
});
