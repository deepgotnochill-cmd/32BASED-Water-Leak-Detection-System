const validNodeIds = ['A', 'B', 'C', 'D'];
const validStatuses = ['NORMAL', 'WARNING', 'CRITICAL'];
const validPredictionStatuses = ['NO LEAK', 'LEAK DETECTED', 'NO CONFIRMED LEAK'];

function validationError(message) {
  return new Error(`Invalid prediction data: ${message}`);
}

function validatePrediction(prediction) {
  if (!prediction || typeof prediction !== 'object') {
    throw validationError('prediction must be an object');
  }
  if (!Array.isArray(prediction.nodes) || prediction.nodes.length !== validNodeIds.length) {
    throw validationError('nodes must contain exactly four entries');
  }

  prediction.nodes.forEach((node, index) => {
    if (!node || node.id !== validNodeIds[index]) {
      throw validationError(`node ${index} has an invalid id`);
    }
    if (!Number.isFinite(node.flow) || node.flow < 0) {
      throw validationError(`node ${node.id} has an invalid flow`);
    }
    if (!Number.isFinite(node.pressure) || node.pressure < 0) {
      throw validationError(`node ${node.id} has an invalid pressure`);
    }
    if (!validStatuses.includes(node.status)) {
      throw validationError(`node ${node.id} has an invalid status`);
    }
  });

  ['leakProbability', 'confidence'].forEach((field) => {
    if (!Number.isFinite(prediction[field]) || prediction[field] < 0 || prediction[field] > 100) {
      throw validationError(`${field} must be between 0 and 100`);
    }
  });
  if (typeof prediction.leakZone !== 'string' || !prediction.leakZone.trim()) {
    throw validationError('leakZone must be a non-empty string');
  }
  if (!validPredictionStatuses.includes(prediction.predictionStatus)) {
    throw validationError('predictionStatus is not supported');
  }
  if (typeof prediction.reason !== 'string' || !prediction.reason.trim()) {
    throw validationError('reason must be a non-empty string');
  }
  if (prediction.mode !== 'DEMO' && prediction.mode !== 'LIVE') {
    throw validationError('mode must be DEMO or LIVE');
  }

  return prediction;
}

function normalizeDemoScenario(scenario) {
  return validatePrediction({
    mode: 'DEMO',
    timestamp: new Date().toISOString(),
    nodes: scenario.nodes.map((node, index) => ({
      id: validNodeIds[index],
      flow: node.flow,
      pressure: node.pressure,
      status: node.status
    })),
    anomaly: scenario.label !== 'NORMAL',
    leakProbability: scenario.confidence,
    leakZone: scenario.zone,
    confidence: scenario.confidence,
    reason: scenario.reason,
    predictionStatus: scenario.leakStatus
  });
}

export function createPredictionAdapter({ demoScenarios, liveProvider = null } = {}) {
  return {
    mode: 'DEMO',
    getPrediction(scenarioKey) {
      try {
        if (this.mode === 'LIVE') {
          if (typeof liveProvider !== 'function') {
            return { ok: false, error: 'LIVE provider is not configured.' };
          }
          return { ok: true, data: validatePrediction(liveProvider(scenarioKey)) };
        }

        const scenario = demoScenarios?.[scenarioKey];
        if (!scenario) {
          return { ok: false, error: `Unknown demo scenario: ${scenarioKey}` };
        }
        return { ok: true, data: normalizeDemoScenario(scenario) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
    setMode(mode) {
      if (mode !== 'DEMO' && mode !== 'LIVE') {
        return { ok: false, error: 'Mode must be DEMO or LIVE.' };
      }
      this.mode = mode;
      return { ok: true };
    }
  };
}
