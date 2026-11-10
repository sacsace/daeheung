/**
 * Shared GL ledger resolution for Accounting Engine + Accounting Brain.
 * Always prefer accountId; name/name_en/alias lookup is secondary.
 * Never invents ledger rows.
 */
import { Op } from 'sequelize';
import GlAccount from '../models/GlAccount';

/** English/common aliases → seeded default COA codes */
export const LEDGER_NAME_ALIASES: Record<string, string> = {
  'accounts receivable': '1103',
  'accounts payable': '2101',
  'sales revenue': '4100',
  'purchase expense': '5100',
  'office expense': '5200',
  'expense - unclassified': '5299',
  'unclassified expense': '5299',
  'output gst': '2102',
  'gst payable': '2102',
  'input gst': '2102',
  cash: '1101',
  bank: '1102',
  'bank account': '1102',
  'interest income': '4200',
  'other income': '4200',
};

export type ResolvedLedger = {
  id: number;
  code: string;
  name: string;
  nameEn?: string | null;
};

const toResolved = (row: any): ResolvedLedger => ({
  id: Number(row.id),
  code: String(row.code),
  name: String(row.name),
  nameEn: row.name_en ?? null,
});

/**
 * Resolve a ledger strictly — NO silent 5299 fallback.
 * Order: id → alias code → exact name/name_en → contains match (optional).
 */
export const resolveLedgerStrict = async ({
  tenantId,
  companyId,
  accountId,
  accountName,
  allowPartialName = false,
}: {
  tenantId: number;
  companyId: number;
  accountId?: number | null;
  accountName?: string | null;
  allowPartialName?: boolean;
}): Promise<ResolvedLedger | null> => {
  if (accountId) {
    const byId = await (GlAccount as any).findOne({
      where: {
        id: accountId,
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        account_type: 'ledger',
      },
    });
    if (byId) return toResolved(byId);
  }

  const rawName = String(accountName || '').trim();
  if (!rawName) return null;

  const aliasCode = LEDGER_NAME_ALIASES[rawName.toLowerCase()];
  if (aliasCode) {
    const byAlias = await (GlAccount as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        code: aliasCode,
        is_active: true,
        account_type: 'ledger',
      },
    });
    if (byAlias) return toResolved(byAlias);
  }

  const byExact = await (GlAccount as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      account_type: 'ledger',
      [Op.or]: [{ name: { [Op.iLike]: rawName } }, { name_en: { [Op.iLike]: rawName } }],
    },
  });
  if (byExact) return toResolved(byExact);

  if (allowPartialName && rawName.length >= 3) {
    const byPartial = await (GlAccount as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        is_active: true,
        account_type: 'ledger',
        [Op.or]: [
          { name: { [Op.iLike]: `%${rawName}%` } },
          { name_en: { [Op.iLike]: `%${rawName}%` } },
        ],
      },
      order: [['code', 'ASC']],
    });
    if (byPartial) return toResolved(byPartial);
  }

  return null;
};

export const assertLinesHaveResolvedAccounts = async ({
  tenantId,
  companyId,
  lines,
}: {
  tenantId: number;
  companyId: number;
  lines: Array<{ accountId?: number | null; accountName?: string | null }>;
}) => {
  const unresolved: string[] = [];
  for (const line of lines) {
    const resolved = await resolveLedgerStrict({
      tenantId,
      companyId,
      accountId: line.accountId,
      accountName: line.accountName,
      allowPartialName: false,
    });
    if (!resolved) {
      unresolved.push(String(line.accountName || line.accountId || '(empty)'));
    }
  }
  if (unresolved.length) {
    throw new Error(
      `계정과목을 확인할 수 없습니다: ${unresolved.join(', ')}. 승인/장부반영 전에 원장을 선택해 주세요.`
    );
  }
};
