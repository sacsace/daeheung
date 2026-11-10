type BilingualRow = {
  name_ko?: string | null;
  name_en?: string | null;
};

type TdsRow = {
  description?: string | null;
  description_en?: string | null;
};

/** UI 언어에 맞는 한·영 병기 마스터명 */
export function getBilingualName(row: BilingualRow, language: string): string {
  const useEn = language.startsWith('en');
  if (useEn && row.name_en?.trim()) return row.name_en.trim();
  return row.name_ko?.trim() || row.name_en?.trim() || '-';
}

/** UI 언어에 맞는 TDS 설명 */
export function getTdsDescription(row: TdsRow, language: string): string {
  const useEn = language.startsWith('en');
  if (useEn && row.description_en?.trim()) return row.description_en.trim();
  return row.description?.trim() || row.description_en?.trim() || '-';
}
