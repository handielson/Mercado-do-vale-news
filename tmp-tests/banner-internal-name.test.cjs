const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Renderiza os componentes reais, isolando os serviços para não acessar a produção.
function loadComponent(file, showPreview = false) {
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  let stateIndex = 0;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react' && showPreview) return { ...React,
      useState: initial => React.useState(stateIndex++ === 4 ? true : initial),
    };
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
    if (name.includes('responsive-image-sources')) return { buildResponsiveImageSources: () => null };
    if (name.includes('ImageZoomModal')) return { ImageZoomModal: () => null };
    if (name.includes('bannerService')) return { bannerService: {} };
    if (name.includes('uploadService')) return { uploadService: {} };
    throw new Error('Import inesperado: ' + name);
  } });
  return exports;
}

const banner = { id: 'test', title: 'Celular no boleto', image_url: '/arte.png' };
test('nome identifica a imagem sem texto nem gradiente sobre a arte', () => {
  const { BannerCarousel } = loadComponent('components/catalog/BannerCarousel.tsx');
  const html = renderToStaticMarkup(React.createElement(BannerCarousel, { banners: [banner] }));
  assert.match(html, /alt="Celular no boleto"/);
  assert.doesNotMatch(html, />Celular no boleto</);
  assert.doesNotMatch(html, /bg-gradient-to-t/);
});
test('texto sobre a imagem continua opcional', () => {
  const { BannerCarousel } = loadComponent('components/catalog/BannerCarousel.tsx');
  const html = renderToStaticMarkup(React.createElement(BannerCarousel, { banners: [{ ...banner, subtitle: 'Texto escolhido' }] }));
  assert.match(html, />Texto escolhido</);
  assert.doesNotMatch(html, />Celular no boleto</);
});
test('formulário explica o uso interno e a prévia não cobre a arte', () => {
  const { BannerForm } = loadComponent('components/admin/BannerForm.tsx', true);
  const html = renderToStaticMarkup(React.createElement(BannerForm, { banner, onSave: async () => {}, onClose: () => {} }));
  assert.match(html, /Nome do banner \(uso interno\)/);
  assert.match(html, /Não aparece sobre a imagem no site/);
  assert.match(html, /Texto sobre a imagem/);
  assert.match(html, /alt="Celular no boleto"/);
  assert.doesNotMatch(html, />Celular no boleto</);
  assert.doesNotMatch(html, /bg-gradient-to-t/);
});
