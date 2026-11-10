/** 첫 글자 대문자, 나머지 소문자 */
export function toSentenceCase(value: string | null | undefined): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
