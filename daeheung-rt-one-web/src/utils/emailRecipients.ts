function isValidEmailToken(s: string): boolean {
  const t = s.trim();
  if (!t || /\s/.test(t)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export type ParseEmailRecipientsResult =
  | { ok: true; emails: string[] }
  | { ok: false; message: string };

/** 쉼표·세미콜론 구분 다중 이메일 (서버와 동일 규칙) */
export function parseEmailRecipientsList(raw: string | null | undefined): ParseEmailRecipientsResult {
  if (raw == null || String(raw).trim() === '') {
    return { ok: true, emails: [] };
  }
  const parts = String(raw)
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { ok: true, emails: [] };
  }
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const p of parts) {
    if (!isValidEmailToken(p)) {
      return { ok: false, message: p };
    }
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      emails.push(p);
    }
  }
  return { ok: true, emails };
}
