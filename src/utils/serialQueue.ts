/**
 * Aynı SQLite bağlantısına giden işleri sıraya koyan küçük yardımcılar.
 *
 * ADR-002: tek bağlantıda `Promise.all` ile paralel sorgu "shared object
 * already released" çökmesine yol açabiliyor. Ekranlar birden çok yenileme
 * zincirini aynı anda başlatmak yerine bunları sırayla çalıştırmalıdır (BUG-12).
 */

/** Görevleri sırayla bekler; biri hata verse de kalanlar çalışır. */
export async function runSequentially(
  tasks: ReadonlyArray<() => unknown>,
  onError?: (error: unknown) => void,
): Promise<void> {
  for (const task of tasks) {
    try {
      await task();
    } catch (error) {
      onError?.(error);
    }
  }
}

/**
 * Kuyruğa eklenen işler birbiriyle asla örtüşmez; önceki işin reddi sonrakini
 * durdurmaz. Her çağrı kendi işinin sonucunu (veya hatasını) döndürür.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}
