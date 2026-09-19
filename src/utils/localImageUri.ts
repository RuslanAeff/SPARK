/** Only local picker sources may reach native Image; backups never grant this trust. */
export function isLocalImageUri(uri: unknown): uri is string {
  return typeof uri === 'string' && /^(file:\/\/\/|content:\/\/|ph:\/\/|assets-library:\/\/)/.test(uri)
    && !/[\x00-\x20]/.test(uri);
}
