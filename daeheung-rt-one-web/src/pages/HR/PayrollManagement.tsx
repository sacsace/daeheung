import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  MenuItem,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  InputAdornment,
  Tooltip,
  CircularProgress,
  Autocomplete,
  Chip,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootFullBleedSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
} from '../../theme/daeheungLayout';
import { useTranslation } from 'react-i18next';
import {
  Add as AddIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  AttachMoney as MoneyIcon,
  Email as EmailIcon,
  TaskAlt as TaskAltIcon,
  FileDownload as FileDownloadIcon,
  AccountBalance as BankTransferIcon,
  Send as SendIcon,
  PictureAsPdf as PictureAsPdfIcon,
  CheckBox as CheckBoxIcon,
  SelectAll as SelectAllIcon,
} from '@mui/icons-material';
import { payrollService, companyService, userService } from '../../services/api';
import { useStore } from '../../store';
import PayrollBonusPanel from './PayrollBonusPanel';
import PayrollExcelGrid, {
  payrollRecordToGridRow,
  sortPayrollGridRowsDefault,
  type PayrollGridRow,
} from './PayrollExcelGrid';
import PayrollPayslipDialog from './PayrollPayslipDialog';
import PayrollSendPayslipsDialog from './PayrollSendPayslipsDialog';
import { exportPayrollGridToExcel } from './payroll/exportPayrollGridToExcel';
import {
  countEligiblePayrollBankRows,
  exportPayrollBankBulkTransfer,
  readIciciBulkSaved,
  writeIciciBulkSaved,
  type PayrollBulkBankId,
} from './payroll/exportPayrollBankBulkTransfer';
import { downloadPayslipsPdfBatch } from './payrollPayslipPdf';
import { toPayslipCompanyInfo } from './PayslipContent';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { syncPayrollGridSettingsFromServer } from './payroll/payrollGridSettingsSync';
import { resolveRegisteredStateCodeFromCompanyLike } from './payroll/indianProfessionalTax';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import {
  normalizePayMonth,
  isPayMonthAfterCurrent,
  currentPayMonthYm as getCurrentPayMonthYm,
  shiftPayMonthYm,
  formatPayMonthLabel,
} from '../../utils/payMonth';
import { subscribeApprovalStatusChanged } from '../../utils/approvalStatusSync';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';

const PAYROLL_MENU_ROUTES = ['/hr/payroll', '/hr'] as const;
const PAYSLIP_SEND_MENU_ROUTES = ['/hr/payslip-send', '/hr'] as const;
const PAYROLL_FILTER_OUTLINED = mvsOutlinedLabelProps;
const payrollFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

function parsePayrollMoney(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function formatPayrollSummaryRupee(amount: number): string {
  return Math.floor(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** 필드 테두리·라벨 영역 클릭 시에도 네이티브 월 선택기가 열리도록 */
function openMonthPickerFromFieldContainer(e: React.MouseEvent<HTMLElement>) {
  if ((e.target as HTMLElement).closest('input[type="month"]')) return;
  const input = e.currentTarget.querySelector('input[type="month"]') as HTMLInputElement | null;
  if (!input || input.disabled) return;
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  } catch {
    input.focus();
    input.click();
  }
}

type PayrollBulkPreviewAttendance = {
  with_attendance: number;
  without_attendance: number;
  without_attendance_usernames: string[];
  daily_without_records: { id: number; username: string }[];
};

type PayrollBulkPreviewPayload = {
  payroll_period: string;
  can_generate: boolean;
  block_reason?: string | null;
  will_replace?: boolean;
  existing_active_count?: number;
  employee_total: number;
  attendance: PayrollBulkPreviewAttendance | null;
};

type PayrollPeriodApprovalInfo = {
  id: number;
  status: string;
  title?: string;
  requester_id?: number;
  current_approver_id?: number | null;
  requester?: { id: number; username?: string } | null;
  currentApprover?: { id: number; username?: string } | null;
  amount?: number | null;
};

type ApproverOption = { id: number; username: string; department?: string; position?: string };

type PayrollManagementProps = {
  /** 급여 생성·수정 없이 확정된 급여 목록에서 명세서를 메일 발송하는 전용 화면 */
  payslipSendOnly?: boolean;
};

const PayrollManagement: React.FC<PayrollManagementProps> = ({ payslipSendOnly = false }) => {
  const { t, i18n } = useTranslation();
  const payMonthLocale = i18n.language || 'en';
  const payMonthInputLang = String(payMonthLocale).toLowerCase().startsWith('ko') ? 'ko-KR' : 'en-US';
  const user = useStore((s) => s.user);
  const isRoot = useStore((s) => s.user?.role === 'root');
  const canSelectCompany = false;
  const menuFlags = useMenuRoutePermissionFlags(
    payslipSendOnly ? PAYSLIP_SEND_MENU_ROUTES : PAYROLL_MENU_ROUTES
  );
  const [payrollSection, setPayrollSection] = useState<'payroll' | 'bonus'>('payroll');
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [payrollPeriod, setPayrollPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [creating, setCreating] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipRow, setPayslipRow] = useState<PayrollGridRow | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [lockedPeriods, setLockedPeriods] = useState<Set<string>>(new Set());
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [sendAfterCompleteOpen, setSendAfterCompleteOpen] = useState(false);
  const [sendAutomatically, setSendAutomatically] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [periodApproval, setPeriodApproval] = useState<PayrollPeriodApprovalInfo | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approverOptions, setApproverOptions] = useState<ApproverOption[]>([]);
  const [selectedApprover, setSelectedApprover] = useState<ApproverOption | null>(null);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [payrollPreviewOpen, setPayrollPreviewOpen] = useState(false);
  const [payrollPreviewPayload, setPayrollPreviewPayload] = useState<PayrollBulkPreviewPayload | null>(null);
  const [previewAttendanceLoading, setPreviewAttendanceLoading] = useState(false);
  const [companyRegisteredStateCode, setCompanyRegisteredStateCode] = useState<string | null>(null);
  const [companyDebitAccount, setCompanyDebitAccount] = useState('');
  const [bankBulkDialogOpen, setBankBulkDialogOpen] = useState(false);
  const [bankBulkBankId, setBankBulkBankId] = useState<PayrollBulkBankId>('icici');
  const [bankBulkDebitAccount, setBankBulkDebitAccount] = useState('');
  const [bankBulkCorporateId, setBankBulkCorporateId] = useState('');
  const [bankBulkExporting, setBankBulkExporting] = useState(false);
  const [bankBulkFormError, setBankBulkFormError] = useState('');
  const [selectedPayslipRowIds, setSelectedPayslipRowIds] = useState<number[]>([]);
  const [payslipDownloadAnchor, setPayslipDownloadAnchor] = useState<null | HTMLElement>(null);
  const [payslipDownloading, setPayslipDownloading] = useState(false);
  const [payslipDownloadProgress, setPayslipDownloadProgress] = useState({ done: 0, total: 0 });
  /** 서버 급여 그리드 설정 동기화 후 행 재계산 트리거 */
  const [gridSettingsTick, setGridSettingsTick] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>(() =>
    user?.company_id != null && Number(user.company_id) > 0 ? Number(user.company_id) : ''
  );
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: number; name: string }>>([]);

  const effectiveCompanyId = useMemo(() => {
    if (canSelectCompany) {
      return typeof selectedCompanyId === 'number' && selectedCompanyId > 0 ? selectedCompanyId : null;
    }
    const loginId = Number(user?.company_id);
    return Number.isFinite(loginId) && loginId > 0 ? loginId : null;
  }, [canSelectCompany, selectedCompanyId, user?.company_id]);

  const companyScopeOpts = useMemo(
    () => (effectiveCompanyId != null ? { company_id: effectiveCompanyId } : undefined),
    [effectiveCompanyId]
  );

  useEffect(() => {
    if (!canSelectCompany) {
      setCompanyOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await companyService.getCompanies();
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (cancelled) return;
        const list: Array<{ id: number; name: string }> = rows
          .map((c: any) => ({
            id: Number(c.id),
            name: shortCompanyName(c.name || c.company_name) || String(c.name || c.company_name || '').trim(),
          }))
          .filter((c: { id: number; name: string }) => Number.isFinite(c.id) && c.id > 0 && c.name)
          .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
        setCompanyOptions(list);
        setSelectedCompanyId((prev) => {
          if (typeof prev === 'number' && list.some((c) => c.id === prev)) return prev;
          const loginId = Number(user?.company_id);
          if (Number.isFinite(loginId) && loginId > 0 && list.some((c) => c.id === loginId)) {
            return loginId;
          }
          return list[0]?.id ?? '';
        });
      } catch {
        if (!cancelled) setCompanyOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSelectCompany, user?.company_id]);

  useEffect(() => {
    let cancelled = false;
    const loadCompanyState = async () => {
      const companyId = effectiveCompanyId;
      if (!companyId) {
        if (!cancelled) {
          setCompanyRegisteredStateCode(null);
          setCompanyDebitAccount('');
        }
        return;
      }
      try {
        const response = await companyService.getCompany(Number(companyId));
        if (!response.success || !response.data) {
          if (!cancelled) {
            setCompanyRegisteredStateCode(null);
            setCompanyDebitAccount('');
          }
          return;
        }
        const data = response.data;
        let gstNumbers = data.gst_numbers ?? data.gstNumbers ?? [];
        try {
          const gstRes = await companyService.getCompanyGstNumbers(Number(companyId));
          if (gstRes?.success && Array.isArray(gstRes.data?.gst_numbers) && gstRes.data.gst_numbers.length > 0) {
            gstNumbers = gstRes.data.gst_numbers;
          }
        } catch {
          /* GST API 실패 시 회사 본문의 gst_numbers 사용 */
        }
        const code = resolveRegisteredStateCodeFromCompanyLike({
          settings: data.settings,
          address: data.address,
          business_number: data.business_number || data.businessNumber,
          gst_numbers: gstNumbers
        });
        const debit = String(
          data.account_number || data.accountNumber || data.bank_account || ''
        ).trim();
        if (!cancelled) {
          setCompanyRegisteredStateCode(code);
          setCompanyDebitAccount(debit);
        }
      } catch {
        if (!cancelled) {
          setCompanyRegisteredStateCode(null);
          setCompanyDebitAccount('');
        }
      }
    };
    void loadCompanyState();
    return () => {
      cancelled = true;
    };
  }, [effectiveCompanyId]);

  useEffect(() => {
    let cancelled = false;
    void syncPayrollGridSettingsFromServer(effectiveCompanyId ?? null).then(() => {
      if (!cancelled) setGridSettingsTick((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveCompanyId]);

  const payrollRecalcContext = useMemo(
    () => ({
      companyStateCode: companyRegisteredStateCode,
      payrollMonth: normalizePayMonth(payrollPeriod.trim()) || payrollPeriod.trim(),
      companyId: effectiveCompanyId ?? null,
    }),
    [companyRegisteredStateCode, payrollPeriod, effectiveCompanyId]
  );

  const loadLocks = useCallback(async () => {
    if (menuFlags.menusLoading || !menuFlags.canRead || effectiveCompanyId == null) {
      setLockedPeriods(new Set());
      return;
    }
    try {
      const res = await payrollService.getPayrollPeriodLocks({ company_id: effectiveCompanyId });
      if (res.success && Array.isArray((res as any).data?.locked_periods)) {
        const keys = ((res as any).data.locked_periods as string[])
          .map((p) => normalizePayMonth(p) || String(p).trim())
          .filter(Boolean);
        setLockedPeriods(new Set(keys));
      }
    } catch {
      /* ignore */
    }
  }, [menuFlags.menusLoading, menuFlags.canRead, effectiveCompanyId]);

  const loadPayrollData = useCallback(async () => {
    if (menuFlags.menusLoading || !menuFlags.canRead || effectiveCompanyId == null) {
      setPayrollRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await payrollService.getPayrolls({
        page: 1,
        limit: 10000,
        company_id: effectiveCompanyId,
      });
      if (response.success) {
        setPayrollRecords(response.data || []);
      } else {
        setError(response.message || t('payrollManagement.errors.loadFailed'));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('payrollManagement.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, menuFlags.menusLoading, menuFlags.canRead, effectiveCompanyId]);

  useEffect(() => {
    void loadPayrollData();
    void loadLocks();
  }, [loadPayrollData, loadLocks]);

  const periodTrim = payrollPeriod.trim();
  const periodKey = normalizePayMonth(periodTrim);

  const loadPeriodApproval = useCallback(async () => {
    if (
      payslipSendOnly ||
      menuFlags.menusLoading ||
      !menuFlags.canRead ||
      effectiveCompanyId == null ||
      !periodKey
    ) {
      setPeriodApproval(null);
      return;
    }
    try {
      const res = await payrollService.getPayrollPeriodApproval({
        payroll_period: periodKey,
        company_id: effectiveCompanyId,
      });
      if (res?.success) {
        setPeriodApproval((res.data?.approval as PayrollPeriodApprovalInfo) || null);
      } else {
        setPeriodApproval(null);
      }
    } catch {
      setPeriodApproval(null);
    }
  }, [
    payslipSendOnly,
    menuFlags.menusLoading,
    menuFlags.canRead,
    effectiveCompanyId,
    periodKey,
  ]);

  useEffect(() => {
    void loadPeriodApproval();
  }, [loadPeriodApproval]);

  /** 전자결재 승인/반려 후·탭 복귀 시 결재 상태 즉시 동기화 */
  useEffect(() => {
    if (payslipSendOnly) return;
    return subscribeApprovalStatusChanged(() => {
      void loadPeriodApproval();
    });
  }, [payslipSendOnly, loadPeriodApproval]);

  /** 결재 진행 중이면 주기적으로 상태 재조회 (승인자가 다른 화면에서 처리한 경우) */
  useEffect(() => {
    if (payslipSendOnly) return;
    const status = String(periodApproval?.status || '');
    if (status !== 'submitted' && status !== 'in_review') return;
    const timer = window.setInterval(() => {
      void loadPeriodApproval();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [payslipSendOnly, periodApproval?.status, loadPeriodApproval]);

  const isFuturePayMonth = !!periodKey && isPayMonthAfterCurrent(periodKey);
  const currentPayMonthYm = getCurrentPayMonthYm();
  const maxSelectablePayMonth = currentPayMonthYm;
  const isThisMonthSelected = periodKey === currentPayMonthYm;
  /** 이번 달이 아니면「지난달」을 강조(연속으로 이전달 이동하는 버튼) */
  const isLastMonthNavActive = !!periodKey && !isThisMonthSelected;

  const selectPayMonth = useCallback((ym: string) => {
    const normalized = normalizePayMonth(ym) || ym;
    setPayrollPeriod(normalized);
  }, []);

  const goToPreviousPayMonth = useCallback(() => {
    const base = periodKey || normalizePayMonth(payrollPeriod) || currentPayMonthYm;
    const prev = shiftPayMonthYm(base, -1);
    if (prev) setPayrollPeriod(prev);
  }, [periodKey, payrollPeriod, currentPayMonthYm]);

  /** 목록·요약: 선택 급여월(정규화)과 일치하는 활성 급여만 */
  const payrollRecordsForSelectedMonth = useMemo(() => {
    if (!periodKey) return [];
    // 발송 전용 화면은 확정된 급여월의 명세서만 노출한다.
    if (payslipSendOnly && !lockedPeriods.has(periodKey)) return [];
    return payrollRecords.filter((p: any) => {
      const rowMonth = normalizePayMonth(String(p.payroll_period ?? '').trim());
      const active = p.is_active === undefined || p.is_active === true;
      return active && rowMonth === periodKey;
    });
  }, [payrollRecords, periodKey, payslipSendOnly, lockedPeriods]);

  const filteredRecords = useMemo(() => {
    let list = [...payrollRecordsForSelectedMonth];
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter((p: any) => {
        const emp = p.employee || {};
        return (
          String(emp.username || '')
            .toLowerCase()
            .includes(s) ||
          String(emp.department || '')
            .toLowerCase()
            .includes(s) ||
          String(emp.position || '')
            .toLowerCase()
            .includes(s)
        );
      });
    }
    if (departmentFilter) {
      list = list.filter((p: any) => (p.employee?.department || '') === departmentFilter);
    }
    return list;
  }, [payrollRecordsForSelectedMonth, searchTerm, departmentFilter]);

  useEffect(() => {
    setSelectedPayslipRowIds([]);
  }, [periodKey, effectiveCompanyId, searchTerm, departmentFilter]);

  const gridRows = useMemo(() => {
    const ctx = {
      ...payrollRecalcContext,
      payrollEmployeeCount: payrollRecordsForSelectedMonth.length,
    };
    const rows = filteredRecords.map((p, i) => payrollRecordToGridRow(p, i, ctx));
    return sortPayrollGridRowsDefault(rows);
  }, [
    filteredRecords,
    payrollRecalcContext,
    payrollRecordsForSelectedMonth.length,
    gridSettingsTick,
  ]);

  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          payrollRecordsForSelectedMonth.map((p: any) => p.employee?.department).filter(Boolean) as string[]
        )
      ),
    [payrollRecordsForSelectedMonth]
  );

  /** 조회 급여월(`periodKey`)에 해당하는 활성 급여만 합산 — 상단 카드·그리드 데이터 범위와 동일 */
  const summaryStats = useMemo(() => {
    const rows = payrollRecordsForSelectedMonth;
    return {
      gross: rows.reduce((s, p: any) => s + parsePayrollMoney(p.gross_salary), 0),
      net: rows.reduce((s, p: any) => s + parsePayrollMoney(p.net_salary), 0),
      tax: rows.reduce((s, p: any) => s + parsePayrollMoney(p.tax_amount), 0),
      pending: rows.filter((p: any) => p.status === 'pending').length
    };
  }, [payrollRecordsForSelectedMonth]);

  /** 미리보기 API로 출퇴근·중복 여부 확인 후 확인 창 표시 */
  const handleRequestBulkPayrollPreview = async () => {
    if (menuFlags.menusLoading || !menuFlags.canCreate) return;
    const pk = normalizePayMonth(payrollPeriod.trim());
    if (!pk) {
      setError(t('payrollManagement.errors.periodRequired'));
      return;
    }
    if (isPayMonthAfterCurrent(pk)) {
      setError(t('payrollManagement.errors.futurePayMonthNotAllowed'));
      return;
    }
    if (lockedPeriods.has(pk)) {
      setError(t('payrollManagement.errors.periodLocked'));
      return;
    }
    setPreviewAttendanceLoading(true);
    setError('');
    try {
      if (effectiveCompanyId == null) {
        setError(t('payrollManagement.selectCompanyRequired'));
        return;
      }
      const res = await payrollService.previewBulkPayrollGeneration(
        payrollPeriod.trim(),
        companyScopeOpts
      );
      if (!res.success) {
        setError((res as any).message || t('payrollManagement.errors.bulkCreateFailed'));
        return;
      }
      const data = (res as any).data as PayrollBulkPreviewPayload;
      if (!data.can_generate) {
        if (data.block_reason === 'already_exists') {
          // 하위 호환: 예전 API가 차단해도 미확정 월이면 재생성 확인으로 진행
          setError(t('payrollManagement.preview.blockedAlreadyExists'));
        } else {
          setError(t('payrollManagement.errors.bulkCreateFailed'));
        }
        return;
      }
      setPayrollPreviewPayload(data);
      setOpenDialog(false);
      setPayrollPreviewOpen(true);
    } catch (err: any) {
      const st = err.response?.status;
      const msg = err.response?.data?.message;
      if (st === 403 && msg) setError(msg);
      else setError(msg || t('payrollManagement.errors.bulkCreateFailed'));
    } finally {
      setPreviewAttendanceLoading(false);
    }
  };

  const handleExecuteBulkPayrollAfterPreview = async () => {
    if (menuFlags.menusLoading || !menuFlags.canCreate) return;
    const pk = normalizePayMonth(payrollPeriod.trim());
    const period = pk || payrollPeriod.trim();
    if (!period) {
      setError(t('payrollManagement.errors.periodRequired'));
      return;
    }
    if (pk && isPayMonthAfterCurrent(pk)) {
      setError(t('payrollManagement.errors.futurePayMonthNotAllowed'));
      return;
    }
    if (pk && lockedPeriods.has(pk)) {
      setError(t('payrollManagement.errors.periodLocked'));
      return;
    }
    setCreating(true);
    setError('');
    try {
      if (effectiveCompanyId == null) {
        setError(t('payrollManagement.selectCompanyRequired'));
        return;
      }
      const res = await payrollService.bulkGeneratePayrolls(period, companyScopeOpts);
      if (res.success) {
        setSuccess((res as any).message || t('payrollManagement.success.bulkCreated'));
        setOpenDialog(false);
        setPayrollPreviewOpen(false);
        setPayrollPreviewPayload(null);
        await loadPayrollData();
        await loadPeriodApproval();
      } else {
        setError((res as any).message || t('payrollManagement.errors.bulkCreateFailed'));
      }
    } catch (err: any) {
      const st = err.response?.status;
      const msg = err.response?.data?.message;
      if (st === 403 && msg) setError(msg);
      else if (st === 409) setError(msg || t('payrollManagement.errors.alreadyGenerated'));
      else setError(msg || t('payrollManagement.errors.bulkCreateFailed'));
    } finally {
      setCreating(false);
    }
  };

  const openApprovalRequestDialog = useCallback(async () => {
    if (menuFlags.menusLoading || !menuFlags.canMutate || effectiveCompanyId == null) return;
    setApprovalDialogOpen(true);
    setSelectedApprover(null);
    setLoadingApprovers(true);
    try {
      const res = await userService.getUsers({ company_id: effectiveCompanyId });
      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const myId = user?.id != null ? Number(user.id) : null;
      const activeList: ApproverOption[] = rows
        .filter((u: any) => {
          const id = Number(u.id);
          const st = String(u.status || 'active').toLowerCase();
          if (!Number.isFinite(id) || id <= 0) return false;
          if (myId != null && id === myId) return false;
          if (st === 'inactive' || st === 'resigned' || st === 'deleted') return false;
          return Boolean(String(u.username || u.name || '').trim());
        })
        .map((u: any) => ({
          id: Number(u.id),
          username: String(u.username || u.name || '').trim(),
          department: String(u.department || ''),
          position: String(u.position || ''),
        }))
        .sort((a: ApproverOption, b: ApproverOption) => a.username.localeCompare(b.username));
      setApproverOptions(activeList);
    } catch {
      setApproverOptions([]);
    } finally {
      setLoadingApprovers(false);
    }
  }, [menuFlags.menusLoading, menuFlags.canMutate, effectiveCompanyId, user?.id]);

  const handleRequestPayrollApproval = async () => {
    if (menuFlags.menusLoading || !menuFlags.canMutate) return;
    const period = periodKey || periodTrim;
    if (!period) {
      setError(t('payrollManagement.errors.periodRequired'));
      return;
    }
    if (!selectedApprover?.id) {
      setError(t('payrollManagement.errors.approverRequired'));
      return;
    }
    if (effectiveCompanyId == null) {
      setError(t('payrollManagement.selectCompanyRequired'));
      return;
    }
    setRequestingApproval(true);
    setError('');
    try {
      const res = await payrollService.requestPayrollPeriodApproval({
        payroll_period: period,
        approver_id: selectedApprover.id,
        company_id: effectiveCompanyId,
      });
      if (res?.success) {
        setSuccess((res as any).message || t('payrollManagement.success.approvalRequested'));
        setApprovalDialogOpen(false);
        setSelectedApprover(null);
        await loadPeriodApproval();
      } else {
        setError((res as any).message || t('payrollManagement.errors.approvalRequestFailed'));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('payrollManagement.errors.approvalRequestFailed'));
    } finally {
      setRequestingApproval(false);
    }
  };

  const handleConfirmCompletePeriod = async () => {
    if (menuFlags.menusLoading || !menuFlags.canMutate) return;
    const period = normalizePayMonth(payrollPeriod.trim()) || payrollPeriod.trim();
    if (!period) {
      setError(t('payrollManagement.errors.periodRequired'));
      return;
    }
    const pkComplete = normalizePayMonth(payrollPeriod.trim());
    if (pkComplete && isPayMonthAfterCurrent(pkComplete)) {
      setError(t('payrollManagement.errors.futurePayMonthNotAllowed'));
      return;
    }
    if (lockedPeriods.has(period)) {
      setCompleteDialogOpen(false);
      return;
    }
    if (!isRoot && String(periodApproval?.status || '') !== 'approved') {
      setError(t('payrollManagement.errors.approvalRequired'));
      setCompleteDialogOpen(false);
      return;
    }
    setCompleting(true);
    setError('');
    try {
      if (effectiveCompanyId == null) {
        setError(t('payrollManagement.selectCompanyRequired'));
        return;
      }
      const res = await payrollService.completePayrollPeriod(period, companyScopeOpts);
      if (res.success) {
        setSuccess((res as any).message || t('payrollManagement.success.periodCompleted'));
        setCompleteDialogOpen(false);
        await loadLocks();
        await loadPayrollData();
        await loadPeriodApproval();
        setSendAfterCompleteOpen(true);
      } else {
        setError((res as any).message || t('payrollManagement.errors.periodCompleteFailed'));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('payrollManagement.errors.periodCompleteFailed'));
    } finally {
      setCompleting(false);
    }
  };

  const handleOpenPayslip = useCallback(
    (row: PayrollGridRow) => {
      if (menuFlags.menusLoading || !menuFlags.canRead) return;
      setPayslipRow(row);
      setPayslipOpen(true);
    },
    [menuFlags.menusLoading, menuFlags.canRead]
  );

  const handleExportExcel = useCallback(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead || !gridRows.length) return;
    void (async () => {
      try {
        await exportPayrollGridToExcel(gridRows, t, effectiveCompanyId ?? null);
        setSuccess(t('payrollManagement.success.exportedExcel'));
      } catch {
        setError(t('payrollManagement.errors.exportFailed'));
      }
    })();
  }, [gridRows, menuFlags.canRead, menuFlags.menusLoading, t, effectiveCompanyId]);

  const selectedPayslipRows = useMemo(() => {
    if (!selectedPayslipRowIds.length) return [];
    const idSet = new Set(selectedPayslipRowIds);
    return gridRows.filter((r) => idSet.has(r.id));
  }, [gridRows, selectedPayslipRowIds]);

  const handleDownloadPayslips = useCallback(
    async (mode: 'selected' | 'all') => {
      if (menuFlags.menusLoading || !menuFlags.canRead || payslipDownloading) return;
      const periodLocked =
        !!periodKey && lockedPeriods.has(periodKey);
      if (!periodLocked) {
        setError(t('payrollManagement.payslip.downloadRequiresComplete'));
        return;
      }
      const targetRows = mode === 'selected' ? selectedPayslipRows : gridRows;
      if (!targetRows.length) {
        setError(
          mode === 'selected'
            ? t('payrollManagement.payslip.downloadNoSelection')
            : t('payrollManagement.payslip.downloadNoRows')
        );
        return;
      }
      setPayslipDownloadAnchor(null);
      setPayslipDownloading(true);
      setPayslipDownloadProgress({ done: 0, total: targetRows.length });
      setError('');
      try {
        let companyInfo = null;
        if (effectiveCompanyId != null) {
          try {
            const company = await useReferenceDataStore
              .getState()
              .fetchCompanyById(effectiveCompanyId);
            companyInfo = toPayslipCompanyInfo(company);
          } catch {
            companyInfo = null;
          }
        }
        const result = await downloadPayslipsPdfBatch(targetRows, companyInfo, {
          locale: 'en',
          headerLayout: 'standard',
          companyId: effectiveCompanyId,
          purpose: 'download',
          onProgress: (done, total) => setPayslipDownloadProgress({ done, total }),
        });
        setSuccess(
          t('payrollManagement.success.payslipsDownloaded', { count: result.count })
        );
      } catch {
        setError(t('payrollManagement.errors.payslipDownloadFailed'));
      } finally {
        setPayslipDownloading(false);
        setPayslipDownloadProgress({ done: 0, total: 0 });
      }
    },
    [
      menuFlags.menusLoading,
      menuFlags.canRead,
      payslipDownloading,
      periodKey,
      lockedPeriods,
      selectedPayslipRows,
      gridRows,
      effectiveCompanyId,
      t,
    ]
  );

  const openBankBulkDialog = useCallback(() => {
    const saved = readIciciBulkSaved(effectiveCompanyId);
    setBankBulkCorporateId(saved.corporateId);
    setBankBulkDebitAccount(saved.accountNo || companyDebitAccount);
    setBankBulkFormError('');
    setBankBulkDialogOpen(true);
  }, [companyDebitAccount, effectiveCompanyId]);

  const handleExportBankBulk = useCallback(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead || !gridRows.length) return;
    void (async () => {
      setBankBulkExporting(true);
      setError('');
      setBankBulkFormError('');
      try {
        const bankLabel = t(`payrollManagement.bankBulk.banks.${bankBulkBankId}`);
        if (bankBulkBankId === 'icici') {
          const corporateId = bankBulkCorporateId.trim();
          const accountNo = bankBulkDebitAccount.replace(/\D/g, '');
          if (!corporateId) {
            setBankBulkFormError(t('payrollManagement.bankBulk.iciciCorporateIdRequired'));
            return;
          }
          if (accountNo.length !== 12) {
            setBankBulkFormError(t('payrollManagement.bankBulk.iciciAccountInvalid'));
            return;
          }
          writeIciciBulkSaved(effectiveCompanyId, { corporateId, accountNo });
        }
        const result = await exportPayrollBankBulkTransfer(gridRows, {
          bankId: bankBulkBankId,
          debitAccount: bankBulkDebitAccount,
          corporateId: bankBulkCorporateId,
          payrollPeriod: periodKey || periodTrim,
          bankLabel,
        });
        setBankBulkDialogOpen(false);
        if (result.exported <= 0) {
          setError(t('payrollManagement.errors.bankBulkNoEligible'));
        } else if (result.skipped > 0) {
          setSuccess(
            t('payrollManagement.success.bankBulkExportedPartial', {
              count: result.exported,
              skipped: result.skipped,
              bank: bankLabel,
            })
          );
        } else {
          setSuccess(
            t('payrollManagement.success.bankBulkExported', {
              count: result.exported,
              bank: bankLabel,
            })
          );
        }
      } catch {
        setError(t('payrollManagement.errors.bankBulkExportFailed'));
      } finally {
        setBankBulkExporting(false);
      }
    })();
  }, [
    menuFlags.menusLoading,
    menuFlags.canRead,
    gridRows,
    bankBulkBankId,
    bankBulkDebitAccount,
    bankBulkCorporateId,
    effectiveCompanyId,
    periodKey,
    periodTrim,
    t,
  ]);

  /** 급여 생성 완료(잠금)된 월 — 명세서 발송 허용·「급여 생성 완료」재실행 비활성 */
  const selectedPeriodPayrollComplete = !!periodKey && lockedPeriods.has(periodKey);
  /** 확정된 월만 상단·대화상자에서 일괄 생성 차단(미생성 월은 미리보기 후 생성) */
  const bulkCreateBlockedByLock = !!periodKey && lockedPeriods.has(periodKey);
  /** 그리드가 이미 선택 월만 표시하므로 동일 */
  const gridRowsForPayslipSend = gridRows;

  const payslipSendDisabled =
    menuFlags.menusLoading ||
    !menuFlags.canMutate ||
    loading ||
    !selectedPeriodPayrollComplete ||
    gridRowsForPayslipSend.length === 0;

  const payslipSendTooltip = payslipSendDisabled
    ? loading || menuFlags.menusLoading
      ? ''
      : !menuFlags.canMutate
        ? t('common.menuNoMutate')
        : !selectedPeriodPayrollComplete
          ? t('payrollManagement.payslip.sendRequiresComplete')
          : t('payrollManagement.payslip.sendNoRowsForPayMonth')
    : '';

  const payslipDownloadDisabled =
    menuFlags.menusLoading ||
    !menuFlags.canRead ||
    loading ||
    payslipDownloading ||
    !selectedPeriodPayrollComplete ||
    gridRows.length === 0;

  const payslipDownloadTooltip = payslipDownloading
    ? payslipDownloadProgress.total > 0
      ? t('payrollManagement.payslip.downloadProgress', {
          done: payslipDownloadProgress.done,
          total: payslipDownloadProgress.total,
        })
      : ''
    : payslipDownloadDisabled
      ? loading || menuFlags.menusLoading
        ? ''
        : !menuFlags.canRead
          ? t('common.menuNoView')
          : !selectedPeriodPayrollComplete
            ? t('payrollManagement.payslip.downloadRequiresComplete')
            : t('payrollManagement.payslip.downloadNoRows')
      : '';

  const bankBulkEligibleCount = useMemo(
    () => countEligiblePayrollBankRows(gridRows),
    [gridRows]
  );
  const bankBulkDisabled =
    menuFlags.menusLoading ||
    !menuFlags.canRead ||
    loading ||
    !selectedPeriodPayrollComplete ||
    gridRows.length === 0;
  const bankBulkTooltip = bankBulkDisabled
    ? loading || menuFlags.menusLoading
      ? ''
      : !menuFlags.canRead
        ? t('common.menuNoView')
        : !selectedPeriodPayrollComplete
          ? t('payrollManagement.bankBulk.requiresComplete')
          : t('payrollManagement.bankBulk.noRows')
    : '';

  /** 상단「+ 급여 생성」: 확정(생성 완료)된 월은 열 수 없음 */
  const bulkCreateOpenDisabled =
    menuFlags.menusLoading ||
    !menuFlags.canCreate ||
    creating ||
    bulkCreateBlockedByLock ||
    effectiveCompanyId == null;
  /** 대화상자「생성」: 확정·미래 월 비활성(미생성 과거·당월은 미리보기로 판별) */
  const bulkCreateDisabled =
    bulkCreateOpenDisabled ||
    previewAttendanceLoading ||
    isFuturePayMonth;
  const bulkCreateDialogTooltip = bulkCreateDisabled
    ? previewAttendanceLoading || creating || menuFlags.menusLoading
      ? ''
      : !menuFlags.canCreate
        ? t('common.menuNoCreate')
        : effectiveCompanyId == null
          ? t('payrollManagement.selectCompanyRequired')
        : isFuturePayMonth
          ? t('payrollManagement.errors.futurePayMonthNotAllowed')
          : periodKey && lockedPeriods.has(periodKey)
            ? t('payrollManagement.errors.periodLocked')
            : ''
    : '';
  const bulkCreateHeaderTooltip = bulkCreateOpenDisabled
    ? creating || menuFlags.menusLoading
      ? ''
      : !menuFlags.canCreate
        ? t('common.menuNoCreate')
        : effectiveCompanyId == null
          ? t('payrollManagement.selectCompanyRequired')
        : bulkCreateBlockedByLock
          ? t('payrollManagement.errors.periodLocked')
          : ''
    : '';

  const approvalStatus = String(periodApproval?.status || '');
  const payrollApprovalApproved = approvalStatus === 'approved';
  const payrollApprovalSatisfied = isRoot || payrollApprovalApproved;
  const payrollApprovalInProgress =
    approvalStatus === 'submitted' || approvalStatus === 'in_review';
  const payrollApprovalRejected = approvalStatus === 'rejected' || approvalStatus === 'cancelled';

  const approvalStatusChip = useMemo(() => {
    if (payslipSendOnly || !periodKey || selectedPeriodPayrollComplete) return null;
    if (payrollApprovalApproved) {
      return {
        label: t('payrollManagement.approval.statusApproved'),
        color: 'success' as const,
      };
    }
    if (payrollApprovalInProgress) {
      const name = periodApproval?.currentApprover?.username;
      return {
        label: name
          ? t('payrollManagement.approval.statusInProgressWithApprover', { name })
          : t('payrollManagement.approval.statusInProgress'),
        color: 'warning' as const,
      };
    }
    if (payrollApprovalRejected) {
      return {
        label: t('payrollManagement.approval.statusRejected'),
        color: 'error' as const,
      };
    }
    if (isRoot) {
      return {
        label: t('payrollManagement.approval.statusRootBypass'),
        color: 'info' as const,
      };
    }
    return {
      label: t('payrollManagement.approval.statusRequired'),
      color: 'default' as const,
    };
  }, [
    payslipSendOnly,
    periodKey,
    selectedPeriodPayrollComplete,
    payrollApprovalApproved,
    payrollApprovalInProgress,
    payrollApprovalRejected,
    periodApproval?.currentApprover?.username,
    isRoot,
    t,
  ]);

  const requestApprovalDisabled =
    menuFlags.menusLoading ||
    !menuFlags.canMutate ||
    requestingApproval ||
    !periodKey ||
    payrollRecordsForSelectedMonth.length === 0 ||
    selectedPeriodPayrollComplete ||
    isFuturePayMonth ||
    payrollApprovalApproved ||
    payrollApprovalInProgress;
  const requestApprovalTooltip = requestApprovalDisabled
    ? requestingApproval || menuFlags.menusLoading
      ? ''
      : !menuFlags.canMutate
        ? t('common.menuNoMutate')
        : !periodKey
          ? t('payrollManagement.errors.periodRequired')
          : payrollRecordsForSelectedMonth.length === 0
            ? t('payrollManagement.errors.createPayrollFirst')
            : isFuturePayMonth
              ? t('payrollManagement.errors.futurePayMonthNotAllowed')
              : selectedPeriodPayrollComplete
                ? t('payrollManagement.errors.periodAlreadyFinalized')
                : payrollApprovalApproved
                  ? t('payrollManagement.approval.alreadyApproved')
                  : payrollApprovalInProgress
                    ? t('payrollManagement.approval.alreadyInProgress')
                    : ''
    : '';

  const completePayrollToolbarDisabled =
    menuFlags.menusLoading ||
    !menuFlags.canMutate ||
    completing ||
    !periodKey ||
    payrollRecordsForSelectedMonth.length === 0 ||
    selectedPeriodPayrollComplete ||
    isFuturePayMonth ||
    !payrollApprovalSatisfied;
  const completePayrollToolbarTooltip = completePayrollToolbarDisabled
    ? completing || menuFlags.menusLoading
      ? ''
      : !menuFlags.canMutate
        ? t('common.menuNoMutate')
        : !periodKey
          ? t('payrollManagement.errors.periodRequired')
          : payrollRecordsForSelectedMonth.length === 0
            ? t('payrollManagement.errors.createPayrollFirst')
          : isFuturePayMonth
            ? t('payrollManagement.errors.futurePayMonthNotAllowed')
            : selectedPeriodPayrollComplete
              ? t('payrollManagement.errors.periodAlreadyFinalized')
              : !payrollApprovalSatisfied
                ? payrollApprovalInProgress
                  ? t('payrollManagement.approval.waitForApproval')
                  : t('payrollManagement.errors.approvalRequired')
                : ''
    : '';

  const completeDialogConfirmDisabled =
    menuFlags.menusLoading ||
    !menuFlags.canMutate ||
    completing ||
    !periodKey ||
    payrollRecordsForSelectedMonth.length === 0 ||
    lockedPeriods.has(periodKey) ||
    isFuturePayMonth ||
    !payrollApprovalSatisfied;
  const completeDialogConfirmTooltip = completeDialogConfirmDisabled
    ? completing || menuFlags.menusLoading
      ? ''
      : !menuFlags.canMutate
        ? t('common.menuNoMutate')
        : !periodKey
          ? t('payrollManagement.errors.periodRequired')
          : payrollRecordsForSelectedMonth.length === 0
            ? t('payrollManagement.errors.createPayrollFirst')
          : isFuturePayMonth
            ? t('payrollManagement.errors.futurePayMonthNotAllowed')
            : lockedPeriods.has(periodKey)
              ? t('payrollManagement.errors.periodAlreadyFinalized')
              : !payrollApprovalSatisfied
                ? payrollApprovalInProgress
                  ? t('payrollManagement.approval.waitForApproval')
                  : t('payrollManagement.errors.approvalRequired')
                : ''
    : '';

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5,
    flex: 1,
    minHeight: 240,
  } as const;

  const hasActiveFilters = Boolean(searchTerm.trim() || departmentFilter);

  const handleResetFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('');
  };

  return (
    <Box sx={{ ...mvsPageRootFullBleedSx, flex: 1, minWidth: 0 }}>
      <DaeheungPageHeader
        title={t(payslipSendOnly ? 'payrollManagement.payslipSendSystem.title' : 'payrollManagement.title')}
        description={t(
          payslipSendOnly
            ? 'payrollManagement.payslipSendSystem.description'
            : 'payrollManagement.description'
        )}
        actions={
          canSelectCompany ? (
            <Autocomplete
              options={companyOptions}
              value={
                typeof selectedCompanyId === 'number'
                  ? companyOptions.find((c) => c.id === selectedCompanyId) ?? null
                  : null
              }
              onChange={(_, next) => {
                setSelectedCompanyId(next?.id && next.id > 0 ? next.id : '');
              }}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disableClearable={Boolean(
                typeof selectedCompanyId === 'number' &&
                  companyOptions.some((c) => c.id === selectedCompanyId)
              )}
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
              slotProps={companySelectListboxSlotProps}
              sx={{
                ...payrollFilterFieldSx,
                minWidth: { xs: '100%', sm: 260 },
                maxWidth: { sm: 360 },
                ...companySelectNowrapSx,
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={t('payrollManagement.company')}
                  placeholder={t('payrollManagement.searchCompany')}
                  {...PAYROLL_FILTER_OUTLINED}
                  sx={companySelectNowrapSx}
                />
              )}
            />
          ) : null
        }
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      {payslipSendOnly ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('payrollManagement.payslipSendSystem.completeOnlyHint')}
        </Alert>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {periodKey
            ? t('payrollManagement.summary.scopeForPayMonth', {
                period: formatPayMonthLabel(periodKey, payMonthLocale),
              })
            : t('payrollManagement.summary.scopeNoMonth')}
        </Typography>
      )}

      {!payslipSendOnly && (
        <Tabs
          value={payrollSection}
          onChange={(_, value: 'payroll' | 'bonus') => setPayrollSection(value)}
          sx={{ mb: 2, minHeight: 40, borderBottom: '1px solid #B4B4B4' }}
        >
          <Tab value="payroll" label={t('payrollManagement.tabPayroll')} sx={{ minHeight: 40, textTransform: 'none' }} />
          <Tab value="bonus" label={t('payrollManagement.tabBonus')} sx={{ minHeight: 40, textTransform: 'none' }} />
        </Tabs>
      )}

      {!payslipSendOnly && payrollSection === 'bonus' ? (
        <PayrollBonusPanel
          companyId={effectiveCompanyId ?? ''}
          canWrite={menuFlags.canMutate}
        />
      ) : null}

      {!payslipSendOnly && payrollSection === 'payroll' && selectedPeriodPayrollComplete && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('payrollManagement.payslip.sendAfterCompleteHint')}
        </Alert>
      )}

      {!payslipSendOnly && payrollSection === 'payroll' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2.5,
            mb: 3,
          }}
        >
          {[
            { key: 'gross', label: t('payrollManagement.summary.totalSalary'), value: `Rs. ${formatPayrollSummaryRupee(summaryStats.gross)}` },
            { key: 'net', label: t('payrollManagement.summary.netSalary'), value: `Rs. ${formatPayrollSummaryRupee(summaryStats.net)}` },
            { key: 'tax', label: t('payrollManagement.summary.totalTax'), value: `Rs. ${formatPayrollSummaryRupee(summaryStats.tax)}` },
            { key: 'pending', label: t('payrollManagement.summary.pendingPayroll'), value: String(summaryStats.pending), valueColor: 'warning.main' as const },
          ].map((item) => (
            <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                  {item.label}
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    mt: 0.75,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: item.valueColor ?? 'text.primary',
                  }}
                >
                  {item.value}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {(payslipSendOnly || payrollSection === 'payroll') && (
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            flexWrap: 'wrap',
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: { md: 'space-between' },
            gap: { xs: 1.25, md: 1 },
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {!payslipSendOnly && (
              <Tooltip title={t('common.menuNoView')} disableHoverListener={menuFlags.menusLoading || menuFlags.canRead}>
                <span style={{ display: 'inline-flex' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownloadIcon fontSize="small" />}
                    onClick={handleExportExcel}
                    disabled={menuFlags.menusLoading || !menuFlags.canRead || loading || gridRows.length === 0}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t('payrollManagement.actions.exportExcel')}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip title={payslipSendTooltip} disableHoverListener={!payslipSendTooltip}>
              <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EmailIcon fontSize="small" />}
                  disabled={payslipSendDisabled}
                  onClick={() => setSendDialogOpen(true)}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {t('payrollManagement.payslip.sendTitle')}
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={payslipDownloadTooltip} disableHoverListener={!payslipDownloadTooltip}>
              <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    payslipDownloading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <PictureAsPdfIcon fontSize="small" />
                    )
                  }
                  disabled={payslipDownloadDisabled}
                  onClick={(e) => setPayslipDownloadAnchor(e.currentTarget)}
                  sx={mvsBodyOutlinedBtnSx}
                >
                  {t('payrollManagement.payslip.downloadTitle')}
                </Button>
              </span>
            </Tooltip>
            <Menu
              anchorEl={payslipDownloadAnchor}
              open={Boolean(payslipDownloadAnchor)}
              onClose={() => setPayslipDownloadAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
              <MenuItem
                disabled={selectedPayslipRows.length === 0 || payslipDownloading}
                onClick={() => void handleDownloadPayslips('selected')}
              >
                <ListItemIcon>
                  <CheckBoxIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t('payrollManagement.payslip.downloadSelected')}
                  secondary={
                    selectedPayslipRows.length > 0
                      ? t('payrollManagement.payslip.downloadSelectedCount', {
                          count: selectedPayslipRows.length,
                        })
                      : t('payrollManagement.payslip.downloadNoSelection')
                  }
                />
              </MenuItem>
              <MenuItem
                disabled={gridRows.length === 0 || payslipDownloading}
                onClick={() => void handleDownloadPayslips('all')}
              >
                <ListItemIcon>
                  <SelectAllIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t('payrollManagement.payslip.downloadAll')}
                  secondary={t('payrollManagement.payslip.downloadAllCount', {
                    count: gridRows.length,
                  })}
                />
              </MenuItem>
            </Menu>
            {!payslipSendOnly && (
              <Tooltip title={bankBulkTooltip} disableHoverListener={!bankBulkTooltip}>
                <span style={{ display: 'inline-flex' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<BankTransferIcon fontSize="small" />}
                    disabled={bankBulkDisabled}
                    onClick={openBankBulkDialog}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t('payrollManagement.actions.bankBulkDownload')}
                  </Button>
                </span>
              </Tooltip>
            )}
            {!payslipSendOnly && approvalStatusChip && (
              <Chip
                size="small"
                label={approvalStatusChip.label}
                color={approvalStatusChip.color}
                variant={approvalStatusChip.color === 'default' ? 'outlined' : 'filled'}
                sx={{ height: 28, fontWeight: 600 }}
              />
            )}
            {!payslipSendOnly && (
              <Tooltip title={requestApprovalTooltip} disableHoverListener={!requestApprovalTooltip}>
                <span style={{ display: 'inline-flex' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SendIcon fontSize="small" />}
                    onClick={() => void openApprovalRequestDialog()}
                    disabled={requestApprovalDisabled}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t('payrollManagement.actions.requestApproval')}
                  </Button>
                </span>
              </Tooltip>
            )}
            {!payslipSendOnly && (
              <Tooltip title={completePayrollToolbarTooltip} disableHoverListener={!completePayrollToolbarTooltip}>
                <span style={{ display: 'inline-flex' }}>
                  <Button
                    variant="contained"
                    color="error"
                    disableElevation
                    size="small"
                    startIcon={<TaskAltIcon fontSize="small" />}
                    onClick={() => setCompleteDialogOpen(true)}
                    disabled={completePayrollToolbarDisabled}
                    sx={{
                      textTransform: 'none',
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      minHeight: 36,
                      px: 2,
                      boxShadow: 'none',
                    }}
                  >
                    {t('payrollManagement.actions.completePayroll')}
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
          {!payslipSendOnly && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
                flexShrink: 0,
                width: { xs: '100%', md: 'auto' },
                ml: { md: 'auto' },
              }}
            >
              <Tooltip title={bulkCreateHeaderTooltip} disableHoverListener={!bulkCreateHeaderTooltip}>
                <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                  <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={bulkCreateOpenDisabled}
                    onClick={() => setOpenDialog(true)}
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {t('payrollManagement.actions.createPayroll')}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          )}
        </Box>

        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            ...(mvsSearchFieldSx as Record<string, unknown>),
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'minmax(320px, 1.4fr) minmax(0, 1.5fr) minmax(0, 1fr) auto',
            },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              gap: 0.75,
              minWidth: 0,
            }}
          >
            <TextField
              key={`pay-month-${periodKey || payrollPeriod}`}
              size="small"
              type="month"
              label={t('payrollManagement.searchPayMonthLabel')}
              {...PAYROLL_FILTER_OUTLINED}
              value={periodKey || payrollPeriod}
              onChange={(e) => selectPayMonth(e.target.value)}
              onClick={openMonthPickerFromFieldContainer}
              inputProps={{ max: maxSelectablePayMonth, lang: payMonthInputLang }}
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
              sx={{
                ...payrollFilterFieldSx,
                flex: '1 1 140px',
                minWidth: 140,
                cursor: menuFlags.menusLoading || !menuFlags.canRead ? undefined : 'pointer',
              }}
            />
            <Button
              variant={isThisMonthSelected ? 'contained' : 'outlined'}
              size="small"
              disableElevation
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
              onClick={() => selectPayMonth(currentPayMonthYm)}
              sx={{
                ...(isThisMonthSelected ? mvsBodyPrimaryBtnSx : mvsBodyOutlinedBtnSx),
                height: 40,
                minWidth: 64,
                px: 1.25,
                whiteSpace: 'nowrap',
              }}
            >
              {t('payrollManagement.thisMonth')}
            </Button>
            <Button
              variant={isLastMonthNavActive ? 'contained' : 'outlined'}
              size="small"
              disableElevation
              disabled={menuFlags.menusLoading || !menuFlags.canRead}
              onClick={goToPreviousPayMonth}
              sx={{
                ...(isLastMonthNavActive ? mvsBodyPrimaryBtnSx : mvsBodyOutlinedBtnSx),
                height: 40,
                minWidth: 64,
                px: 1.25,
                whiteSpace: 'nowrap',
              }}
            >
              {t('payrollManagement.lastMonth')}
            </Button>
          </Box>
          <TextField
            fullWidth
            size="small"
            label={t('payrollManagement.searchFieldLabel')}
            {...PAYROLL_FILTER_OUTLINED}
            placeholder={t('payrollManagement.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={menuFlags.menusLoading || !menuFlags.canRead}
            sx={payrollFilterFieldSx}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            size="small"
            select
            label={t('payrollManagement.department')}
            {...PAYROLL_FILTER_OUTLINED}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            disabled={menuFlags.menusLoading || !menuFlags.canRead}
            SelectProps={{
              displayEmpty: true,
              renderValue: (selected) =>
                selected === '' || selected == null ? t('payrollManagement.all') : String(selected),
            }}
            sx={payrollFilterFieldSx}
          >
            <MenuItem value="">{t('payrollManagement.all')}</MenuItem>
            {departments.map((dept) => (
              <MenuItem key={dept} value={dept}>
                {dept}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ResetIcon fontSize="small" />}
            onClick={handleResetFilters}
            disabled={menuFlags.menusLoading || !menuFlags.canRead}
            sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
          >
            {t('payrollManagement.actions.reset')}
          </Button>
        </Box>
      </Card>
      )}

      {(payslipSendOnly || payrollSection === 'payroll') && (
      <Box sx={mvsBodyListZoneSx}>
        {loading && gridRows.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('payrollManagement.empty.loading')}
            </Typography>
          </Box>
        ) : gridRows.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <MoneyIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {hasActiveFilters
                ? t('payrollManagement.empty.noResults')
                : t('payrollManagement.empty.noItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {payslipSendOnly && periodKey && !selectedPeriodPayrollComplete
                ? t('payrollManagement.payslipSendSystem.unfinalizedMonthHint')
                : hasActiveFilters
                ? t('payrollManagement.empty.noResultsHint')
                : t('payrollManagement.empty.noItemsHint')}
            </Typography>
            {hasActiveFilters ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ResetIcon fontSize="small" />}
                onClick={handleResetFilters}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('payrollManagement.actions.reset')}
              </Button>
            ) : !payslipSendOnly ? (
              <Tooltip title={bulkCreateHeaderTooltip} disableHoverListener={!bulkCreateHeaderTooltip}>
                <span style={{ display: 'inline-flex' }}>
                  <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={bulkCreateOpenDisabled}
                    onClick={() => setOpenDialog(true)}
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {t('payrollManagement.actions.createPayroll')}
                  </Button>
                </span>
              </Tooltip>
            ) : null}
          </Box>
        ) : (
          <Box sx={{ ...mvsBodyListTableSx, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                px: { xs: 2, sm: 2.5 },
                py: 1.5,
                borderBottom: '1px solid #CBD5E1',
                bgcolor: '#FFFFFF',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {periodKey
                  ? t('payrollManagement.listSummary', {
                      period: formatPayMonthLabel(periodKey, payMonthLocale),
                      count: gridRows.length,
                    })
                  : t('payrollManagement.listSummaryNoMonth', { count: gridRows.length })}
              </Typography>
              <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
                {t('payrollManagement.gridHint')}
              </Typography>
            </Box>
            <Box sx={{ width: '100%', minWidth: 0, flex: '0 0 auto' }}>
              <PayrollExcelGrid
                rows={gridRows}
                loading={loading}
                onReload={loadPayrollData}
                onError={(msg) => setError(msg ?? '')}
                onSuccess={setSuccess}
                onOpenPayslip={handleOpenPayslip}
                lockedPeriods={lockedPeriods}
                isRoot={isRoot}
                allowCellEdit={!payslipSendOnly && !menuFlags.menusLoading && menuFlags.canMutate}
                allowDelete={!payslipSendOnly && !menuFlags.menusLoading && menuFlags.canDelete}
                allowOpenPayslip={!menuFlags.menusLoading && menuFlags.canRead}
                companyId={effectiveCompanyId}
                settingsRevision={gridSettingsTick}
                companyStateCode={companyRegisteredStateCode}
                payrollMonth={payrollRecalcContext.payrollMonth}
                payrollEmployeeCount={payrollRecordsForSelectedMonth.length}
                enableRowSelection
                selectedRowIds={selectedPayslipRowIds}
                onSelectedRowIdsChange={setSelectedPayslipRowIds}
              />
            </Box>
          </Box>
        )}
      </Box>
      )}

      <PayrollPayslipDialog
        open={payslipOpen}
        row={payslipRow}
        onClose={() => {
          setPayslipOpen(false);
          setPayslipRow(null);
        }}
        headerLayout="standard"
        companyIdOverride={effectiveCompanyId}
      />

      <PayrollSendPayslipsDialog
        open={sendDialogOpen}
        rows={gridRowsForPayslipSend}
        autoSend={sendAutomatically}
        headerLayout="standard"
        companyId={effectiveCompanyId}
        onClose={() => {
          setSendDialogOpen(false);
          setSendAutomatically(false);
        }}
        onSent={(msg) => setSuccess(msg)}
        onError={(msg) => setError(msg)}
      />

      <Dialog
        open={bankBulkDialogOpen}
        onClose={() => {
          if (!bankBulkExporting) setBankBulkDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('payrollManagement.bankBulk.dialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('payrollManagement.bankBulk.dialogHint', {
                period: periodKey || periodTrim || '—',
                total: gridRows.length,
                eligible: bankBulkEligibleCount,
              })}
            </Typography>
            {bankBulkFormError ? <Alert severity="warning">{bankBulkFormError}</Alert> : null}
            <TextField
              select
              fullWidth
              size="small"
              label={t('payrollManagement.bankBulk.bankLabel')}
              value={bankBulkBankId}
              onChange={(e) => {
                setBankBulkFormError('');
                setBankBulkBankId(e.target.value as PayrollBulkBankId);
              }}
              disabled={bankBulkExporting}
            >
              <MenuItem value="hana">{t('payrollManagement.bankBulk.banks.hana')}</MenuItem>
              <MenuItem value="shinhan">{t('payrollManagement.bankBulk.banks.shinhan')}</MenuItem>
              <MenuItem value="kotak">{t('payrollManagement.bankBulk.banks.kotak')}</MenuItem>
              <MenuItem value="icici">{t('payrollManagement.bankBulk.banks.icici')}</MenuItem>
            </TextField>
            {bankBulkBankId === 'icici' && (
              <TextField
                fullWidth
                size="small"
                label={t('payrollManagement.bankBulk.corporateIdLabel')}
                value={bankBulkCorporateId}
                onChange={(e) => {
                  setBankBulkFormError('');
                  setBankBulkCorporateId(e.target.value);
                }}
                onBlur={() =>
                  writeIciciBulkSaved(effectiveCompanyId, {
                    corporateId: bankBulkCorporateId,
                    accountNo: bankBulkDebitAccount,
                  })
                }
                helperText={t('payrollManagement.bankBulk.corporateIdHelper')}
                disabled={bankBulkExporting}
                InputLabelProps={{ shrink: true }}
              />
            )}
            <TextField
              fullWidth
              size="small"
              label={
                bankBulkBankId === 'icici'
                  ? t('payrollManagement.bankBulk.accountNoLabel')
                  : t('payrollManagement.bankBulk.debitAccountLabel')
              }
              value={bankBulkDebitAccount}
              onChange={(e) => {
                setBankBulkFormError('');
                setBankBulkDebitAccount(e.target.value);
              }}
              onBlur={() => {
                if (bankBulkBankId !== 'icici') return;
                writeIciciBulkSaved(effectiveCompanyId, {
                  corporateId: bankBulkCorporateId,
                  accountNo: bankBulkDebitAccount,
                });
              }}
              helperText={
                bankBulkBankId === 'icici'
                  ? t('payrollManagement.bankBulk.accountNoHelper')
                  : t('payrollManagement.bankBulk.debitAccountHelper')
              }
              disabled={bankBulkExporting}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBankBulkDialogOpen(false)} disabled={bankBulkExporting}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleExportBankBulk}
            disabled={bankBulkExporting || bankBulkEligibleCount <= 0}
            startIcon={
              bankBulkExporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon fontSize="small" />
            }
            sx={mvsBodyPrimaryBtnSx}
          >
            {bankBulkBankId === 'icici'
              ? t('payrollManagement.bankBulk.downloadTxt')
              : t('payrollManagement.bankBulk.download')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('payrollManagement.dialog.createTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('payrollManagement.dialog.enterInfo')}
            </Typography>
            <TextField
              fullWidth
              type="month"
              label={t('payrollManagement.dialog.payrollPeriodLabel')}
              value={payrollPeriod}
              onChange={(e) => setPayrollPeriod(e.target.value)}
              onClick={openMonthPickerFromFieldContainer}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: maxSelectablePayMonth, lang: payMonthInputLang }}
              disabled={menuFlags.menusLoading || !menuFlags.canCreate}
              sx={{ cursor: menuFlags.menusLoading || !menuFlags.canCreate ? undefined : 'pointer' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={creating || previewAttendanceLoading}>
            {t('common.cancel')}
          </Button>
          <Tooltip title={bulkCreateDialogTooltip} disableHoverListener={!bulkCreateDialogTooltip}>
            <span style={{ display: 'inline-flex' }}>
              <Button
                variant="contained"
                onClick={() => void handleRequestBulkPayrollPreview()}
                disabled={bulkCreateDisabled}
              >
                {t('payrollManagement.actions.create')}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      <Dialog
        open={payrollPreviewOpen}
        onClose={() => {
          if (!creating) {
            setPayrollPreviewOpen(false);
            setPayrollPreviewPayload(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('payrollManagement.preview.title')}</DialogTitle>
        <DialogContent>
          {payrollPreviewPayload && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(payrollPreviewPayload.will_replace ||
                (payrollPreviewPayload.existing_active_count || 0) > 0) && (
                <Alert severity="warning">
                  {t('payrollManagement.preview.replaceWarning', {
                    count: payrollPreviewPayload.existing_active_count || 0,
                    period: payrollPreviewPayload.payroll_period
                  })}
                </Alert>
              )}
              {payrollPreviewPayload.attendance && (
                <>
                  <Typography variant="body2">
                    {t('payrollManagement.preview.summary', {
                      period: payrollPreviewPayload.payroll_period,
                      total: payrollPreviewPayload.employee_total
                    })}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    {t('payrollManagement.preview.withAttendance', {
                      count: payrollPreviewPayload.attendance.with_attendance
                    })}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={
                      payrollPreviewPayload.attendance.without_attendance > 0
                        ? 'warning.main'
                        : 'text.secondary'
                    }
                  >
                    {t('payrollManagement.preview.withoutAttendance', {
                      count: payrollPreviewPayload.attendance.without_attendance
                    })}
                  </Typography>
                  {payrollPreviewPayload.attendance.without_attendance_usernames.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                      {t('payrollManagement.preview.withoutNames', {
                        names: payrollPreviewPayload.attendance.without_attendance_usernames.join(', ')
                      })}
                    </Typography>
                  )}
                  {payrollPreviewPayload.attendance.daily_without_records.length > 0 && (
                    <Alert severity="info" sx={{ mt: 0.5 }}>
                      {t('payrollManagement.preview.dailyNote')}
                    </Alert>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {t('payrollManagement.preview.footnote')}
                  </Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!creating) {
                setPayrollPreviewOpen(false);
                setPayrollPreviewPayload(null);
              }
            }}
            disabled={creating}
          >
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={() => void handleExecuteBulkPayrollAfterPreview()} disabled={creating}>
            {t('payrollManagement.preview.confirmRun')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={completeDialogOpen}
        onClose={() => !completing && setCompleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('payrollManagement.dialog.completeTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              fullWidth
              type="month"
              label={t('payrollManagement.dialog.payrollPeriodLabel')}
              value={payrollPeriod}
              onChange={(e) => setPayrollPeriod(e.target.value)}
              onClick={openMonthPickerFromFieldContainer}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: maxSelectablePayMonth, lang: payMonthInputLang }}
              sx={{
                mb: 2,
                cursor: menuFlags.menusLoading || !menuFlags.canMutate ? undefined : 'pointer'
              }}
              disabled={menuFlags.menusLoading || !menuFlags.canMutate}
            />
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {t('payrollManagement.dialog.completeLockWarning')}
            </Alert>
            {!payrollApprovalSatisfied && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {t('payrollManagement.errors.approvalRequired')}
              </Alert>
            )}
            {isRoot && !payrollApprovalApproved && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {t('payrollManagement.approval.rootBypassHint')}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              {t('payrollManagement.dialog.completeMessage', {
                period: payrollPeriod.trim() || '—'
              })}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompleteDialogOpen(false)} disabled={completing}>
            {t('common.cancel')}
          </Button>
          <Tooltip title={completeDialogConfirmTooltip} disableHoverListener={!completeDialogConfirmTooltip}>
            <span style={{ display: 'inline-flex' }}>
              <Button
                variant="contained"
                color="error"
                onClick={() => void handleConfirmCompletePeriod()}
                disabled={completeDialogConfirmDisabled}
              >
                {t('payrollManagement.actions.completePayroll')}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      <Dialog
        open={approvalDialogOpen}
        onClose={() => {
          if (!requestingApproval) {
            setApprovalDialogOpen(false);
            setSelectedApprover(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('payrollManagement.dialog.approvalTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('payrollManagement.dialog.approvalHint', {
                period: periodKey || periodTrim || '—',
                count: payrollRecordsForSelectedMonth.length,
              })}
            </Typography>
            <Autocomplete
              options={approverOptions}
              loading={loadingApprovers}
              value={selectedApprover}
              onChange={(_e, value) => setSelectedApprover(value)}
              getOptionLabel={(opt) =>
                opt.department || opt.position
                  ? `${opt.username} (${[opt.department, opt.position].filter(Boolean).join(' · ')})`
                  : opt.username
              }
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disabled={requestingApproval}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('payrollManagement.dialog.approverLabel')}
                  size="small"
                  required
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingApprovers ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setApprovalDialogOpen(false);
              setSelectedApprover(null);
            }}
            disabled={requestingApproval}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => void handleRequestPayrollApproval()}
            disabled={requestingApproval || !selectedApprover || loadingApprovers}
            startIcon={
              requestingApproval ? <CircularProgress size={16} color="inherit" /> : <SendIcon fontSize="small" />
            }
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('payrollManagement.actions.requestApproval')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={sendAfterCompleteOpen}
        onClose={() => setSendAfterCompleteOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>급여 명세서 메일 발송</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            급여 명세서를 이메일로 보내겠습니까? 이메일이 등록된 직원에게 PDF 명세서를 발송합니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendAfterCompleteOpen(false)}>아니요</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setSendAfterCompleteOpen(false);
              setSendAutomatically(true);
              setSendDialogOpen(true);
            }}
          >
            예, 메일 발송
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PayrollManagement;
