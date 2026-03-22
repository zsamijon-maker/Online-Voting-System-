const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ABORT_ERR',
  'UND_ERR_CONNECT_TIMEOUT',
]);

export function isTransientNetworkError(errOrMsg) {
  const message = typeof errOrMsg === 'string'
    ? errOrMsg
    : String(errOrMsg?.message ?? '');

  const code = errOrMsg?.code ?? errOrMsg?.cause?.code;

  if (code && TRANSIENT_NETWORK_CODES.has(code)) return true;

  return (
    message.includes('fetch failed') ||
    message.includes('ECONNRESET') ||
    message.includes('aborted') ||
    message.includes('network') ||
    message.includes('timed out')
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry(fn, options = {}) {
  const retries = Number(options.retries ?? 3);
  const baseDelayMs = Number(options.baseDelayMs ?? 250);
  const jitterMs = Number(options.jitterMs ?? 100);

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    let result;

    try {
      result = await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt === retries) throw error;

      const backoff = baseDelayMs * attempt;
      const jitter = Math.floor(Math.random() * (jitterMs + 1));
      await wait(backoff + jitter);
      continue;
    }

    if (result?.error && isTransientNetworkError(result.error)) {
      lastError = result.error;
      if (attempt === retries) {
        const error = new Error(result.error.message ?? 'Transient upstream error');
        error.isTransientNetworkError = true;
        throw error;
      }

      const backoff = baseDelayMs * attempt;
      const jitter = Math.floor(Math.random() * (jitterMs + 1));
      await wait(backoff + jitter);
      continue;
    }

    return result;
  }

  const error = new Error(lastError?.message ?? 'Transient upstream error');
  error.isTransientNetworkError = true;
  throw error;
}
