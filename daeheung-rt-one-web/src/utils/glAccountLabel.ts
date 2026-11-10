import { formatEnglishSentenceLabel } from './textCase';

type GlAccountLike = {
  code: string;
  name: string;
  name_en?: string | null;
};

/** UI 언어에 맞는 계정 표시명 (코드 + 이름) */
export function getGlAccountLabel(account: GlAccountLike, language: string): string {
  const useEn = language.startsWith('en');
  const name = formatEnglishSentenceLabel(useEn && account.name_en ? account.name_en : account.name);
  return `${account.code} ${name}`.trim();
}

/** UI 언어에 맞는 계정명만 (코드 제외, 문장 케이스) */
export function getGlAccountName(account: GlAccountLike, language: string): string {
  const useEn = language.startsWith('en');
  return formatEnglishSentenceLabel(useEn && account.name_en ? account.name_en : account.name);
}
