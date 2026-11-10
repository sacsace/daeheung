import { Op } from 'sequelize';
import { WorkAssignee, WorkAssigneeItem, Partner, Customer } from '../models';
import { normalizePartnerCompanyName } from '../utils/partnerCompanyName';

export type WorkAssigneeClientScope = {
  /** true면 배정 고객사만 조회 */
  enforced: boolean;
  partnerIds: number[];
  partnerNamesNormalized: string[];
  customerIds: number[];
};

const bypassRoles = new Set(['root', 'audit', 'admin']);

function normalizeKey(raw: unknown): string {
  return normalizePartnerCompanyName(raw).trim().toLowerCase();
}

/** root/admin/audit/payment_officer는 전체, 일반 직원은 고객사 리스트 배정분 */
export function shouldEnforceAssignedClientScope(user: any): boolean {
  if (!user) return false;
  if (bypassRoles.has(String(user.role || ''))) return false;
  if (user.is_payment_officer === true) return false;
  return true;
}

async function findAssigneeForUser(user: any): Promise<WorkAssignee | null> {
  const tenantId = Number(user?.tenant_id);
  const companyId = Number(user?.company_id);
  const userId = Number(user?.id);
  if (!Number.isFinite(tenantId) || !Number.isFinite(companyId) || !Number.isFinite(userId)) {
    return null;
  }

  const byUserId = await WorkAssignee.findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      user_id: userId,
      is_active: true,
    },
  });
  if (byUserId) return byUserId;

  const email = String(user?.email || '')
    .trim()
    .toLowerCase();
  const username = String(user?.username || user?.userid || '')
    .trim()
    .toLowerCase();

  if (email) {
    const byEmail = await WorkAssignee.findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        email: { [Op.iLike]: email },
      },
    });
    if (byEmail) return byEmail;
  }

  if (username) {
    return WorkAssignee.findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        name: { [Op.iLike]: username },
      },
    });
  }

  return null;
}

/**
 * 로그인 사용자의 고객사 리스트 배정 범위.
 * - 강제 대상이 아니면 enforced=false
 * - 담당자 컬럼이 없으면 enforced=false (미배정 직원은 회사 전체 유지)
 * - 담당자로 등록됐지만 고객사 0건이면 enforced=false (작성·검색 불가 잠금 방지)
 * - 담당자 + 고객사 1건 이상이면 enforced=true
 */
export async function resolveAssignedClientScope(user: any): Promise<WorkAssigneeClientScope> {
  const empty: WorkAssigneeClientScope = {
    enforced: false,
    partnerIds: [],
    partnerNamesNormalized: [],
    customerIds: [],
  };

  if (!shouldEnforceAssignedClientScope(user)) return empty;

  const assignee = await findAssigneeForUser(user);
  if (!assignee) return empty;

  const items = await WorkAssigneeItem.findAll({
    where: { assignee_id: assignee.id, is_active: true },
    attributes: ['id', 'name', 'partner_id'],
  });

  if (!items.length) {
    return empty;
  }

  const partnerIds = Array.from(
    new Set(
      items
        .map((i) => Number(i.partner_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  const nameKeys = Array.from(
    new Set(items.map((i) => normalizeKey(i.name)).filter(Boolean))
  );

  // partner_id 없는 항목은 이름으로 파트너 재매칭
  if (nameKeys.length > 0) {
    const partners = await Partner.findAll({
      where: {
        tenant_id: assignee.tenant_id,
        company_id: assignee.company_id,
      },
      attributes: ['id', 'company_name'],
    });
    for (const p of partners) {
      const key = normalizeKey(p.company_name);
      if (key && nameKeys.includes(key) && !partnerIds.includes(p.id)) {
        partnerIds.push(p.id);
      }
    }
  }

  const allNameKeys = Array.from(
    new Set([
      ...nameKeys,
      ...(
        await Partner.findAll({
          where: { id: { [Op.in]: partnerIds.length ? partnerIds : [-1] } },
          attributes: ['company_name'],
        })
      )
        .map((p) => normalizeKey(p.company_name))
        .filter(Boolean),
    ])
  );

  const customers = await Customer.findAll({
    where: {
      tenant_id: assignee.tenant_id,
      company_id: assignee.company_id,
    },
    attributes: ['id', 'name'],
  });
  const customerIds = customers
    .filter((c) => allNameKeys.includes(normalizeKey(c.name)))
    .map((c) => c.id);

  // 배정 행은 있으나 매칭 가능한 거래처가 하나도 없으면 잠그지 않음
  if (partnerIds.length === 0 && allNameKeys.length === 0) {
    return empty;
  }

  return {
    enforced: true,
    partnerIds,
    partnerNamesNormalized: allNameKeys,
    customerIds,
  };
}

export function expenseMatchesAssignedScope(expense: any, scope: WorkAssigneeClientScope): boolean {
  if (!scope.enforced) return true;
  if (scope.partnerIds.length === 0 && scope.partnerNamesNormalized.length === 0) return false;

  let meta: any = {};
  const items = expense?.items;
  if (items && typeof items === 'object' && !Array.isArray(items)) {
    meta = items.meta || {};
  }

  const partnerId = Number(meta.partnerId ?? meta.partner_id ?? 0);
  if (partnerId > 0 && scope.partnerIds.includes(partnerId)) return true;

  const nameCandidates = [
    meta.department,
    meta.partnerName,
    meta.partner_name,
    meta.companyName,
    expense?.title,
  ];
  for (const raw of nameCandidates) {
    const key = normalizeKey(raw);
    if (key && scope.partnerNamesNormalized.includes(key)) return true;
  }
  return false;
}

export function invoiceMatchesAssignedScope(invoice: any, scope: WorkAssigneeClientScope): boolean {
  if (!scope.enforced) return true;
  if (scope.customerIds.length === 0 && scope.partnerNamesNormalized.length === 0) return false;

  const customerId = Number(invoice?.customer_id ?? invoice?.customer?.id ?? 0);
  if (customerId > 0 && scope.customerIds.includes(customerId)) return true;

  const name = normalizeKey(invoice?.customer?.name);
  if (name && scope.partnerNamesNormalized.includes(name)) return true;
  return false;
}
