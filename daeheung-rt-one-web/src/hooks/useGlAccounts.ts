import { useCallback, useEffect, useState } from 'react';
import { accountingService } from '../services/api';

export type GlAccountOption = {
  id: number;
  code: string;
  name: string;
  name_en?: string;
  account_type: 'group' | 'ledger';
  nature: string;
  current_balance: number;
  parent_id?: number | null;
};

export const useGlAccounts = (ledgerOnly = false, companyId?: number | '') => {
  const [accounts, setAccounts] = useState<GlAccountOption[]>([]);
  const [loading, setLoading] = useState(false);

  const resolvedCompanyId = companyId && Number(companyId) > 0 ? Number(companyId) : undefined;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await accountingService.getGlAccounts({
        ledgerOnly,
        company_id: resolvedCompanyId,
      });
      setAccounts(Array.isArray(response?.data) ? response.data : []);
    } finally {
      setLoading(false);
    }
  }, [ledgerOnly, resolvedCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  const ledgerAccounts = accounts.filter((a) => a.account_type === 'ledger');

  return { accounts, ledgerAccounts, loading, reload: load };
};
