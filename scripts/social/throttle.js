const fs = require('fs');
const path = require('path');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJsonSafe(relPath, fallback) {
  const filePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(relPath, value) {
  const filePath = path.resolve(process.cwd(), relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function createThrottle(options = {}) {
  const defaults = {
    sourceKey: 'global',
    delayMs: Number(process.env.REDDIT_PUBLIC_DELAY_MS || 900),
    maxRequests: Number(process.env.SIGNAL_SOURCE_LIMIT || 0) || Infinity,
    maxRuntimeMs: Number(process.env.SIGNAL_SOURCE_TIMEOUT_MS || 7000),
    retryLimit: 1,
    backoffMs: 500,
    stateFile: 'data/content_refresh_state.json'
  };
  const cfg = { ...defaults, ...options };
  let requestCount = 0;
  const startedAt = Date.now();

  async function run(task) {
    if (requestCount >= cfg.maxRequests) {
      throw new Error(`Throttle limit reached for ${cfg.sourceKey}`);
    }
    if (Date.now() - startedAt > cfg.maxRuntimeMs) {
      throw new Error(`Throttle runtime exceeded for ${cfg.sourceKey}`);
    }
    requestCount += 1;
    let lastError = null;
    for (let attempt = 0; attempt <= cfg.retryLimit; attempt += 1) {
      try {
        if (attempt > 0) await sleep(cfg.backoffMs * attempt);
        const result = await task();
        await sleep(cfg.delayMs);
        return result;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  function checkpoint(extra = {}) {
    const existing = readJsonSafe(cfg.stateFile, {});
    writeJson(cfg.stateFile, {
      ...existing,
      last_refresh_started_at: existing.last_refresh_started_at || new Date(startedAt).toISOString(),
      throttle: {
        source_key: cfg.sourceKey,
        request_count: requestCount,
        updated_at: new Date().toISOString(),
        max_requests: Number.isFinite(cfg.maxRequests) ? cfg.maxRequests : null,
        max_runtime_ms: cfg.maxRuntimeMs,
        retry_limit: cfg.retryLimit
      },
      ...extra
    });
  }

  return { run, checkpoint };
}

module.exports = { createThrottle, sleep };
