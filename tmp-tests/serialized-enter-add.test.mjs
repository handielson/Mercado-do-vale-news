import assert from 'node:assert/strict';
import { shouldAddSerializedFieldToBatchOnEnter } from '../components/products/serializedBatch.js';

assert.equal(
  shouldAddSerializedFieldToBatchOnEnter({ key: 'serial', value: 'AT2209901450', hasBatchHandler: true }),
  true,
  'Enter em serial preenchido deve adicionar a lista em massa'
);

assert.equal(
  shouldAddSerializedFieldToBatchOnEnter({ key: 'serial', value: '   ', hasBatchHandler: true }),
  false,
  'Serial vazio nao deve adicionar a lista'
);

assert.equal(
  shouldAddSerializedFieldToBatchOnEnter({ key: 'color', value: 'Preto', hasBatchHandler: true }),
  false,
  'Campos nao serializados nao devem acionar a lista'
);

assert.equal(
  shouldAddSerializedFieldToBatchOnEnter({ key: 'serial', value: 'AT2209901450', hasBatchHandler: false }),
  false,
  'Sem handler de lote, Enter nao deve acionar cadastro em massa'
);
