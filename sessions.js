// In-memory per-conversation history, keyed by WhatsApp sender id.
// Fine for a single always-on instance; move to a real store (Stage 2)
// once you need history to survive a restart or run multiple instances.
const sessions = new Map();
const MAX_TURNS = 20;

export function getHistory(id) {
  return sessions.get(id) || [];
}

export function appendTurn(id, role, content) {
  const history = getHistory(id);
  history.push({ role, content });
  if (history.length > MAX_TURNS) history.splice(0, history.length - MAX_TURNS);
  sessions.set(id, history);
  return history;
}
