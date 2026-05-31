function isPerfLoggingEnabled() {
  return process.env.DEBUG_PERF === "true";
}

export function startPerfTimer() {
  return isPerfLoggingEnabled() ? Date.now() : null;
}

export function logPerf(label: string, startedAt: number | null, metadata?: Record<string, unknown>) {
  if (!startedAt || !isPerfLoggingEnabled()) {
    return;
  }

  const durationMs = Date.now() - startedAt;
  if (metadata) {
    console.info(`[perf] ${label} ${durationMs}ms`, metadata);
    return;
  }

  console.info(`[perf] ${label} ${durationMs}ms`);
}
