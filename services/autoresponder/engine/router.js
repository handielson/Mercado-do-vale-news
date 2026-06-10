async function routeAutoresponderMessage(args) {
  const { message, state, handlers } = args;

  const activeFlow = handlers.activeFlow;
  if (state.flow !== 'none') {
    if (activeFlow?.canHandle(args)) {
      return activeFlow.handle(args);
    }
  }

  const controlledAi = handlers.controlledAi;
  if (controlledAi?.canHandle(args)) {
    return controlledAi.handle(args);
  }

  const manualRule = handlers.manualRule;
  if (manualRule?.canHandle(args)) {
    return manualRule.handle(args);
  }

  const knownIntent = handlers.knownIntent;
  if (knownIntent?.canHandle(args)) {
    return knownIntent.handle(args);
  }

  const productSearch = handlers.productSearch;
  if (productSearch?.canHandle(args)) {
    return productSearch.handle(args);
  }

  const globalFallback = handlers.globalFallback;
  return globalFallback.handle({ ...args, message });
}

export {
  routeAutoresponderMessage,
};
