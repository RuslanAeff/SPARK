export interface BoundedResponse { ok: boolean; status: number; body: string }

function abortError(): Error {
  const error = new Error('REQUEST_ABORTED');
  error.name = 'AbortError';
  return error;
}

/** Deadline includes body consumption. Streaming runtimes also bound bytes in flight.
 * RN's non-streaming fetch can buffer natively before text(); the post-read cap
 * protects parsing, but cannot guarantee native peak memory usage. */
export async function fetchBoundedText(
  url: string,
  options: RequestInit | undefined,
  timeoutMs: number,
  externalSignal?: AbortSignal,
  maxBytes = 2 * 1024 * 1024,
): Promise<BoundedResponse> {
  const controller = new AbortController();
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => { controller.abort(); rejectAbort(abortError()); };
  const timer = setTimeout(abort, timeoutMs);
  externalSignal?.addEventListener('abort', abort, { once: true });
  const work = async () => {
    if (externalSignal?.aborted) throw abortError();
    const response = await fetch(url, { ...options, signal: controller.signal });
    const declared = Number(response.headers?.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
    let body: string;
    if (response.body?.getReader && typeof TextDecoder !== 'undefined') {
      const reader = response.body.getReader();
      const cancel = () => { void reader.cancel().catch(() => {}); };
      controller.signal.addEventListener('abort', cancel, { once: true });
      const decoder = new TextDecoder();
      const chunks: string[] = [];
      let bytes = 0;
      try {
        while (true) {
          if (controller.signal.aborted) throw abortError();
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
          chunks.push(decoder.decode(value, { stream: true }));
        }
        chunks.push(decoder.decode());
        body = chunks.join('');
      } finally {
        cancel();
        controller.signal.removeEventListener('abort', cancel);
      }
    } else {
      body = await response.text();
      // UTF-8 byte count without relying on TextEncoder in native runtimes.
      let bytes = 0;
      for (const character of body) {
        const point = character.codePointAt(0)!;
        bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
        if (bytes > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
      }
    }
    if (controller.signal.aborted) throw abortError();
    return { ok: response.ok, status: response.status, body };
  };
  try {
    return await Promise.race([work(), aborted]);
  } finally {
    controller.abort();
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abort);
  }
}
