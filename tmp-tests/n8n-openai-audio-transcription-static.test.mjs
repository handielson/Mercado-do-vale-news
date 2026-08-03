import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { patchWorkflow, summarize, OPENAI_TRANSCRIPTION_MODEL } = require('./n8n-migrate-audio-groq-to-openai.cjs');

const nodes = [
  {
    name: 'Groq - Transcrever audio',
    id: 'groq-transcribe-audio-001',
    type: 'n8n-nodes-base.httpRequest',
    parameters: {
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      bodyParameters: { parameters: [
        { name: 'file', parameterType: 'formBinaryData', inputDataFieldName: 'audio' },
        { name: 'model', value: 'whisper-large-v3-turbo' },
        { name: 'language', value: 'pt' },
      ] },
      headerParameters: { parameters: [
        { name: 'Authorization', value: '={{"Bearer " + $env.GROQ_API_KEY}}' },
      ] },
    },
  },
  {
    name: 'Audio - Resolver transcricao',
    id: 'audio-resolve-groq-001',
    type: 'n8n-nodes-base.code',
    parameters: { jsCode: "const result = { audioTranscriptionProvider: 'groq', audioTranscriptionModel: 'whisper-large-v3-turbo' }; return [{ json: result }];" },
  },
  {
    name: 'Audio - Sem transcricao?',
    id: 'audio-groq-fallback-if-001',
    type: 'n8n-nodes-base.if',
    parameters: { conditions: { conditions: [{ id: 'audio-groq-fallback-condition' }] } },
  },
];
const connections = {
  'Audio - Converter base64 em arquivo': { main: [[{ node: 'Groq - Transcrever audio', type: 'main', index: 0 }]] },
  'Groq - Transcrever audio': { main: [[{ node: 'Audio - Resolver transcricao', type: 'main', index: 0 }]] },
};

patchWorkflow(nodes, connections);
const summary = summarize(nodes, connections);
assert.equal(summary.endpoint, 'https://api.openai.com/v1/audio/transcriptions');
assert.equal(summary.model, OPENAI_TRANSCRIPTION_MODEL);
assert.equal(summary.usesOpenAiEnv, true);
assert.equal(summary.resolverUsesOpenAi, true);
assert.equal(summary.oldNodeRemoved, true);
assert.equal(summary.oldConnectionRemoved, true);
assert.equal(summary.groqRuntimeReferences, 0);
assert.equal(connections['Audio - Converter base64 em arquivo'].main[0][0].node, 'OpenAI - Transcrever audio');
assert.equal(nodes.find((node) => node.name === 'Audio - Sem transcricao?').parameters.conditions.conditions[0].id, 'audio-openai-fallback-condition');

patchWorkflow(nodes, connections);
assert.equal(summarize(nodes, connections).groqRuntimeReferences, 0);

console.log('n8n OpenAI audio transcription static checks passed');
