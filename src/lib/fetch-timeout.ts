/**
 * Wraps a fetch function so every request aborts after `ms`. A signal the caller passes still
 * works: whichever fires first aborts the request.
 */
export function withTimeout(fetchFn: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([timeout, init.signal]) : timeout;
    return fetchFn(input, { ...init, signal });
  };
}
