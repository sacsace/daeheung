import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { accountingService } from '../../services/api';
import { mvsBodyListTableSx, mvsPageRootSx, mvsTableHeadHighlightSx } from '../../theme/daeheungLayout';
import { formatInr } from '../../utils/formatInr';

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  draft: 'default',
  review_required: 'warning',
  approved: 'info',
  posted: 'success',
  rejected: 'error',
  cancelled: 'error',
  reversed: 'warning',
};

const VoucherList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canSelectCompany, companies, selectedCompanyId, effectiveCompanyId, selectedCompanyName, companyQuery, changeCompany } = useAccountingCompany();
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const res = await accountingService.getGlVouchers({ status: statusFilter || undefined, ...companyQuery });
      setRows(res?.data || []);
    } catch {
      setRows([]);
    }
  }, [effectiveCompanyId, statusFilter, companyQuery]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={t('voucherList.title')}
        description={t('voucherList.subtitle')}
        actions={
          <Button variant="contained" size="small" onClick={() => navigate('/accounting/voucher-entry')}>
            {t('voucherList.newVoucher')}
          </Button>
        }
      />
      <AccountingCompanyBar canSelectCompany={canSelectCompany} companies={companies} selectedCompanyId={selectedCompanyId} selectedCompanyName={selectedCompanyName} onChangeCompany={changeCompany} />
      <Box sx={{ p: 2.5 }}>
        <TextField size="small" select label={t('voucherList.status')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ mb: 2, minWidth: 180 }}>
          <MenuItem value="">{t('voucherList.allStatus')}</MenuItem>
          {['draft', 'review_required', 'approved', 'posted', 'rejected', 'cancelled'].map((s) => (
            <MenuItem key={s} value={s}>{t(`voucherList.statuses.${s}`, s)}</MenuItem>
          ))}
        </TextField>
        <TableContainer sx={mvsBodyListTableSx}>
          <Table size="small">
            <TableHead sx={mvsTableHeadHighlightSx}>
              <TableRow>
                <TableCell>{t('voucherList.date')}</TableCell>
                <TableCell>{t('voucherList.number')}</TableCell>
                <TableCell>{t('voucherList.type')}</TableCell>
                <TableCell>{t('voucherList.narration')}</TableCell>
                <TableCell align="right">{t('voucherList.amount')}</TableCell>
                <TableCell>{t('voucherList.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{r.voucher_date}</TableCell>
                  <TableCell>{r.voucher_no}</TableCell>
                  <TableCell>{r.voucher_type}</TableCell>
                  <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 240 }}>{r.narration || '-'}</Typography></TableCell>
                  <TableCell align="right">{formatInr(r.total_debit)}</TableCell>
                  <TableCell><Chip size="small" label={t(`voucherList.statuses.${r.status}`, r.status)} color={STATUS_COLOR[r.status] || 'default'} /></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>{t('voucherList.empty')}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default VoucherList;
