import assert from 'node:assert/strict';

const { resolveBlingDescription } = await import('../services/blingDescription.js');

{
  const description = resolveBlingDescription({
    descricao: 'Descricao curta do cadastro',
    descricaoComplementar: '<p>Descricao completa do produto com beneficios e detalhes.</p>',
    descricaoCurta: 'Resumo',
  });

  assert.equal(description, '<p>Descricao completa do produto com beneficios e detalhes.</p>');
}

{
  const description = resolveBlingDescription({
    descricao: 'Descricao principal',
    descricaoComplementar: '   ',
    descricaoCurta: 'Resumo',
  });

  assert.equal(description, 'Descricao principal');
}

console.log('bling-description-priority tests passed');
