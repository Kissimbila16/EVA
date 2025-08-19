const { v4: uuidv4 } = require("uuid");

const interactionContext = new Map();

function updateContext(sessionId, text, intent, entities) {
  if (!interactionContext.has(sessionId)) {
    interactionContext.set(sessionId, { lastIntent: null, history: [] });
  }
  const sessionContext = interactionContext.get(sessionId);
  sessionContext.history.push({ text, intent, entities, timestamp: Date.now() });
  if (sessionContext.history.length > 10) sessionContext.history.shift();
  sessionContext.lastIntent = intent;
  interactionContext.set(sessionId, sessionContext);
  return sessionContext;
}

function getContext(sessionId) {
  return interactionContext.get(sessionId) || { lastIntent: null, history: [] };
}

module.exports = { updateContext, getContext, uuidv4 };