# Versao Atual

``text
version: v1.1.84-shopee-attributes-specs
date: 2026-06-21
status: published
release_vps: /var/www/mdv-site/releases/20260621-145826-v1184-shopee-attributes-specs
branch: codex/publish-delivery-ops-20260614
summary: Atributos Shopee aparecem como campos editaveis no JSON/IA, sao salvos com labels para a vitrine publica e Saude da Bateria deixa de ser campo tecnico global.
``

## O que entrou no v1.1.84

- Atributos da categoria Shopee agora aparecem como campos editaveis no bloco "Campos tecnicos editaveis" da aba JSON / IA do cadastro de modelos.
- Cada atributo Shopee preenchido sincroniza com o JSON shopee_attribute_defaults, mantendo a aba Shopee compativel com edicao em massa.
- O modelo salva tambem shopee_attribute_labels e shopee_attribute_required, permitindo exibir os atributos com nomes legiveis na pagina publica do produto.
- A pagina publica transforma os atributos Shopee preenchidos em especificacoes visiveis e oculta as chaves internas de integracao.
- attery_health deixou de ser fallback/spec tecnico global em modelos e categorias novas, e a vitrine publica oculta o campo legado generico.
- Protecoes contra regressao em 	mp-tests/model-shopee-attributes-json-section-static.test.mjs e 	mp-tests/shopee-public-specs-and-battery-health-static.test.mjs.

## Validacoes

- 
ode tmp-tests\\model-shopee-attributes-json-section-static.test.mjs
- 
ode tmp-tests\\shopee-public-specs-and-battery-health-static.test.mjs
- 
pm.cmd run build fora do sandbox apos spawn EPERM no Vite dentro do sandbox.
