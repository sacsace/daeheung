import { Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { RequestWithUser } from '../types';
import { resolveCompanyScope } from '../utils/companyScope';
import { importTallyExport, parseTallyExport, readTallyFileText } from '../services/tallyImportService';
import {
  createTallyImportBatch,
  failTallyImportBatch,
  finalizeTallyImportBatch,
} from '../services/accountingImport/tally/tallyImportBatchService';

type UploadedTallyFile = {
  path: string;
  originalname?: string;
  filename?: string;
  size?: number;
};

const getUploadedFile = (req: RequestWithUser): UploadedTallyFile => {
  const file = (req as any).file as UploadedTallyFile | undefined;
  if (!file?.path) {
    const bodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];
    throw new Error(
      `파일이 업로드되지 않았습니다. (field: file, bodyKeys=[${bodyKeys.join(',')}]). ` +
        `프론트 axios Content-Type을 확인하세요. 새로고침 후 다시 시도해 주세요.`
    );
  }
  return file;
};

const readUploadText = (file: UploadedTallyFile) => {
  const { content, encoding } = readTallyFileText(file.path);
  return {
    content,
    fileName: file.originalname || file.filename,
    encoding,
    size: file.size,
    filePath: file.path,
  };
};

/** Always remove the multipart temp file — never keep Tally exports on disk. */
const removeUploadFile = (filePath?: string | null) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup errors
  }
};

const parseBool = (value: unknown, fallback: boolean) => {
  if (value == null || value === '') return fallback;
  const s = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'no', 'n'].includes(s)) return false;
  return fallback;
};

/** Preview parse only — no DB writes */
export const previewTallyImport = async (req: RequestWithUser, res: Response) => {
  const filePath = (req as any).file?.path as string | undefined;
  try {
    const file = getUploadedFile(req);
    const { content, fileName, encoding } = readUploadText(file);
    const parsed = parseTallyExport(content, fileName);
    return res.json({
      success: true,
      data: {
        format: parsed.format,
        fileName,
        encoding,
        ledgers: parsed.ledgers.slice(0, 100),
        vouchers: parsed.vouchers.slice(0, 50).map((v) => ({
          date: v.date,
          voucherType: v.voucherType,
          voucherNumber: v.voucherNumber,
          narration: v.narration,
          lineCount: v.lines.length,
          totalDebit: v.lines.reduce((s, l) => s + l.debit, 0),
          totalCredit: v.lines.reduce((s, l) => s + l.credit, 0),
        })),
        totals: {
          ledgers: parsed.ledgers.length,
          vouchers: parsed.vouchers.length,
        },
      },
    });
  } catch (error: any) {
    console.error('[tally/preview]', error?.message || error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Tally Export 미리보기에 실패했습니다.',
    });
  } finally {
    removeUploadFile(filePath);
  }
};

/** Import Tally XML/JSON into GL accounts (optional) + draft vouchers */
export const runTallyImport = async (req: RequestWithUser, res: Response) => {
  const filePath = (req as any).file?.path as string | undefined;
  let batchId: number | null = null;
  let batchScope: { tenantId: number; companyId: number; userId: number } | null = null;
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { tenantId, companyId } = resolveCompanyScope(req);
    const file = getUploadedFile(req);
    const { content, fileName, size } = readUploadText(file);
    const body = req.body || {};
    const dryRun = parseBool(body.dryRun, false);
    const importLedgers = parseBool(body.importLedgers, true);
    const importVouchers = parseBool(body.importVouchers, true);
    const parsed = parseTallyExport(content, fileName);
    const fileSha256 = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');

    if (!dryRun) {
      const batch = await createTallyImportBatch({
        tenantId,
        companyId,
        userId: req.user.id,
        fileName,
        fileSize: size,
        fileSha256,
      });
      batchId = batch.id;
      batchScope = { tenantId, companyId, userId: req.user.id };
    }

    const result = await importTallyExport(
      content,
      {
        tenantId,
        companyId,
        userId: req.user.id,
        dryRun,
        createMissingLedgers: parseBool(body.createMissingLedgers, true),
        importLedgers,
        importVouchers,
        createMissingParties: parseBool(body.createMissingParties, true),
      },
      fileName
    );

    if (batchId != null) {
      await finalizeTallyImportBatch({
        batchId,
        tenantId,
        companyId,
        userId: req.user.id,
        fileSha256,
        vouchers: parsed.vouchers,
        result,
      });
    }

    // DB 반영(또는 dry-run) 완료 후 finally에서 업로드 파일 삭제
    return res.json({
      success: true,
      message: result.dryRun
        ? '미리보기(시뮬레이션)가 완료되었습니다. 실제 반영은 Import를 다시 실행하세요.'
        : 'Tally Export 임포트가 완료되었습니다. 전표는 임시(draft) 상태입니다.',
      data: { ...result, batchId },
    });
  } catch (error: any) {
    if (batchId != null && batchScope) {
      await failTallyImportBatch({ batchId, ...batchScope, error }).catch(() => undefined);
    }
    console.error('[tally/import]', error?.message || error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Tally Export 임포트에 실패했습니다.',
    });
  } finally {
    removeUploadFile(filePath);
  }
};
