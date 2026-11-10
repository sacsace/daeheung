/** 표준 직책 KO → EN (직책 마스터에 한글명으로 저장된 경우 표시용) */
const POSITION_KO_TO_EN: Record<string, string> = {
  대표이사: 'CEO',
  대표: 'CEO',
  부사장: 'Vice President',
  부대표: 'Vice President',
  전무: 'Executive Managing Director',
  상무: 'Managing Director',
  이사: 'Director',
  부장: 'General Manager',
  차장: 'Deputy General Manager',
  과장: 'Manager',
  대리: 'Assistant Manager',
  주임: 'Supervisor',
  사원: 'Staff',
  // 영문/혼합으로 저장된 경우
  ceo: 'CEO',
  'chief executive officer': 'CEO',
  'vice president': 'Vice President',
  vp: 'Vice President',
  'executive vice president': 'Vice President',
  'executive director': 'Executive Director',
  director: 'Director',
  manager: 'Manager',
  staff: 'Staff',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolvePositionNames(name?: string | null): { ko: string; en: string } {
  const raw = String(name || '').trim();
  if (!raw) return { ko: '', en: '' };

  if (POSITION_KO_TO_EN[raw]) {
    return { ko: raw, en: POSITION_KO_TO_EN[raw] };
  }

  const norm = normalizeKey(raw);
  const koExact = Object.keys(POSITION_KO_TO_EN).find((k) => normalizeKey(k) === norm);
  if (koExact && /[가-힣]/.test(koExact)) {
    return { ko: koExact, en: POSITION_KO_TO_EN[koExact] };
  }
  if (koExact) {
    // 영문 키로 매칭된 경우 — 한글 역매핑
    const koPair = Object.entries(POSITION_KO_TO_EN).find(
      ([k, en]) => /[가-힣]/.test(k) && normalizeKey(en) === normalizeKey(POSITION_KO_TO_EN[koExact])
    );
    return { ko: koPair?.[0] || raw, en: POSITION_KO_TO_EN[koExact] };
  }

  const byEn = Object.entries(POSITION_KO_TO_EN).find(
    ([k, en]) => /[가-힣]/.test(k) && normalizeKey(en) === norm
  );
  if (byEn) return { ko: byEn[0], en: byEn[1] };

  return { ko: raw, en: raw };
}

/**
 * 직책 표시 라벨.
 * - bilingual(기본): 한국어 UI → `대표이사 (CEO)`, 영어 UI → `CEO (대표이사)`
 * - bilingual=false: 현재 언어 쪽 이름만
 */
export function formatPositionLabel(
  name?: string | null,
  language?: string,
  bilingual = true
): string {
  const { ko, en } = resolvePositionNames(name);
  if (!ko && !en) return '';
  if (!bilingual || !en || !ko || ko === en) {
    return language === 'en' ? en || ko : ko || en;
  }
  return language === 'en' ? `${en} (${ko})` : `${ko} (${en})`;
}
