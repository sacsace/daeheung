import { QueryTypes } from 'sequelize';
import { Op, fn, col } from 'sequelize';
import sequelize from '../config/database';
import { User } from '../models';
import { maskBankTransferSettingsForApi } from '../services/banking';

/** 회사 이미지·기간 필드를 API 응답 형식으로 변환 */
export function serializeCompanyBase(companyData: Record<string, any>): Record<string, any> {
  const out = { ...companyData };

  if (out.company_logo) {
    out.company_logo = `data:image/jpeg;base64,${out.company_logo.toString('base64')}`;
  }
  if (out.company_seal) {
    out.company_seal = `data:image/jpeg;base64,${out.company_seal.toString('base64')}`;
  }
  if (out.ceo_signature) {
    out.ceo_signature = `data:image/jpeg;base64,${out.ceo_signature.toString('base64')}`;
  }

  const toDateStr = (value: unknown): string => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'string') return value.split('T')[0];
    return '';
  };

  out.mvs_start_date = toDateStr(out.login_period_start);
  out.mvs_end_date = toDateStr(out.login_period_end);
  if (out.settings) {
    out.settings = maskBankTransferSettingsForApi(out.settings);
  }
  return out;
}

/** 회사 ID 목록에 대한 GST 번호를 한 번에 조회 */
export async function batchGstNumbersByCompany(companyIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (companyIds.length === 0) return map;

  try {
    const rows = await (sequelize as any).query(
      `SELECT company_id, gst_number
       FROM company_gst_numbers
       WHERE company_id = ANY($1::int[])
       ORDER BY company_id ASC, id ASC`,
      { bind: [companyIds], type: QueryTypes.SELECT }
    ) as Array<{ company_id: number; gst_number: string }>;

    for (const row of rows) {
      const cid = Number(row.company_id);
      if (!map.has(cid)) map.set(cid, []);
      if (row.gst_number) map.get(cid)!.push(row.gst_number);
    }
  } catch {
    // 테이블 없음 등 — 빈 맵 반환
  }

  return map;
}

/** 회사별 활성 직원 수를 한 번에 집계 */
export async function batchEmployeeCountsByCompany(companyIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (companyIds.length === 0) return map;

  try {
    const rows = await (User as any).findAll({
      attributes: ['company_id', [fn('COUNT', col('id')), 'count']],
      where: {
        company_id: { [Op.in]: companyIds },
        status: 'active'
      },
      group: ['company_id'],
      raw: true
    }) as Array<{ company_id: number; count: string | number }>;

    for (const row of rows) {
      map.set(Number(row.company_id), Number(row.count) || 0);
    }
  } catch {
    // 실패 시 0으로 채움
  }

  for (const id of companyIds) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

/** 회사 목록에 GST·직원 수 일괄 부착 */
export async function enrichCompanyList(companies: any[]): Promise<any[]> {
  const ids = companies.map((c) => Number(c.id)).filter(Boolean);
  const [gstMap, empMap] = await Promise.all([
    batchGstNumbersByCompany(ids),
    batchEmployeeCountsByCompany(ids)
  ]);

  return companies.map((company) => {
    const base = serializeCompanyBase(company.toJSON ? company.toJSON() : company);
    const id = Number(base.id);
    return {
      ...base,
      gst_numbers: gstMap.get(id) || [],
      employee_count: empMap.get(id) ?? 0
    };
  });
}
