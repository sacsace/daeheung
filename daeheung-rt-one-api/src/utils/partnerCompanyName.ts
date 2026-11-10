/**
 * Normalize partner company display names to a consistent pattern:
 * - Expand "Pvt Ltd" (and common variants) → "Private Limited"
 * - Title-case each word (first letter upper, rest lower), keeping digits/punctuation
 */
export function normalizePartnerCompanyName(raw: unknown): string {
  let s = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2000-\u200B\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';

  // Abbreviation expansions (before casing) — cover spaced / dotted / glued forms
  s = s.replace(/\bpvt\.?\s*ltd\.?\b/gi, 'Private Limited');
  s = s.replace(/\bpvt\.ltd\.?\b/gi, 'Private Limited');
  s = s.replace(/\bprivate\s+ltd\.?\b/gi, 'Private Limited');
  s = s.replace(/\bpvt\.?\s*limited\b/gi, 'Private Limited');
  s = s.replace(/\bpvtltd\b/gi, 'Private Limited');
  s = s.replace(/\bpvt[\s._-]*ltd\b/gi, 'Private Limited');

  // Title-case alphanumeric runs inside each whitespace-separated token
  // e.g. AXIS BANK(27) → Axis Bank(27), SEDA ENGINEERING PVT LTD → Seda Engineering Private Limited
  return s
    .split(' ')
    .map((token) =>
      token.replace(/[A-Za-z0-9]+/g, (word) => {
        if (/^\d+$/.test(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
    )
    .join(' ');
}

export default normalizePartnerCompanyName;
