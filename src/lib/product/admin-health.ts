type HealthEvent = {
  id: string;
  at: string;
  kind: "sync" | "refresh" | "predict" | "error";
  message: string;
  meta?: Record<string, unknown>;
};

const events: HealthEvent[] = [];
const MAX_EVENTS = 80;

export function recordHealthEvent(
  kind: HealthEvent["kind"],
  message: string,
  meta?: Record<string, unknown>,
) {
  events.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    at: new Date().toISOString(),
    kind,
    message,
    meta,
  });
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
}

export function listHealthEvents(limit = 30) {
  return events.slice(0, limit);
}

export function getAdminSnapshot() {
  const recent = listHealthEvents(40);
  const predicts = recent.filter((e) => e.kind === "predict").length;
  const refreshes = recent.filter((e) => e.kind === "refresh").length;
  const syncs = recent.filter((e) => e.kind === "sync").length;
  const errors = recent.filter((e) => e.kind === "error").length;

  return {
    predicts,
    refreshes,
    syncs,
    errors,
    recent,
    status: errors > 3 ? "degraded" : "healthy",
  };
}
