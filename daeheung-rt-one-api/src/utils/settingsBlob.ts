/** settings JSON(회사/사용자) 공통 파서 */
export function parseSettingsBlob(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o !== null ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return { ...(raw as Record<string, unknown>) };
  return {};
}
