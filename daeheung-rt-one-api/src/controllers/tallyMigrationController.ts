import { Response } from 'express';
import AcImportBatch from '../models/AcImportBatch';
import AcImportBatchDocument from '../models/AcImportBatchDocument';
import AcImportIssue from '../models/AcImportIssue';
import { RequestWithUser } from '../types';
import { resolveCompanyScope } from '../utils/companyScope';
import { reconcileTallyImportBatch } from '../services/accountingImport/tally/tallyReconciliationService';

const batchIdFromRequest = (req: RequestWithUser) => {
  const batchId = Number(req.params.id);
  if (!Number.isInteger(batchId) || batchId <= 0) throw new Error('유효한 Import Batch ID가 필요합니다.');
  return batchId;
};

export const getTallyImportBatch = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const batchId = batchIdFromRequest(req);
    const batch = await (AcImportBatch as any).findOne({
      where: { id: batchId, tenant_id: tenantId, company_id: companyId, source_system: 'tally' },
    });
    if (!batch) return res.status(404).json({ success: false, message: 'Tally Import Batch를 찾을 수 없습니다.' });

    const [documentCount, convertedCount, issueRows] = await Promise.all([
      (AcImportBatchDocument as any).count({ where: { batch_id: batchId } }),
      (AcImportBatchDocument as any).count({ where: { batch_id: batchId, status: 'converted' } }),
      (AcImportIssue as any).findAll({
        where: { batch_id: batchId },
        attributes: ['severity'],
        raw: true,
      }),
    ]);
    const issues = issueRows.reduce(
      (summary: { error: number; warning: number; info: number }, issue: { severity?: string }) => {
        const severity = String(issue.severity || 'INFO').toUpperCase();
        if (severity === 'ERROR') summary.error += 1;
        else if (severity === 'WARNING') summary.warning += 1;
        else summary.info += 1;
        return summary;
      },
      { error: 0, warning: 0, info: 0 }
    );

    return res.json({
      success: true,
      data: {
        ...batch.toJSON(),
        documents: { total: documentCount, converted: convertedCount },
        issues,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message || 'Tally Import Batch 조회에 실패했습니다.',
    });
  }
};

export const getTallyImportReconciliation = async (req: RequestWithUser, res: Response) => {
  try {
    const { tenantId, companyId } = resolveCompanyScope(req);
    const data = await reconcileTallyImportBatch({
      batchId: batchIdFromRequest(req),
      tenantId,
      companyId,
    });
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error?.message || 'Tally 이관 대사에 실패했습니다.',
    });
  }
};
