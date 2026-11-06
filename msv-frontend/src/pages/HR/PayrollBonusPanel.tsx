import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import {
  getMvsDialogActionsSx,
  getMvsDialogCancelButtonSx,
  getMvsDialogPaperSx,
  getMvsDialogPrimaryConfirmButtonSx,
} from '../../components/Common/mvsDialogShell';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { payrollService, userService } from '../../services/api';
import { useStore } from '../../store';
import { useReferenceDataStore } from '../../store/referenceDataStore';
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
import { showErrorPopup, showSuccessPopup } from '../../utils/errorHandler';
import { subscribeApprovalStatusChanged } from '../../utils/approvalStatusSync';
import { exportBonusListToExcel } from './payroll/exportBonusListToExcel';
import {
  BONUS_STATEMENT_LABELS,
  bonusStatementRow,
  bonusStatementView,
} from './payroll/bonusStatementDocument';
import PayslipContent, { toPayslipCompanyInfo, type PayslipCompanyInfo } from './PayslipContent';
import {
  downloadPayslipPdf,
  downloadPayslipsPdfBatch,
  generatePayslipPdfBlob,
  payslipBlobToBase64,
} from './payrollPayslipPdf';
import {
  countEligiblePayrollBankRows,
  exportPayrollBankBulkTransfer,
  readIciciBulkSaved,
  writeIciciBulkSaved,
  type PayrollBulkBankId,
} from './payroll/exportPayrollBankBulkTransfer';

type BonusRow = {
  id: number | null;
  employee_id: number;
  employee_name: string;
  employee_number: string;
  department: string;
  email: string;
  bank_account: string;
  bank_ifsc: string;
  hire_date: string | null;
  months_worked: number;
  monthly_salary: number;
  rate_percent: number;
  amount: number;
  status: 'registered' | 'paid' | null;
};

type FiscalYear = { label: string; start: string; end: string };
type ApproverOption = { id: number; username: string; department?: string; position?: string };
type BonusApproval = {
  id: number;
  status: string;
  currentApprover?: { username?: string } | null;
} | null;

const filterFieldSx = {
  ...mvsSearchFieldSx,
  ...mvsFilterFieldHeightSx,
  minWidth: { xs: '100%', sm: 180 },
};

function rupee(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

function buildFiscalYears(count = 6): FiscalYear[] {
  const now = new Date();
  const start0 = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, index) => {
    const startYear = start0 - index;
    return {
      label: `${startYear}-${startYear + 1}`,
      start: `${startYear}-04-01`,
      end: `${startYear + 1}-03-31`,
    };
  });
}

function amountFromRate(monthly: number, rate: number, times: 1 | 2) {
  const share = times === 2 ? 0.5 : 1;
  return Math.round(monthly * (rate / 100) * share);
}

async function loadBonusCompanyInfo(companyId: number) {
  try {
    const company = await useReferenceDataStore.getState().fetchCompanyById(companyId);
    return toPayslipCompanyInfo(company);
  } catch {
    return null;
  }
}

export default function PayrollBonusPanel({
  companyId,
  canWrite,
}: {
  companyId: number | '';
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const myId = useStore((s) => (s.user?.id != null ? Number(s.user.id) : null));
  const isRoot = useStore((s) => s.user?.role === 'root');
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const initialYears = useMemo(() => buildFiscalYears(), []);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>(initialYears);
  const [fiscalYear, setFiscalYear] = useState(initialYears[0]?.label || '');
  const [installments, setInstallments] = useState<1 | 2>(1);
  const [installment, setInstallment] = useState<1 | 2>(1);
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [approval, setApproval] = useState<BonusApproval>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<number, { rate: string; amount: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvers, setApprovers] = useState<ApproverOption[]>([]);
  const [approver, setApprover] = useState<ApproverOption | null>(null);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankId, setBankId] = useState<PayrollBulkBankId>('icici');
  const [debitAccount, setDebitAccount] = useState('');
  const [corporateId, setCorporateId] = useState('');
  const [bankError, setBankError] = useState('');
  const [bankExporting, setBankExporting] = useState(false);
  const [statementRow, setStatementRow] = useState<BonusRow | null>(null);
  const [statementCompany, setStatementCompany] = useState<PayslipCompanyInfo | null>(null);
  const [statementDownloading, setStatementDownloading] = useState(false);
  const [mailProgress, setMailProgress] = useState<{
    open: boolean;
    phase: 'prepare' | 'send';
    done: number;
    total: number;
    name: string;
  }>({ open: false, phase: 'prepare', done: 0, total: 0, name: '' });

  const currentInstallment = installments === 1 ? 1 : installment;

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (typeof companyId !== 'number') {
      setRows([]);
      setApproval(null);
      return;
    }
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await payrollService.getPayrollBonuses({
        company_id: companyId,
        fiscal_year: fiscalYear || undefined,
        installments_per_year: installments,
        installment: currentInstallment,
      });
      const payload = res?.data && !Array.isArray(res.data) ? res.data : null;
      if (!res?.success || !payload) {
        if (!options?.silent) {
          setRows([]);
          setApproval(null);
        }
        setError(res?.message || t('payrollManagement.bonusRegister.loadFailed'));
        return;
      }
      if (Array.isArray(payload.fiscal_years) && payload.fiscal_years.length > 0) {
        setFiscalYears(payload.fiscal_years);
      }
      if (!fiscalYear && payload.fiscal_year?.label) setFiscalYear(payload.fiscal_year.label);
      setRows(payload.rows || []);
      setApproval(payload.approval || null);
      if (!options?.silent) {
        setSelected([]);
        setDrafts({});
      }
    } catch (err: any) {
      if (!options?.silent) {
        setRows([]);
        setApproval(null);
      }
      setError(err?.response?.data?.message || t('payrollManagement.bonusRegister.loadFailed'));
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [companyId, currentInstallment, fiscalYear, installments, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribeApprovalStatusChanged(() => void load({ silent: true })), [load]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [rows]
  );
  const allChecked = rows.length > 0 && selected.length === rows.length;
  const approvalStatus = String(approval?.status || '');
  const editLocked = ['submitted', 'in_review', 'approved'].includes(approvalStatus);
  const approved = approvalStatus === 'approved';
  const paymentUnlocked = isRoot || approved;
  const savedRows = rows.filter((row) => row.status);
  const selectedSaved = rows.filter((row) => selected.includes(row.employee_id) && row.status);

  const approvalChip = useMemo(() => {
    if (approvalStatus === 'approved') {
      return { label: t('payrollManagement.bonusRegister.approvalApproved'), color: 'success' as const };
    }
    if (approvalStatus === 'submitted' || approvalStatus === 'in_review') {
      const name = approval?.currentApprover?.username;
      return {
        label: name
          ? `${t('payrollManagement.bonusRegister.approvalPending')} · ${name}`
          : t('payrollManagement.bonusRegister.approvalPending'),
        color: 'warning' as const,
      };
    }
    if (approvalStatus === 'rejected' || approvalStatus === 'cancelled') {
      return { label: t('payrollManagement.bonusRegister.approvalRejected'), color: 'error' as const };
    }
    if (isRoot) {
      return {
        label: t('payrollManagement.bonusRegister.approvalRootBypass'),
        color: 'info' as const,
      };
    }
    return { label: t('payrollManagement.bonusRegister.approvalNeeded'), color: 'default' as const };
  }, [approval?.currentApprover?.username, approvalStatus, isRoot, t]);

  function bonusBody<T extends object>(extra: T) {
    return {
      company_id: companyId as number,
      fiscal_year: fiscalYear,
      installments_per_year: installments,
      installment: currentInstallment,
      ...extra,
    } as T & {
      company_id: number;
      fiscal_year: string;
      installments_per_year: 1 | 2;
      installment: 1 | 2;
    };
  }

  function confirmRemove() {
    if (typeof companyId !== 'number' || selected.length === 0) return;
    if (editLocked) {
      setError(t('payrollManagement.bonusRegister.removeLocked'));
      return;
    }
    const picked = rows.filter((row) => selected.includes(row.employee_id));
    if (picked.some((row) => row.status === 'paid')) {
      setError(t('payrollManagement.bonusRegister.removePaid'));
      return;
    }
    showConfirm(
      t('payrollManagement.bonusRegister.removeConfirm', { count: picked.length }),
      () => {
        void removeSelected(picked.map((row) => row.employee_id));
      },
      {
        title: t('payrollManagement.bonusRegister.removeTitle'),
        confirmColor: 'error',
        messageTone: 'danger',
      }
    );
  }

  async function removeSelected(employeeIds: number[]) {
    if (typeof companyId !== 'number' || employeeIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await payrollService.removePayrollBonuses(bonusBody({ employee_ids: employeeIds }));
      setRows((prev) => prev.filter((row) => !employeeIds.includes(row.employee_id)));
      setSelected((prev) => prev.filter((id) => !employeeIds.includes(id)));
      showSuccessPopup(t('payrollManagement.bonusRegister.removed', { count: employeeIds.length }));
      await load({ silent: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || t('payrollManagement.bonusRegister.saveFailed'));
      await load({ silent: true });
    } finally {
      setSaving(false);
    }
  }

  async function save(markPaid: boolean) {
    if (typeof companyId !== 'number' || !fiscalYear) return;
    if (markPaid && selectedSaved.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await payrollService.registerPayrollBonuses(
        bonusBody(
          markPaid
            ? { employee_ids: selectedSaved.map((row) => row.employee_id), mark_paid: true }
            : { generate_all: true }
        )
      );
      showSuccessPopup(
        t(markPaid ? 'payrollManagement.bonusRegister.paid' : 'payrollManagement.bonusRegister.saved')
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('payrollManagement.bonusRegister.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function commitLine(row: BonusRow, field: 'rate' | 'amount') {
    if (!canWrite || editLocked || typeof companyId !== 'number') return;
    const draft = drafts[row.employee_id];
    const rate = Number(draft?.rate ?? row.rate_percent);
    const amount =
      field === 'rate'
        ? amountFromRate(row.monthly_salary, rate, installments)
        : Number(draft?.amount ?? row.amount);
    if (!Number.isFinite(rate) || !Number.isFinite(amount) || rate < 0 || amount < 0) {
      setError(t('payrollManagement.bonusRegister.invalidAmount'));
      return;
    }
    if (Math.abs(rate - row.rate_percent) < 0.001 && Math.abs(amount - row.amount) < 0.5) return;
    setDrafts((prev) => ({
      ...prev,
      [row.employee_id]: { rate: String(rate), amount: String(Math.round(amount)) },
    }));
    setSaving(true);
    setError(null);
    try {
      const res = await payrollService.updatePayrollBonusLine(
        bonusBody({
          employee_id: row.employee_id,
          rate_percent: Math.round(rate * 100) / 100,
          amount: Math.round(amount),
        })
      );
      const saved = res?.data;
      setRows((prev) =>
        prev.map((item) =>
          item.employee_id === row.employee_id
            ? {
                ...item,
                id: saved?.id ?? item.id,
                rate_percent: Number(saved?.rate_percent ?? rate),
                amount: Number(saved?.amount ?? amount),
                status: saved?.status || item.status || 'registered',
              }
            : item
        )
      );
      showSuccessPopup(t('payrollManagement.bonusRegister.lineSaved'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('payrollManagement.bonusRegister.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function openApproval() {
    if (typeof companyId !== 'number') return;
    setApprovalOpen(true);
    setApprover(null);
    setLoadingApprovers(true);
    try {
      const res = await userService.getUsers({ company_id: companyId });
      const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setApprovers(
        list
          .filter(
            (user: any) =>
              String(user.status || 'active') === 'active' &&
              user.username &&
              Number(user.id) !== myId
          )
          .map((user: any) => ({
            id: Number(user.id),
            username: String(user.username),
            department: user.department || '',
            position: user.position || '',
          }))
          .filter((user: ApproverOption) => user.id > 0)
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || t('payrollManagement.bonusRegister.saveFailed'));
    } finally {
      setLoadingApprovers(false);
    }
  }

  async function requestApproval() {
    if (!approver || typeof companyId !== 'number') return;
    setSaving(true);
    setError(null);
    try {
      await payrollService.requestPayrollBonusApproval(bonusBody({ approver_id: approver.id }));
      setApprovalOpen(false);
      showSuccessPopup(t('payrollManagement.bonusRegister.approvalRequested'));
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || t('payrollManagement.bonusRegister.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function openStatement(row: BonusRow) {
    setStatementRow(row);
    if (typeof companyId !== 'number') {
      setStatementCompany(null);
      return;
    }
    setStatementCompany(await loadBonusCompanyInfo(companyId));
  }

  async function downloadOpenStatement() {
    if (!statementRow || typeof companyId !== 'number') return;
    setStatementDownloading(true);
    try {
      const blob = await generatePayslipPdfBlob(
        bonusStatementRow(statementRow, fiscalYear),
        statementCompany,
        {
          labels: BONUS_STATEMENT_LABELS,
          headerLayout: 'standard',
          companyId,
          purpose: 'download',
          documentView: bonusStatementView(statementRow, fiscalYear, currentInstallment, installments),
        }
      );
      const filename = `Bonus statement (${fiscalYear}) (${statementRow.employee_name}).pdf`.replace(
        /[\\/:*?"<>|]/g,
        '_'
      );
      downloadPayslipPdf(blob, filename);
    } catch (err: any) {
      setError(err?.message || t('payrollManagement.bonusRegister.saveFailed'));
    } finally {
      setStatementDownloading(false);
    }
  }

  async function downloadStatement() {
    if (typeof companyId !== 'number' || selectedSaved.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const companyInfo = await loadBonusCompanyInfo(companyId);
      const views = new Map(
        selectedSaved.map((row) => [
          row.employee_id,
          bonusStatementView(row, fiscalYear, currentInstallment, installments),
        ])
      );
      const filename =
        selectedSaved.length === 1
          ? `Bonus statement (${fiscalYear}) (${selectedSaved[0].employee_name}).pdf`
          : `Bonus statements (${fiscalYear}) (${selectedSaved.length}).pdf`;
      await downloadPayslipsPdfBatch(
        selectedSaved.map((row) => bonusStatementRow(row, fiscalYear)),
        companyInfo,
        {
          labels: BONUS_STATEMENT_LABELS,
          headerLayout: 'standard',
          companyId,
          purpose: 'download',
          filename,
          documentViewForRow: (row) => views.get(row.id),
        }
      );
      showSuccessPopup(t('payrollManagement.bonusRegister.statementReady'));
    } catch (err: any) {
      setError(err?.message || t('payrollManagement.bonusRegister.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function confirmSend() {
    showConfirm(
      t('payrollManagement.bonusRegister.mailConfirm', { count: selectedSaved.length }),
      () => void sendStatements(),
      { title: t('payrollManagement.bonusRegister.mailConfirmTitle') }
    );
  }

  async function sendStatements() {
    if (typeof companyId !== 'number' || selectedSaved.length === 0) return;
    const targets = [...selectedSaved];
    const total = targets.length;
    setSaving(true);
    setError(null);
    setMailProgress({ open: true, phase: 'prepare', done: 0, total, name: '' });
    let sent = 0;
    let failed = 0;
    let firstError = '';
    try {
      const companyInfo = await loadBonusCompanyInfo(companyId);
      for (let index = 0; index < targets.length; index += 1) {
        const row = targets[index];
        setMailProgress({
          open: true,
          phase: 'prepare',
          done: index,
          total,
          name: row.employee_name,
        });
        let pdfBase64 = '';
        try {
          const blob = await generatePayslipPdfBlob(bonusStatementRow(row, fiscalYear), companyInfo, {
            labels: BONUS_STATEMENT_LABELS,
            headerLayout: 'standard',
            companyId,
            purpose: 'email',
            documentView: bonusStatementView(row, fiscalYear, currentInstallment, installments),
          });
          pdfBase64 = await payslipBlobToBase64(blob);
        } catch (prepErr: any) {
          failed += 1;
          if (!firstError) {
            firstError = String(prepErr?.message || t('payrollManagement.bonusRegister.saveFailed'));
          }
          setMailProgress({
            open: true,
            phase: 'prepare',
            done: index + 1,
            total,
            name: row.employee_name,
          });
          continue;
        }

        setMailProgress({
          open: true,
          phase: 'send',
          done: index,
          total,
          name: row.employee_name,
        });
        try {
          const res = await payrollService.sendPayrollBonusStatements(
            bonusBody({
              employee_ids: [row.employee_id],
              statements: [{ employee_id: row.employee_id, pdf_base64: pdfBase64 }],
            }),
            { skipErrorPopup: true, timeout: 180000 }
          );
          const batchSent = Number(res?.data?.sent || 0);
          const batchFailed = Array.isArray(res?.data?.failed) ? res.data.failed.length : 0;
          sent += batchSent;
          failed += batchFailed;
          if (batchFailed > 0 && !firstError) {
            const detail = res?.data?.failed?.[0]?.message;
            firstError = String(detail || res?.message || '').trim();
          }
        } catch (err: any) {
          failed += 1;
          if (!firstError) {
            const raw = String(err?.response?.data?.message || err?.message || '');
            const timedOut = err?.code === 'ECONNABORTED' || /timeout/i.test(raw);
            const noResponse =
              !err?.response && /failed to fetch|network error|load failed/i.test(raw);
            firstError = timedOut
              ? t('payrollManagement.bonusRegister.mailTimeout')
              : noResponse
                ? t('payrollManagement.bonusRegister.mailNetwork')
                : raw.trim() || t('payrollManagement.bonusRegister.mailNetwork');
          }
        }
        setMailProgress({
          open: true,
          phase: 'send',
          done: index + 1,
          total,
          name: row.employee_name,
        });
      }

      if (failed > 0) {
        setError(
          firstError ||
            t('payrollManagement.bonusRegister.mailPartial', { count: sent, failed })
        );
        showErrorPopup(
          t('payrollManagement.bonusRegister.mailPartial', { count: sent, failed })
        );
      } else {
        showSuccessPopup(t('payrollManagement.bonusRegister.mailSent', { count: sent }));
      }
    } catch (err: any) {
      const raw = String(err?.response?.data?.message || err?.message || '');
      const timedOut = err?.code === 'ECONNABORTED' || /timeout/i.test(raw);
      setError(
        timedOut
          ? t('payrollManagement.bonusRegister.mailTimeout')
          : raw || t('payrollManagement.bonusRegister.mailNetwork')
      );
    } finally {
      setMailProgress({ open: false, phase: 'prepare', done: 0, total: 0, name: '' });
      setSaving(false);
    }
  }

  async function exportExcel() {
    const headers = [
      t('payrollManagement.bonusRegister.columns.name'),
      'Emp No',
      t('payrollManagement.bonusRegister.columns.department'),
      t('payrollManagement.bonusRegister.columns.hireDate'),
      t('payrollManagement.bonusRegister.columns.months'),
      t('payrollManagement.bonusRegister.columns.monthly'),
      t('payrollManagement.bonusRegister.columns.rate'),
      t('payrollManagement.bonusRegister.columns.amount'),
      t('payrollManagement.bonusRegister.columns.status'),
      'Email',
      'Account',
      'IFSC',
    ];
    await exportBonusListToExcel(
      rows.map((row) => ({
        employee_name: row.employee_name,
        employee_number: row.employee_number,
        department: row.department,
        email: row.email,
        hire_date: row.hire_date,
        months_worked: row.months_worked,
        monthly_salary: row.monthly_salary,
        rate_percent: row.rate_percent,
        amount: row.amount,
        bank_account: row.bank_account,
        bank_ifsc: row.bank_ifsc,
        statusLabel:
          row.status === 'paid'
            ? t('payrollManagement.bonusRegister.statusPaid')
            : row.status === 'registered'
              ? t('payrollManagement.bonusRegister.statusRegistered')
              : t('payrollManagement.bonusRegister.statusNone'),
      })),
      headers,
      `bonus_${fiscalYear}_${currentInstallment}.xlsx`
    );
    showSuccessPopup(t('payrollManagement.bonusRegister.excelDone'));
  }

  function openBank() {
    if (typeof companyId !== 'number') return;
    const saved = readIciciBulkSaved(companyId);
    setCorporateId(saved.corporateId);
    setDebitAccount(saved.accountNo);
    setBankError('');
    setBankOpen(true);
  }

  async function exportBank() {
    if (bankId === 'icici') {
      const accountNo = debitAccount.replace(/\D/g, '');
      if (!corporateId.trim()) {
        setBankError(t('payrollManagement.bankBulk.iciciCorporateIdRequired'));
        return;
      }
      if (accountNo.length !== 12) {
        setBankError(t('payrollManagement.bankBulk.iciciAccountInvalid'));
        return;
      }
      writeIciciBulkSaved(typeof companyId === 'number' ? companyId : null, {
        corporateId: corporateId.trim(),
        accountNo,
      });
    }
    setBankExporting(true);
    setBankError('');
    try {
      const bankLabel = t(`payrollManagement.bankBulk.banks.${bankId}`);
      const result = await exportPayrollBankBulkTransfer(
        savedRows.map((row) => ({
          employee_name: row.employee_name,
          emp_id: row.employee_number,
          bank_account: row.bank_account,
          ifsc: row.bank_ifsc,
          employee_email: row.email,
          net_salary_payable: Math.round(row.amount),
        })),
        {
          bankId,
          debitAccount,
          corporateId,
          payrollPeriod: `${fiscalYear}-${currentInstallment}`,
          bankLabel,
          purpose: 'Bonus',
        }
      );
      setBankOpen(false);
      if (result.exported <= 0) showErrorPopup(t('payrollManagement.errors.bankBulkNoEligible'));
      else if (result.skipped > 0) {
        showSuccessPopup(
          t('payrollManagement.success.bankBulkExportedPartial', {
            count: result.exported,
            skipped: result.skipped,
            bank: bankLabel,
          })
        );
      } else {
        showSuccessPopup(
          t('payrollManagement.success.bankBulkExported', { count: result.exported, bank: bankLabel })
        );
      }
    } catch {
      setBankError(t('payrollManagement.errors.bankBulkExportFailed'));
    } finally {
      setBankExporting(false);
    }
  }

  if (typeof companyId !== 'number') {
    return <Alert severity="info">{t('payrollManagement.bonusRegister.selectCompany')}</Alert>;
  }

  const bankEligible = countEligiblePayrollBankRows(
    savedRows.map((row) => ({
      employee_name: row.employee_name,
      emp_id: row.employee_number,
      bank_account: row.bank_account,
      ifsc: row.bank_ifsc,
      employee_email: row.email,
      net_salary_payable: Math.round(row.amount),
    }))
  );

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('payrollManagement.bonusRegister.hint')}
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {t('payrollManagement.bonusRegister.people')} {rows.length}
              {' · '}
              {t('payrollManagement.bonusRegister.thisPayment')} {rupee(total)}
            </Typography>
            <Chip size="small" label={approvalChip.label} color={approvalChip.color} variant="outlined" />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button size="small" variant="outlined" disabled={rows.length === 0} onClick={() => void exportExcel()} sx={mvsBodyOutlinedBtnSx}>
              {t('payrollManagement.bonusRegister.exportExcel')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canWrite || saving || !paymentUnlocked || savedRows.length === 0}
              onClick={openBank}
              sx={mvsBodyOutlinedBtnSx}
              title={!paymentUnlocked ? t('payrollManagement.bonusRegister.needApproval') : ''}
            >
              {t('payrollManagement.bonusRegister.bankBulk')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canWrite || saving || selectedSaved.length === 0}
              onClick={() => void downloadStatement()}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('payrollManagement.bonusRegister.statement')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canWrite || saving || !paymentUnlocked || selectedSaved.length === 0}
              onClick={confirmSend}
              sx={mvsBodyOutlinedBtnSx}
              title={!paymentUnlocked ? t('payrollManagement.bonusRegister.needApproval') : ''}
            >
              {t('payrollManagement.bonusRegister.sendMail')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canWrite || saving || editLocked || savedRows.length === 0}
              onClick={() => void openApproval()}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('payrollManagement.bonusRegister.requestApproval')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canWrite || saving || !paymentUnlocked || selectedSaved.length === 0}
              onClick={() => void save(true)}
              sx={mvsBodyOutlinedBtnSx}
              title={!paymentUnlocked ? t('payrollManagement.bonusRegister.needApproval') : ''}
            >
              {t('payrollManagement.bonusRegister.markPaid')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canWrite || saving || editLocked || selected.length === 0}
              onClick={confirmRemove}
              sx={mvsBodyOutlinedBtnSx}
              title={editLocked ? t('payrollManagement.bonusRegister.removeLocked') : ''}
            >
              {t('payrollManagement.bonusRegister.remove')}
            </Button>
            <Button
              variant="contained"
              disableElevation
              size="small"
              disabled={!canWrite || saving || !fiscalYear || editLocked}
              onClick={() => {
                if (savedRows.length > 0) {
                  showConfirm(
                    t('payrollManagement.bonusRegister.regenerateConfirm'),
                    () => void save(false),
                    { title: t('payrollManagement.bonusRegister.regenerateTitle') }
                  );
                  return;
                }
                void save(false);
              }}
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
            <MenuItem value={1} disabled={installments === 2}>
              {t('payrollManagement.bonusRegister.once')}
            </MenuItem>
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
            <Table size="small" sx={{ minWidth: 1080 }}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={allChecked}
                      indeterminate={selected.length > 0 && !allChecked}
                      onChange={() => setSelected(allChecked ? [] : rows.map((row) => row.employee_id))}
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
                {rows.map((row) => {
                  const draft = drafts[row.employee_id];
                  return (
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
                        <Box
                          component="button"
                          type="button"
                          onClick={() => void openStatement(row)}
                          sx={{
                            border: 0,
                            p: 0,
                            m: 0,
                            bgcolor: 'transparent',
                            color: 'primary.main',
                            font: 'inherit',
                            cursor: 'pointer',
                            textAlign: 'left',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {row.employee_name}
                          {row.employee_number ? ` (${row.employee_number})` : ''}
                        </Box>
                      </TableCell>
                      <TableCell>{row.department || '-'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.hire_date || '-'}</TableCell>
                      <TableCell align="right">{row.months_worked}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {rupee(row.monthly_salary)}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {canWrite && !editLocked ? (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                            <TextField
                              variant="standard"
                              value={draft?.rate ?? String(row.rate_percent)}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.employee_id]: {
                                    rate: e.target.value,
                                    amount: prev[row.employee_id]?.amount ?? String(Math.round(row.amount)),
                                  },
                                }))
                              }
                              onBlur={() => void commitLine(row, 'rate')}
                              inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontSize: 13, width: 64 } }}
                            />
                            <span>%</span>
                            {installments === 2 ? (
                              <Typography variant="caption" color="text.secondary">
                                {t('payrollManagement.bonusRegister.rateShare')}
                              </Typography>
                            ) : null}
                          </Box>
                        ) : (
                          <>
                            {row.rate_percent}%
                            {installments === 2 ? ` ${t('payrollManagement.bonusRegister.rateShare')}` : ''}
                          </>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {canWrite && !editLocked ? (
                          <TextField
                            variant="standard"
                            value={draft?.amount ?? String(Math.round(row.amount))}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [row.employee_id]: {
                                  rate: prev[row.employee_id]?.rate ?? String(row.rate_percent),
                                  amount: e.target.value,
                                },
                              }))
                            }
                            onBlur={() => void commitLine(row, 'amount')}
                            inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontSize: 13, width: 88 } }}
                          />
                        ) : (
                          rupee(row.amount)
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {row.status === 'paid'
                          ? t('payrollManagement.bonusRegister.statusPaid')
                          : row.status === 'registered'
                            ? t('payrollManagement.bonusRegister.statusRegistered')
                            : t('payrollManagement.bonusRegister.statusNone')}
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      <Dialog
        open={approvalOpen}
        onClose={() => {
          if (!saving) setApprovalOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle>{t('payrollManagement.bonusRegister.approverTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('payrollManagement.bonusRegister.approverHint', {
                year: fiscalYear,
                count: savedRows.length,
              })}
            </Typography>
            <Autocomplete
              options={approvers}
              loading={loadingApprovers}
              value={approver}
              onChange={(_event, value) => setApprover(value)}
              getOptionLabel={(option) =>
                option.department || option.position
                  ? `${option.username} (${[option.department, option.position].filter(Boolean).join(' · ')})`
                  : option.username
              }
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('payrollManagement.dialog.approverLabel')}
                  size="small"
                  required
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setApprovalOpen(false)} sx={getMvsDialogCancelButtonSx(theme)} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={saving || !approver}
            onClick={() => void requestApproval()}
            sx={getMvsDialogPrimaryConfirmButtonSx()}
          >
            {t('payrollManagement.bonusRegister.requestApproval')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bankOpen}
        onClose={() => {
          if (!bankExporting) setBankOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle>{t('payrollManagement.bankBulk.dialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('payrollManagement.bankBulk.dialogHint', {
                period: `${fiscalYear} / ${currentInstallment}`,
                total: savedRows.length,
                eligible: bankEligible,
              })}
            </Typography>
            {bankError ? <Alert severity="warning">{bankError}</Alert> : null}
            <TextField
              select
              fullWidth
              size="small"
              label={t('payrollManagement.bankBulk.bankLabel')}
              value={bankId}
              onChange={(e) => setBankId(e.target.value as PayrollBulkBankId)}
            >
              <MenuItem value="hana">{t('payrollManagement.bankBulk.banks.hana')}</MenuItem>
              <MenuItem value="shinhan">{t('payrollManagement.bankBulk.banks.shinhan')}</MenuItem>
              <MenuItem value="kotak">{t('payrollManagement.bankBulk.banks.kotak')}</MenuItem>
              <MenuItem value="icici">{t('payrollManagement.bankBulk.banks.icici')}</MenuItem>
            </TextField>
            {bankId === 'icici' && (
              <TextField
                fullWidth
                size="small"
                label={t('payrollManagement.bankBulk.corporateIdLabel')}
                value={corporateId}
                onChange={(e) => setCorporateId(e.target.value)}
                helperText={t('payrollManagement.bankBulk.corporateIdHelper')}
              />
            )}
            <TextField
              fullWidth
              size="small"
              label={
                bankId === 'icici'
                  ? t('payrollManagement.bankBulk.accountNoLabel')
                  : t('payrollManagement.bankBulk.debitAccountLabel')
              }
              value={debitAccount}
              onChange={(e) => setDebitAccount(e.target.value)}
              helperText={
                bankId === 'icici'
                  ? t('payrollManagement.bankBulk.accountNoHelper')
                  : t('payrollManagement.bankBulk.debitAccountHelper')
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setBankOpen(false)} disabled={bankExporting} sx={getMvsDialogCancelButtonSx(theme)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={bankExporting}
            onClick={() => void exportBank()}
            sx={getMvsDialogPrimaryConfirmButtonSx()}
          >
            {bankId === 'icici'
              ? t('payrollManagement.bankBulk.downloadTxt')
              : t('payrollManagement.bankBulk.download')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!statementRow}
        onClose={() => {
          if (!statementDownloading) setStatementRow(null);
        }}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>
          {BONUS_STATEMENT_LABELS.title}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2, bgcolor: 'bodyArea.main', px: { xs: 2, sm: 3 } }}>
          {statementRow ? (
            <PayslipContent
              row={bonusStatementRow(statementRow, fiscalYear)}
              labels={BONUS_STATEMENT_LABELS}
              companyInfo={statementCompany}
              companyId={typeof companyId === 'number' ? companyId : null}
              documentView={bonusStatementView(
                statementRow,
                fiscalYear,
                currentInstallment,
                installments
              )}
              showTitle={false}
              wide
              headerLayout="standard"
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatementRow(null)} disabled={statementDownloading} sx={mvsBodyOutlinedBtnSx}>
            {t('common.close')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => void downloadOpenStatement()}
            disabled={!statementRow || statementDownloading}
            startIcon={statementDownloading ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={mvsBodyPrimaryBtnSx}
          >
            PDF
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        messageTone={dialogState.messageTone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <Dialog
        open={mailProgress.open}
        disableEscapeKeyDown
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle>{t('payrollManagement.bonusRegister.mailProgressTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {mailProgress.phase === 'prepare'
              ? t('payrollManagement.bonusRegister.mailProgressPreparing', {
                  done: mailProgress.done,
                  total: mailProgress.total,
                })
              : t('payrollManagement.bonusRegister.mailProgressSending', {
                  done: mailProgress.done,
                  total: mailProgress.total,
                })}
          </Typography>
          {mailProgress.name ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('payrollManagement.bonusRegister.mailProgressCurrent', {
                name: mailProgress.name,
              })}
            </Typography>
          ) : null}
          <LinearProgress
            variant="determinate"
            value={
              mailProgress.total > 0
                ? Math.min(100, (mailProgress.done / mailProgress.total) * 100)
                : 0
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {mailProgress.done} / {mailProgress.total}
          </Typography>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
