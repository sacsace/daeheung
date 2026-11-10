import { ensurePdfExtension, sanitizeFilenamePart } from './sanitizeFilename';

/**
 * 문서 다운로드 파일명 접두 코드
 * - PV: 지출결의서
 * - Invoice: 발행 인보이스
 * - RI: Tax Invoice (받은 인보이스)
 * - PI: Proforma / 인보이스 없음 첨부
 * - Quot: 발행 견적서
 * - RQuot: 받은 견적서
 * - RPO: 받은 PO (Purchase Order)
 * - WO: 워크오더 (Work Order)
 * - RWO: 받은 워크오더
 * - RT: 송금 확인증 (Remittance)
 */
export type DocumentDownloadCode =
  | 'PV'
  | 'Invoice'
  | 'RI'
  | 'PI'
  | 'Quot'
  | 'RQuot'
  | 'RPO'
  | 'WO'
  | 'RWO'
  | 'RT';

/** yyyyMMdd (로컬 기준) */
export function formatDownloadDateToken(date?: Date | string | null): string {
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string' && date.trim()) {
    const parsed = new Date(date.includes('T') ? date : `${date.trim().slice(0, 10)}T00:00:00`);
    d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    d = new Date();
  }
  if (Number.isNaN(d.getTime())) d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
}

export type BuildDocumentDownloadFilenameOptions = {
  code: DocumentDownloadCode;
  companyName?: string | null;
  detail?: string | null;
  date?: Date | string | null;
  /** 기본 pdf. 빈 문자열이면 확장자 없음 */
  extension?: string;
  companyMaxLength?: number;
  detailMaxLength?: number;
  /** true면 `(세부사항)` 생략 — 예: 송금확인증 `yyyyMMdd_RT (협력업체명)` */
  omitDetail?: boolean;
};

/**
 * 표준 패턴: `yyyyMMdd_{Code} (회사명) (세부사항).pdf`
 * 예: `20260902_PV (Minsub Ventures) (test).pdf`
 * omitDetail 시: `yyyyMMdd_{Code} (회사명).ext`
 */
export function buildDocumentDownloadFilename(
  options: BuildDocumentDownloadFilenameOptions
): string {
  const ymd = formatDownloadDateToken(options.date);
  const company = sanitizeFilenamePart(String(options.companyName || ''), {
    fallback: 'Company',
    maxLength: options.companyMaxLength ?? 60,
  });
  const base = options.omitDetail
    ? `${ymd}_${options.code} (${company})`
    : (() => {
        const detail = sanitizeFilenamePart(String(options.detail || ''), {
          fallback: options.code,
          maxLength: options.detailMaxLength ?? 40,
        });
        return `${ymd}_${options.code} (${company}) (${detail})`;
      })();
  const ext = options.extension === undefined ? 'pdf' : options.extension;
  if (!ext) return base;
  return ext.toLowerCase() === 'pdf' ? ensurePdfExtension(base) : `${base}.${ext.replace(/^\./, '')}`;
}
