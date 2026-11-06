import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  MenuItem,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { payrollService } from '../../services/api';
import {
  mvsBodyCardSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
} from '../../theme/mvsLayout';

type BonusRow = {
  employee_id: number;
  employee_name: string;
  employee_number: string;
  department: string;
  hire_date: string | null;
  months_worked: number;
  monthly_salary: number;
  rate_percent: number;
  amount: number;
  status: 'registered' | 'paid' | null;
};

type FiscalYear = { label: string; start: string; end: string };

const filterFieldSx = {
  ...mvsSearchFieldSx,
  ...mvsFilterFieldHeightSx,
  minWidth: { xs: '100%', sm: 180 },
};

function rupee(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

export default function PayrollBonusPanel({
  companyId,
  canWrite,
}: {
  companyId: number | '';
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [fiscalYear, setFiscalYear] = useState('');
  const [installments, setInstallments] = useState<1 | 2>(1);
  const [installment, setInstallment] = useState<1 | 2>(1);
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (typeof companyId !== 'number') {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await payrollService.getPayrollBonuses({
        company_id: companyId,
        fiscal_year: fiscalYear || undefined,
        installments_per_year: installments,
        installment: installments === 1 ? 1 : installment,
      });
      const payload = res.data;
      setFiscalYears(payload.fiscal_years || []);
      if (!fiscalYear && payload.fiscal_year?.label) setFiscalYear(payload.fiscal_year.label);
      setRows(payload.rows || []);
      setSelected([]);
    } catch {
      setError(t('payrollManagement.bonusRegister.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, fiscalYear, installment, installments, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [rows]
  );
  const allChecked = rows.length > 0 && selected.length === rows.length;

  async function save(markPaid: boolean) {
    if (typeof companyId !== 'number' || !fiscalYear || selected.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await payrollService.registerPayrollBonuses({
        company_id: companyId,
        fiscal_year: fiscalYear,
        installments_per_year: installments,
        installment: installments === 1 ? 1 : installment,
        employee_ids: selected,
        mark_paid: markPaid,
      });
      setToast(t(markPaid ? 'payrollManagement.bonusRegister.paid' : 'payrollManagement.bonusRegister.saved'));
      await load();
    } catch {
      setError(t('payrollManagement.bonusRegister.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (typeof companyId !== 'number') {
    return <Alert severity="info">{t('payrollManagement.bonusRegister.selectCompany')}</Alert>;
  }

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('payrollManagement.bonusRegister.hint')}
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: '#FFFFFF',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {t('payrollManagement.bonusRegister.people')} {rows.length}
            {' · '}
            {t('payrollManagement.bonusRegister.thisPayment')} {rupee(total)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              disabled={!canWrite || saving || selected.length === 0}
              onClick={() => void save(true)}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('payrollManagement.bonusRegister.markPaid')}
            </Button>
            <Button
              variant="contained"
              disableElevation
              size="small"
              disabled={!canWrite || saving || selected.length === 0}
              onClick={() => void save(false)}
              sx={mvsBodyPrimaryBtnSx}
            >
              {t('payrollManagement.bonusRegister.register')}
            </Button>
          </Box>
        </Box>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 2,
          }}
        >
          <TextField
            select
            size="small"
            label={t('payrollManagement.bonusRegister.fiscalYear')}
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            {...mvsOutlinedLabelProps}
            sx={filterFieldSx}
          >
            {fiscalYears.map((fy) => (
              <MenuItem key={fy.label} value={fy.label}>
                {fy.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('payrollManagement.bonusRegister.times')}
            value={installments}
            onChange={(e) => {
              const next = Number(e.target.value) === 2 ? 2 : 1;
              setInstallments(next);
              if (next === 1) setInstallment(1);
            }}
            {...mvsOutlinedLabelProps}
            sx={{ ...filterFieldSx, minWidth: { xs: '100%', sm: 200 } }}
          >
            <MenuItem value={1}>{t('payrollManagement.bonusRegister.once')}</MenuItem>
            <MenuItem value={2}>{t('payrollManagement.bonusRegister.twice')}</MenuItem>
          </TextField>
          {installments === 2 && (
            <TextField
              select
              size="small"
              label={t('payrollManagement.bonusRegister.round')}
              value={installment}
              onChange={(e) => setInstallment(Number(e.target.value) === 2 ? 2 : 1)}
              {...mvsOutlinedLabelProps}
              sx={filterFieldSx}
            >
              <MenuItem value={1}>{t('payrollManagement.bonusRegister.round1')}</MenuItem>
              <MenuItem value={2}>{t('payrollManagement.bonusRegister.round2')}</MenuItem>
            </TextField>
          )}
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        <Box sx={mvsBodyListTableSx}>
          {loading && rows.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Table size="small" sx={{ minWidth: 960 }}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={allChecked}
                      indeterminate={selected.length > 0 && !allChecked}
                      onChange={() =>
                        setSelected(allChecked ? [] : rows.map((row) => row.employee_id))
                      }
                    />
                  </TableCell>
                  {(['name', 'department', 'hireDate', 'months', 'monthly', 'rate', 'amount', 'status'] as const).map(
                    (key) => (
                      <TableCell
                        key={key}
                        align={['months', 'monthly', 'rate', 'amount'].includes(key) ? 'right' : 'left'}
                      >
                        {t(`payrollManagement.bonusRegister.columns.${key}`)}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {rows.map((row) => (
                  <TableRow key={row.employee_id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selected.includes(row.employee_id)}
                        onChange={() =>
                          setSelected((prev) =>
                            prev.includes(row.employee_id)
                              ? prev.filter((id) => id !== row.employee_id)
                              : [...prev, row.employee_id]
                          )
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.employee_name}
                      {row.employee_number ? ` (${row.employee_number})` : ''}
                    </TableCell>
                    <TableCell>{row.department || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.hire_date || '-'}</TableCell>
                    <TableCell align="right">{row.months_worked}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {rupee(row.monthly_salary)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {installments === 2 ? `${row.rate_percent}% × 50%` : `${row.rate_percent}%`}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {rupee(row.amount)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.status === 'paid'
                        ? t('payrollManagement.bonusRegister.statusPaid')
                        : row.status === 'registered'
                          ? t('payrollManagement.bonusRegister.statusRegistered')
                          : t('payrollManagement.bonusRegister.statusNone')}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                      {t('payrollManagement.bonusRegister.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Box>
      </Box>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Box>
  );
}
