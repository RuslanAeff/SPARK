/** Tarayıcı son hata — bildirim merkezi için (ağ / parse). */
let lastScanError: string | null = null;

export function setScanSessionError(message: string | null): void {
  lastScanError = message;
}

export function getScanSessionError(): string | null {
  return lastScanError;
}
