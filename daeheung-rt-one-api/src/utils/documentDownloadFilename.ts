import fs from 'fs';
import path from 'path';
import { getUploadRoot } from './uploadPath';

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

export type DocumentDownloadCode = 'PV' | 'PI' | 'RT' | 'RI' | 'Invoice';

/**
 * 표준 패턴: `yyyyMMdd_{Code} (회사명) (세부사항).ext`
 * 예: `20260905_PI (Minsub Ventures) (AMC).pdf`
 */
export function buildDocumentDownloadFilename(options: {
  code: DocumentDownloadCode;
  companyName?: string | null;
  detail?: string | null;
  date?: Date | string | null;
  extension?: string;
  companyMaxLength?: number;
  detailMaxLength?: number;
}): string {
  const ymd = formatDownloadDateToken(options.date);
  const company = sanitizeFilenamePart(String(options.companyName || ''), {
    fallback: 'Company',
    maxLength: options.companyMaxLength ?? 60,
  });
  const detail = sanitizeFilenamePart(String(options.detail || ''), {
    fallback: options.code,
    maxLength: options.detailMaxLength ?? 40,
  });
  const base = `${ymd}_${options.code} (${company}) (${detail})`;
  const ext = String(options.extension || '')
    .replace(/^\./, '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 8)
    .toLowerCase();
  return ext ? `${base}.${ext}` : base;
}

/** 같은 폴더에 동일명이 있으면 ` (2)`, ` (3)` … 접미사 */
export function uniqueFilenameInDir(dirAbs: string, filename: string): string {
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  let candidate = filename;
  let n = 2;
  while (fs.existsSync(path.join(dirAbs, candidate))) {
    candidate = `${stem} (${n})${ext}`;
    n += 1;
    if (n > 999) {
      candidate = `${stem}_${Date.now()}${ext}`;
      break;
    }
  }
  return candidate;
}

/**
 * multer가 저장한 임시 파일을 표준명으로 개명하고,
 * DB에 넣을 상대경로 `expense-receipts/...` 를 반환한다.
 * Tax Invoice → RI, Proforma / 인보이스 없음 → PI
 */
export function finalizeExpenseReceiptFilename(options: {
  multerFilename: string;
  companyName?: string | null;
  detail?: string | null;
  date?: Date | string | null;
  originalName?: string | null;
  /** Tax Invoice면 'RI', Proforma·인보이스 없음은 'PI' */
  code?: DocumentDownloadCode;
}): { relativePath: string; absolutePath: string; filename: string } {
  const subdir = 'expense-receipts';
  const dirAbs = path.join(getUploadRoot(), subdir);
  fs.mkdirSync(dirAbs, { recursive: true });

  const srcAbs = path.join(dirAbs, options.multerFilename);
  if (!fs.existsSync(srcAbs)) {
    throw new Error(`receipt missing on disk: ${srcAbs}`);
  }

  const fromOriginal = path.extname(String(options.originalName || ''));
  const fromMulter = path.extname(options.multerFilename);
  const ext = (fromOriginal || fromMulter || '.bin').replace(/^\./, '').toLowerCase() || 'bin';

  const code: DocumentDownloadCode =
    options.code === 'RI' || options.code === 'PI' || options.code === 'RT' || options.code === 'Invoice'
      ? options.code
      : 'PI';

  const desired = buildDocumentDownloadFilename({
    code,
    companyName: options.companyName,
    detail: options.detail,
    date: options.date,
    extension: ext,
  });
  const finalName = uniqueFilenameInDir(dirAbs, desired);
  const destAbs = path.join(dirAbs, finalName);

  if (path.resolve(srcAbs) !== path.resolve(destAbs)) {
    fs.renameSync(srcAbs, destAbs);
  }

  const relativePath = path.join(subdir, finalName).replace(/\\/g, '/');
  return { relativePath, absolutePath: destAbs, filename: finalName };
}
