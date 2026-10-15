'use strict';
// Serialized into the isolated n8n-container smoke harness. `root` points at the
// installed nodes directory; memory, tools and delivery services remain absent.
async function invokeNativeAgent(m, agentNode, source, renderedSystem, renderedText) {
  const execute = require(root + '/agents/Agent/agents/ToolsAgent/V3/execute.js').toolsAgentExecute;
  const parameters = { ...agentNode.parameters, text: renderedText,
    options: { ...agentNode.parameters.options, systemMessage: renderedSystem } };
  const node = { ...agentNode, parameters };
  const ctx = {
    getNode: () => node,
    getNodeParameter: (name, index, fallback) => {
      const value = name.split('.').reduce((current, key) => current?.[key], parameters);
      return value === undefined ? fallback : value;
    },
    getInputData: () => [{ json: source }],
    getInputConnectionData: async type => type === 'ai_languageModel' ? m : type === 'ai_tool' ? [] : undefined,
    getNodeInputs: () => [],
    getNodeOutputs: () => [],
    getNodeInputConnections: () => [],
    getWorkflow: () => ({ id: 'isolated-native-smoke', name: 'Synthetic isolated test', nodes: [] }),
    getExecutionId: () => 'isolated-native-smoke',
    getExecutionCancelSignal: () => new AbortController().signal,
    getMode: () => 'manual',
    getWorkflowSettings: () => ({}),
    getContext: () => ({}),
    isStreaming: () => false,
    continueOnFail: () => false,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    customData: { set() {} },
    setMetadata() {},
    addInputData() {},
    addOutputData() {},
    helpers: {},
  };
  const response = await execute.call(ctx);
  const result = response?.[0]?.[0]?.json;
  if (typeof result?.output !== 'string' || !result.output.trim()) {
    throw Error('Native Agent returned no text output');
  }
  return result.output;
}
module.exports = { invokeNativeAgent };
