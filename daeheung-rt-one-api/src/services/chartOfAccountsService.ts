/**
 * Default chart of accounts seeding — deprecated for Tally-centric accounting.
 * Korean system COA is no longer auto-created; ledgers come from Tally import.
 */
export const ensureDefaultChartOfAccounts = async (_args: {
  tenantId: number;
  companyId: number;
  userId?: number;
}) => {
  return { created: 0 };
};
