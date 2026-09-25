export function timedDatabase(database, metrics) {
  return {
    async query(...args) {
      const started = performance.now();
      metrics.queries += 1;
      try { return await database.query(...args); }
      finally { metrics.queryMs += performance.now() - started; }
    },
    async connect() {
      const started = performance.now();
      let client;
      try { client = await database.connect(); }
      finally { metrics.connectionMs += performance.now() - started; }
      return { ...timedDatabase(client, metrics), release: () => client.release() };
    },
  };
}

export function timingHeader(metrics, totalMs) {
  return `app;dur=${totalMs.toFixed(1)}, db_connect;dur=${metrics.connectionMs.toFixed(1)}, db_queries;dur=${metrics.queryMs.toFixed(1)};desc="${metrics.queries} queries"`;
}
