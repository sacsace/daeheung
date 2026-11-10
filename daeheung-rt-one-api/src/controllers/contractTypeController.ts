import { Response } from 'express';
import { DataTypes } from 'sequelize';
import { AuthRequest } from '../types';
import sequelize from '../config/database';
import Contract from '../models/Contract';
import ContractType, { DEFAULT_CONTRACT_TYPES } from '../models/ContractType';

let schemaEnsured = false;

export async function ensureContractTypesSchema() {
  if (schemaEnsured) return;
  const qi = sequelize.getQueryInterface();
  const tables = await qi.showAllTables();
  const names = tables.map((t: any) => (typeof t === 'string' ? t : t.tableName || t.name));

  if (!names.includes('contract_types')) {
    await qi.createTable('contract_types', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      company_id: { type: DataTypes.INTEGER, allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await qi.addIndex('contract_types', ['tenant_id', 'company_id', 'is_active'], {
      name: 'contract_types_scope_active_idx',
    });
    await qi.addIndex('contract_types', ['tenant_id', 'company_id', 'code'], {
      name: 'contract_types_scope_code_uq',
      unique: true,
    });
  }

  try {
    const contractsTable = await qi.describeTable('contracts');
    if (contractsTable.contract_type) {
      await qi.changeColumn('contracts', 'contract_type', {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'sales',
      });
    }
  } catch {
    /* contracts 테이블 없으면 무시 */
  }

  schemaEnsured = true;
}

async function ensureDefaultTypes(tenantId: number, companyId: number) {
  const existing = await ContractType.findAll({
    where: { tenant_id: tenantId, company_id: companyId },
  });
  const byCode = new Map(existing.map((r) => [r.code, r]));

  for (const def of DEFAULT_CONTRACT_TYPES) {
    const row = byCode.get(def.code);
    if (!row) {
      await ContractType.create({
        tenant_id: tenantId,
        company_id: companyId,
        code: def.code,
        name: def.name,
        sort_order: def.sort_order,
        is_system: true,
        is_active: true,
      });
      continue;
    }
    const patch: Record<string, unknown> = {};
    if (!row.is_active) patch.is_active = true;
    if (!row.is_system) patch.is_system = true;
    if (Object.keys(patch).length > 0) await row.update(patch);
  }
}

function slugifyCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function scope(req: AuthRequest) {
  return {
    tenantId: req.user?.tenant_id as number | undefined,
    companyId: req.user?.company_id as number | undefined,
  };
}

export const getContractTypes = async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractTypesSchema();
    const { tenantId, companyId } = scope(req);
    if (!tenantId || !companyId) {
      return res.status(400).json({ success: false, message: '테넌트/회사 정보가 필요합니다.' });
    }

    await ensureDefaultTypes(tenantId, companyId);

    const includeInactive = String(req.query.include_inactive || '') === '1';
    const where: Record<string, unknown> = { tenant_id: tenantId, company_id: companyId };
    if (!includeInactive) where.is_active = true;

    const rows = await ContractType.findAll({
      where,
      order: [
        ['sort_order', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return res.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('계약 구분 목록 오류:', error);
    return res.status(500).json({
      success: false,
      message: '계약 구분 목록을 불러오지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createContractType = async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractTypesSchema();
    const { tenantId, companyId } = scope(req);
    if (!tenantId || !companyId) {
      return res.status(400).json({ success: false, message: '테넌트/회사 정보가 필요합니다.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: '구분명을 입력하세요.' });
    }

    let code = slugifyCode(req.body?.code || name);
    if (!code) code = `type_${Date.now()}`;

    const dup = await ContractType.findOne({
      where: { tenant_id: tenantId, company_id: companyId, code },
    });
    if (dup) {
      if (!dup.is_active) {
        await dup.update({
          is_active: true,
          name,
          sort_order: Number(req.body?.sort_order) || dup.sort_order,
        });
        return res.status(201).json({ success: true, data: dup });
      }
      return res.status(409).json({ success: false, message: '이미 존재하는 구분 코드입니다.' });
    }

    const maxOrder = (await ContractType.max('sort_order', {
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
    })) as number | null;

    const row = await ContractType.create({
      tenant_id: tenantId,
      company_id: companyId,
      code,
      name,
      sort_order: Number.isFinite(Number(req.body?.sort_order))
        ? Number(req.body.sort_order)
        : (maxOrder ?? -1) + 1,
      is_system: false,
      is_active: true,
    });
    return res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    console.error('계약 구분 생성 오류:', error);
    return res.status(500).json({
      success: false,
      message: '계약 구분 생성에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateContractType = async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractTypesSchema();
    const { tenantId, companyId } = scope(req);
    if (!tenantId || !companyId) {
      return res.status(400).json({ success: false, message: '테넌트/회사 정보가 필요합니다.' });
    }
    const id = parseInt(String(req.params.id), 10);
    const row = await ContractType.findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '구분을 찾을 수 없습니다.' });
    }

    const patch: Record<string, unknown> = {};
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ success: false, message: '구분명을 입력하세요.' });
      patch.name = name;
    }
    if (req.body?.sort_order !== undefined && Number.isFinite(Number(req.body.sort_order))) {
      patch.sort_order = Number(req.body.sort_order);
    }

    let nextCode: string | null = null;
    if (req.body?.code !== undefined) {
      if (row.is_system) {
        return res.status(400).json({
          success: false,
          message: '기본 구분의 코드는 변경할 수 없습니다. 이름만 수정하세요.',
        });
      }
      nextCode = slugifyCode(String(req.body.code));
      if (!nextCode) {
        return res.status(400).json({ success: false, message: '유효한 코드를 입력하세요. (영문·숫자·_·-)' });
      }
      if (nextCode !== row.code) {
        const dup = await ContractType.findOne({
          where: { tenant_id: tenantId, company_id: companyId, code: nextCode },
        });
        if (dup && dup.id !== row.id) {
          return res.status(409).json({ success: false, message: '이미 존재하는 구분 코드입니다.' });
        }
        patch.code = nextCode;
      }
    }

    const prevCode = row.code;
    await sequelize.transaction(async (transaction) => {
      await row.update(patch, { transaction });
      if (nextCode && nextCode !== prevCode) {
        await (Contract as any).update(
          { contract_type: nextCode },
          {
            where: {
              tenant_id: tenantId,
              company_id: companyId,
              contract_type: prevCode,
            },
            transaction,
          }
        );
      }
    });

    return res.json({ success: true, data: row });
  } catch (error: any) {
    console.error('계약 구분 수정 오류:', error);
    return res.status(500).json({
      success: false,
      message: '계약 구분 수정에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteContractType = async (req: AuthRequest, res: Response) => {
  try {
    await ensureContractTypesSchema();
    const { tenantId, companyId } = scope(req);
    const id = parseInt(String(req.params.id), 10);
    const row = await ContractType.findOne({
      where: { id, tenant_id: tenantId, company_id: companyId, is_active: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: '구분을 찾을 수 없습니다.' });
    }
    if (row.is_system) {
      return res.status(400).json({
        success: false,
        message: '기본 구분은 삭제할 수 없습니다. 이름만 수정하세요.',
      });
    }

    const inUse = await (Contract as any).count({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        contract_type: row.code,
      },
    });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `이 구분을 사용하는 계약이 ${inUse}건 있어 삭제할 수 없습니다.`,
      });
    }

    await row.update({ is_active: false });
    return res.json({ success: true, message: '계약 구분이 비활성화되었습니다.' });
  } catch (error: any) {
    console.error('계약 구분 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      message: '계약 구분 삭제에 실패했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/** 계약 생성·수정 시 활성 구분 코드인지 확인 */
export async function assertActiveContractType(
  tenantId: number,
  companyId: number,
  code: string
): Promise<{ ok: true; code: string } | { ok: false; message: string }> {
  await ensureContractTypesSchema();
  await ensureDefaultTypes(tenantId, companyId);
  const normalized = String(code || '').trim();
  if (!normalized) {
    return { ok: false as const, message: '계약 구분을 선택해 주세요.' };
  }
  const row = await ContractType.findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      code: normalized,
      is_active: true,
    },
  });
  if (!row) {
    return { ok: false as const, message: '유효하지 않은 계약 구분입니다.' };
  }
  return { ok: true as const, code: row.code };
}
