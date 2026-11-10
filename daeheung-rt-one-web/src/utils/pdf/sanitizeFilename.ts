/** OS 금지 문자 치환 (파일명 조각용) */
export function sanitizeFilenamePart(
  value: string,
  options?: { fallback?: string; maxLength?: number }
): string {
  const fallback = options?.fallback ?? 'file';
  const maxLength = options?.maxLength ?? 80;
  const cleaned = String(value || '')
    .trim()
    .replace(/\bprivate\s+limited\b\.?/gi, '')
    .replace(/\bprivate\s+ltd\.?\b/gi, '')
    .replace(/\bpvt\.?\s*ltd\.?\b/gi, '')
    .replace(/\bpvt\.?\s*limited\b/gi, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .replace(/^[.\s_]+|[.\s_]+$/g, '')
    .replace(/[,\s]+$/g, '');
  return cleaned.slice(0, maxLength).trim() || fallback;
}

export function ensurePdfExtension(filename: string): string {
  const base = String(filename || '').trim() || 'document';
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}
