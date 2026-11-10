/** 단순 이메일 형식 검사 (다중 수신자 목록용) */
function isValidEmailToken(s: string): boolean {
  const t = s.trim();
  if (!t || /\s/.test(t)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export type ParseEmailRecipientsResult =
  | { ok: true; emails: string[] }
  | { ok: false; message: string };

export function isParseEmailRecipientsFailure(
  r: ParseEmailRecipientsResult
): r is { ok: false; message: string } {
  return r.ok === false;
}

/**
 * 쉼표·세미콜론으로 구분된 수신자 문자열을 파싱합니다.
 * 공백 제거, 중복 제거(대소문자 무시), 형식 오류 시 실패 반환.
 */
export function parseEmailRecipientsList(raw: string | null | undefined): ParseEmailRecipientsResult {
  if (raw == null || String(raw).trim() === '') {
    return { ok: true as const, emails: [] };
  }
  const parts = String(raw)
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { ok: true as const, emails: [] };
  }
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const p of parts) {
    if (!isValidEmailToken(p)) {
      return {
        ok: false as const,
        message: `유효하지 않은 이메일 주소가 있습니다: ${p}`
      };
    }
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      emails.push(p);
    }
  }
  return { ok: true as const, emails };
}
