import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Checkbox,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Pagination,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsTableScrollSx,
  mvsBodyPaginationSx,
} from '../../theme/daeheungLayout';
import { useTheme, alpha, type SxProps, type Theme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Draw as DrawIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Visibility as VisibilityIcon,
  PictureAsPdf as PictureAsPdfIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { employmentContractService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { useStore } from '../../store';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';

const EMPLOYMENT_CONTRACT_MENU_ROUTES = ['/hr/employment-contracts', '/hr'] as const;

const ITEMS_PER_PAGE = 15;
const CONTRACT_FILTER_OUTLINED = mvsOutlinedLabelProps;
const contractFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;
const WIZARD_STEP_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const;

/** 전자계약서는 영문 표시 고정 */
const CONTRACT_TITLE_KO_TO_EN: Record<string, string> = {
  '고용 계약서': 'Employment Contract',
  '수습 고용 계약서': 'Probationary Employment Contract',
  '연봉 조정 계약서': 'Salary Adjustment Agreement',
};

function toEnglishContractTitle(title?: string | null): string {
  const raw = String(title || '').trim();
  if (!raw) return '';
  if (CONTRACT_TITLE_KO_TO_EN[raw]) return CONTRACT_TITLE_KO_TO_EN[raw];
  for (const [ko, en] of Object.entries(CONTRACT_TITLE_KO_TO_EN)) {
    if (raw.includes(ko)) return en;
  }
  return raw;
}

function templateDisplayName(tpl: { name?: string; version?: number | string } | null | undefined): string {
  if (!tpl) return '';
  const name = toEnglishContractTitle(tpl.name) || String(tpl.name || '');
  return tpl.version != null ? `${name} v${tpl.version}` : name;
}

type TabMode = 'contracts' | 'approvals' | 'my' | 'templates';
type MyContractFilterMode = 'all' | 'in_progress' | 'completed';

interface CompanyOption {
  id: number;
  name: string;
}

interface UserOption {
  id: number;
  username: string;
  userid: string;
}

interface ContractForm {
  template_id: string;
  title: string;
  employee_id: string;
  approver_id: string;
  contract_type: string;
  start_date: string;
  end_date: string;
  salary: string;
  bonus_type: string;
  bonus_value: string;
  work_location: string;
  working_days: string;
  working_hours: string;
  probation_months: string;
}

const emptyContractForm = (): ContractForm => ({
  template_id: '',
  title: '',
  employee_id: '',
  approver_id: '',
  contract_type: 'regular',
  start_date: '',
  end_date: '',
  salary: '',
  bonus_type: '',
  bonus_value: '',
  work_location: '',
  working_days: '',
  working_hours: '',
  probation_months: '',
});

const contractTableBodyRowSx: SxProps<Theme> = (theme) => {
  const base = typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hoverBg = theme.palette.mode === 'light' ? '#EFF6FF' : theme.palette.action.hover;
  return {
    ...(base as object),
    '& .MuiTableRow-root:nth-of-type(odd)': { bgcolor: rowBg },
    '& .MuiTableRow-root:nth-of-type(even)': { bgcolor: rowBg },
    '& .MuiTableRow-root:hover': { bgcolor: hoverBg },
    '& .MuiTableCell-body.action-cell': { overflow: 'visible' },
  };
};

const thLabelEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
} as const;

const cellEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap' as const,
  verticalAlign: 'middle' as const,
};

const EmploymentContractManagement: React.FC = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  /** 전자계약서 열람/승인 UI는 항상 영문 */
  const te = useMemo(() => i18n.getFixedT('en'), [i18n]);
  const { user } = useStore();
  const menuFlags = usePageMenuPermission(EMPLOYMENT_CONTRACT_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', EMPLOYMENT_CONTRACT_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', EMPLOYMENT_CONTRACT_MENU_ROUTES);
  const deleteGuard = useMenuActionGuard('delete', EMPLOYMENT_CONTRACT_MENU_ROUTES);
  const isRoot = user?.role === 'root';
  const canSelectCompany = false;
  const canManage = useMemo(
    () => menuFlags.canMutate || ['root', 'admin'].includes(String(user?.role || '')),
    [menuFlags.canMutate, user?.role]
  );
  const canViewCompanyContracts = canManage || canSelectCompany;
  const canDelete = isRoot && deleteGuard.allowed;

  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  const [tab, setTab] = useState<TabMode>(canViewCompanyContracts ? 'contracts' : 'my');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [myContracts, setMyContracts] = useState<any[]>([]);
  const [myContractFilter, setMyContractFilter] = useState<MyContractFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [contractsPage, setContractsPage] = useState(1);
  const [templatesPage, setTemplatesPage] = useState(1);
  const [myContractsPage, setMyContractsPage] = useState(1);
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', contract_type: 'regular', language: 'en', content_html: '' });

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardContractId, setWizardContractId] = useState<number | null>(null);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [contractForm, setContractForm] = useState<ContractForm>(emptyContractForm());

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailContract, setDetailContract] = useState<any | null>(null);

  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signContractId, setSignContractId] = useState<number | null>(null);
  const [signForm, setSignForm] = useState({
    sign_method: 'aadhaar_esign' as 'internal_ack' | 'aadhaar_esign',
    aadhaar_consent: false,
    aadhaar_last4: '',
    mock_otp: '',
  });
  const [aadhaarSession, setAadhaarSession] = useState<{
    session_token: string;
    asp_txn_id?: string;
    mode: string;
    requires_mock_otp: boolean;
    redirect_url?: string | null;
  } | null>(null);
  const [aadhaarBusy, setAadhaarBusy] = useState(false);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const workingHourOptions = useMemo(
    () => ['09:00 ~ 18:00', '08:30 ~ 17:30', '10:00 ~ 19:00', 'Mon-Fri / 8h per day', 'Flexible (Core Time 10:00 ~ 16:00)', 'Shift Schedule'],
    []
  );
  const workingDayOptions = useMemo(
    () => ['Monday-Friday', 'Monday-Saturday', 'Rotational Week-Off', 'Shift Roster', 'Flexible 5 Days'],
    []
  );

  const completedContractStatuses = useMemo(
    () => new Set(['signed', 'active', 'expired', 'terminated', 'cancelled']),
    []
  );
  const pendingContractStatuses = useMemo(
    () => new Set(['draft', 'pending_approval', 'rejected', 'in_review', 'awaiting_employee_sign']),
    []
  );
  const activeContractStatuses = useMemo(() => new Set(['signed', 'active']), []);

  const contractStatusLabel = useCallback(
    (statusRaw: string) => {
      const s = String(statusRaw || 'draft').toLowerCase();
      return t(`employmentContractManagement.status.${s}`, { defaultValue: s.replace(/_/g, ' ') });
    },
    [t]
  );

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => String(tpl.id) === contractForm.template_id),
    [templates, contractForm.template_id]
  );
  const isSalaryTemplate = useMemo(() => {
    const type = String(selectedTemplate?.contract_type || '').toLowerCase();
    const name = String(selectedTemplate?.name || '').toLowerCase();
    return type.includes('salary') || name.includes('salary') || name.includes('연봉');
  }, [selectedTemplate]);

  const normalizeSearch = (value: unknown) => String(value ?? '').trim().toLowerCase();

  const matchesContractSearch = useCallback(
    (row: any) => {
      const q = normalizeSearch(searchQuery);
      if (!q) return true;
      const status = String(row?.status || '').toLowerCase();
      const employeeFromUsers = users.find((u) => u.id === Number(row?.employee_id));
      const approverFromUsers = users.find((u) => u.id === Number(row?.approver_id));
      const haystack = [
        row?.id,
        row?.title,
        toEnglishContractTitle(row?.title),
        row?.employee?.username,
        row?.employee?.userid,
        row?.approver?.username,
        row?.approver?.userid,
        employeeFromUsers?.username,
        employeeFromUsers?.userid,
        approverFromUsers?.username,
        approverFromUsers?.userid,
        row?.start_date,
        row?.end_date,
        `${row?.start_date || ''} ~ ${row?.end_date || ''}`,
        status,
        contractStatusLabel(status),
      ]
        .map(normalizeSearch)
        .join(' ');
      return haystack.includes(q);
    },
    [searchQuery, contractStatusLabel, users]
  );

  const visibleMyContracts = useMemo(() => {
    let rows = myContracts;
    if (myContractFilter === 'completed') {
      rows = rows.filter((row) => completedContractStatuses.has(String(row?.status || '').toLowerCase()));
    } else if (myContractFilter === 'in_progress') {
      rows = rows.filter((row) => !completedContractStatuses.has(String(row?.status || '').toLowerCase()));
    }
    return rows.filter(matchesContractSearch);
  }, [myContracts, myContractFilter, completedContractStatuses, matchesContractSearch]);

  const visibleContracts = useMemo(() => contracts.filter(matchesContractSearch), [contracts, matchesContractSearch]);
  const visibleApprovals = useMemo(
    () => pendingApprovals.filter(matchesContractSearch),
    [pendingApprovals, matchesContractSearch]
  );
  const visibleTemplates = useMemo(() => {
    const q = normalizeSearch(searchQuery);
    if (!q) return templates;
    return templates.filter((row) => {
      const haystack = [row?.id, row?.name, row?.contract_type, row?.language, row?.version]
        .map(normalizeSearch)
        .join(' ');
      return haystack.includes(q);
    });
  }, [templates, searchQuery]);

  const paginatedContracts = useMemo(
    () => visibleContracts.slice((contractsPage - 1) * ITEMS_PER_PAGE, contractsPage * ITEMS_PER_PAGE),
    [visibleContracts, contractsPage]
  );
  const paginatedTemplates = useMemo(
    () => visibleTemplates.slice((templatesPage - 1) * ITEMS_PER_PAGE, templatesPage * ITEMS_PER_PAGE),
    [visibleTemplates, templatesPage]
  );
  const paginatedMyContracts = useMemo(
    () => visibleMyContracts.slice((myContractsPage - 1) * ITEMS_PER_PAGE, myContractsPage * ITEMS_PER_PAGE),
    [visibleMyContracts, myContractsPage]
  );
  const paginatedApprovals = useMemo(
    () => visibleApprovals.slice((approvalsPage - 1) * ITEMS_PER_PAGE, approvalsPage * ITEMS_PER_PAGE),
    [visibleApprovals, approvalsPage]
  );

  const contractsTotalPages = Math.max(1, Math.ceil(visibleContracts.length / ITEMS_PER_PAGE));
  const templatesTotalPages = Math.max(1, Math.ceil(visibleTemplates.length / ITEMS_PER_PAGE));
  const myContractsTotalPages = Math.max(1, Math.ceil(visibleMyContracts.length / ITEMS_PER_PAGE));
  const approvalsTotalPages = Math.max(1, Math.ceil(visibleApprovals.length / ITEMS_PER_PAGE));

  const visibleTemplateIds = useMemo(
    () => paginatedTemplates.map((row) => Number(row.id)).filter((id) => Number.isFinite(id)),
    [paginatedTemplates]
  );
  const allVisibleTemplatesSelected =
    visibleTemplateIds.length > 0 && visibleTemplateIds.every((id) => selectedTemplateIds.includes(id));
  const someVisibleTemplatesSelected = visibleTemplateIds.some((id) => selectedTemplateIds.includes(id));

  const kpiItems = useMemo(() => {
    if (tab === 'contracts') {
      return [
        { key: 'total', label: t('employmentContractManagement.stats.totalContracts'), value: contracts.length },
        {
          key: 'active',
          label: t('employmentContractManagement.stats.activeContracts'),
          value: contracts.filter((row) => activeContractStatuses.has(String(row?.status || '').toLowerCase())).length,
        },
        {
          key: 'pending',
          label: t('employmentContractManagement.stats.pendingContracts'),
          value: contracts.filter((row) => pendingContractStatuses.has(String(row?.status || '').toLowerCase())).length,
        },
      ];
    }
    if (tab === 'approvals') {
      return [{ key: 'pending', label: t('employmentContractManagement.stats.pendingApprovals'), value: pendingApprovals.length }];
    }
    if (tab === 'templates') {
      return [{ key: 'total', label: t('employmentContractManagement.stats.totalTemplates'), value: templates.length }];
    }
    const inProgress = myContracts.filter((row) => !completedContractStatuses.has(String(row?.status || '').toLowerCase())).length;
    const completed = myContracts.filter((row) => completedContractStatuses.has(String(row?.status || '').toLowerCase())).length;
    return [
      { key: 'total', label: t('employmentContractManagement.stats.myTotal'), value: myContracts.length },
      { key: 'inProgress', label: t('employmentContractManagement.stats.myInProgress'), value: inProgress },
      { key: 'completed', label: t('employmentContractManagement.stats.myCompleted'), value: completed },
    ];
  }, [tab, contracts, templates, myContracts, pendingApprovals, t, activeContractStatuses, pendingContractStatuses, completedContractStatuses]);

  useEffect(() => {
    if (!canViewCompanyContracts) setTab('my');
  }, [canViewCompanyContracts]);

  useEffect(() => {
    setSearchQuery('');
  }, [tab]);

  useEffect(() => {
    setContractsPage(1);
    setTemplatesPage(1);
    setMyContractsPage(1);
    setApprovalsPage(1);
    setSelectedTemplateIds([]);
  }, [tab, selectedCompanyId, myContractFilter, searchQuery]);

  useEffect(() => {
    setSelectedTemplateIds((prev) => prev.filter((id) => templates.some((row) => Number(row.id) === id)));
  }, [templates]);

  useEffect(() => {
    if (contractsPage > contractsTotalPages) setContractsPage(contractsTotalPages);
  }, [contractsPage, contractsTotalPages]);
  useEffect(() => {
    if (templatesPage > templatesTotalPages) setTemplatesPage(templatesTotalPages);
  }, [templatesPage, templatesTotalPages]);
  useEffect(() => {
    if (myContractsPage > myContractsTotalPages) setMyContractsPage(myContractsTotalPages);
  }, [myContractsPage, myContractsTotalPages]);
  useEffect(() => {
    if (approvalsPage > approvalsTotalPages) setApprovalsPage(approvalsTotalPages);
  }, [approvalsPage, approvalsTotalPages]);

  const loadCompanies = useCallback(async () => {
    if (!canSelectCompany) return;
    try {
      const rows = await useReferenceDataStore.getState().fetchCompanies();
      const mapped = rows
        .map((c: any) => ({
          id: Number(c.id),
          name: shortCompanyName(c.name) || String(c.name || `Company ${c.id}`),
        }))
        .filter((c) => Number.isFinite(c.id) && c.id > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      setCompanies(mapped);
      if (!selectedCompanyId && mapped.length > 0) {
        const loginCompanyId = Number(user?.company_id || 0);
        const matched = mapped.find((c) => c.id === loginCompanyId);
        setSelectedCompanyId(matched ? matched.id : mapped[0].id);
      }
    } catch {
      setMessage({ type: 'error', text: t('employmentContractManagement.loadCompaniesFailed', { defaultValue: '회사 목록을 불러오지 못했습니다.' }) });
    }
  }, [canSelectCompany, selectedCompanyId, user?.company_id, t]);

  const loadUsers = useCallback(async () => {
    try {
      const params = canSelectCompany && selectedCompanyId ? { company_id: Number(selectedCompanyId) } : undefined;
      const rows = await useReferenceDataStore.getState().fetchUsers(params);
      setUsers(
        rows
        .filter((u: any) => String(u.status || 'active') === 'active')
          .map((u: any) => ({ id: Number(u.id), username: String(u.username || ''), userid: String(u.userid || '') }))
      );
    } catch {
      setMessage({ type: 'error', text: t('employmentContractManagement.loadUsersFailed', { defaultValue: '직원 목록을 불러오지 못했습니다.' }) });
    }
  }, [canSelectCompany, selectedCompanyId, t]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const queryCompanyId = canSelectCompany && selectedCompanyId ? Number(selectedCompanyId) : undefined;
      const [myRes, approvalsRes] = await Promise.all([
        employmentContractService.getMyContracts(),
        employmentContractService.getPendingApprovals(),
      ]);
      setMyContracts(Array.isArray(myRes?.data) ? myRes.data : []);
      setPendingApprovals(Array.isArray(approvalsRes?.data) ? approvalsRes.data : []);

      if (canViewCompanyContracts) {
        const [templateRes, contractRes] = await Promise.all([
        employmentContractService.getTemplates(queryCompanyId),
        employmentContractService.getContracts({ company_id: queryCompanyId }),
      ]);
      setTemplates(Array.isArray(templateRes?.data) ? templateRes.data : []);
      setContracts(Array.isArray(contractRes?.data) ? contractRes.data : []);
      } else {
        setTemplates([]);
        setContracts([]);
      }
    } catch {
      setMessage({ type: 'error', text: t('employmentContractManagement.loadFailed', { defaultValue: '전자근로계약 데이터를 불러오지 못했습니다.' }) });
    } finally {
      setLoading(false);
    }
  }, [canViewCompanyContracts, canSelectCompany, selectedCompanyId, t]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);
  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    void loadUsers();
    void loadData();
  }, [loadData, loadUsers, menuFlags.menusLoading, menuFlags.canRead]);

  const userLabel = (id: number | string | null | undefined) => {
    const uid = Number(id);
    const found = users.find((u) => u.id === uid);
    if (found) return `${found.username} (${found.userid})`;
    return String(id || '-');
  };

  const buildContractPayload = () => {
    const payload: any = {
      employee_id: Number(contractForm.employee_id),
      approver_id: Number(contractForm.approver_id),
      template_id: Number(contractForm.template_id),
      title: contractForm.title.trim(),
      contract_type: contractForm.contract_type,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date,
    };
    if (contractForm.salary) payload.salary = Number(contractForm.salary);
    payload.bonus_type = contractForm.bonus_type || null;
    payload.bonus_value = contractForm.bonus_value ? Number(contractForm.bonus_value) : null;
    if (contractForm.work_location) payload.work_location = contractForm.work_location;
    payload.working_days = contractForm.working_days || null;
    if (contractForm.working_hours) payload.working_hours = contractForm.working_hours;
    if (contractForm.probation_months) payload.probation_months = Number(contractForm.probation_months);
      if (isRoot && selectedCompanyId) payload.company_id = Number(selectedCompanyId);
    return payload;
  };

  const validateWizardStep = (step: number): string | null => {
    if (step === 0) {
      if (!contractForm.template_id || !contractForm.title.trim()) {
        return t('employmentContractManagement.wizard.needTemplate');
      }
    }
    if (step === 1 && !contractForm.employee_id) {
      return t('employmentContractManagement.wizard.needEmployee');
    }
    if (step === 2) {
      if (!contractForm.approver_id) return t('employmentContractManagement.wizard.needApprover');
      if (String(contractForm.approver_id) === String(contractForm.employee_id)) {
        return t('employmentContractManagement.wizard.needApprover');
      }
    }
    if (step === 3) {
      if (!contractForm.start_date || !contractForm.end_date) {
        return t('employmentContractManagement.wizard.needBasic');
      }
    }
    return null;
  };

  const saveWizardContract = async (): Promise<number> => {
    const payload = buildContractPayload();
    if (wizardContractId) {
      const res = await employmentContractService.updateContract(wizardContractId, payload);
      if (!res?.success) throw new Error(res?.message || '계약 수정 실패');
      return wizardContractId;
    }
    const res = await employmentContractService.createContract(payload);
    if (!res?.success) throw new Error(res?.message || '계약 생성 실패');
    const id = Number(res.data?.id);
    if (!Number.isFinite(id)) throw new Error('계약 ID를 확인할 수 없습니다.');
    setWizardContractId(id);
    return id;
  };

  const loadPreview = async (contractId: number) => {
    setPreviewLoading(true);
    try {
      const res = await employmentContractService.getContract(contractId);
      if (!res?.success) throw new Error(res?.message || '미리보기 조회 실패');
      const html =
        res.data?.rendered_content_html ||
        res.data?.template?.content_html ||
        `<p>${te('employmentContractManagement.noBody', { defaultValue: 'No contract body is registered.' })}</p>`;
      setPreviewHtml(String(html));
    } catch (error: any) {
      setPreviewHtml('');
      setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.previewFailed', { defaultValue: '미리보기를 불러오지 못했습니다.' }) });
    } finally {
      setPreviewLoading(false);
    }
  };

  const openWizard = (row?: any) => {
    if (row ? !editGuard.guard() : !createGuard.guard()) return;
    if (row) {
      setWizardContractId(Number(row.id));
    setContractForm({
      template_id: String(row.template_id || ''),
        title: toEnglishContractTitle(row.title) || String(row.title || ''),
        employee_id: String(row.employee_id || ''),
        approver_id: String(row.approver_id || ''),
      contract_type: String(row.contract_type || 'regular'),
      start_date: String(row.start_date || ''),
      end_date: String(row.end_date || ''),
        salary: row.salary != null ? String(row.salary) : '',
      bonus_type: String(row.bonus_type || ''),
        bonus_value: row.bonus_value != null ? String(row.bonus_value) : '',
      work_location: String(row.work_location || ''),
      working_days: String(row.working_days || ''),
      working_hours: String(row.working_hours || ''),
        probation_months: row.probation_months != null ? String(row.probation_months) : '',
      });
    } else {
      setWizardContractId(null);
      setContractForm(emptyContractForm());
    }
    setWizardStep(0);
    setPreviewHtml('');
    setWizardOpen(true);
  };

  const handleWizardNext = async () => {
    const err = validateWizardStep(wizardStep);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    if (wizardStep === 3) {
      setWizardSaving(true);
      try {
        const id = await saveWizardContract();
        await loadPreview(id);
        setWizardStep(4);
      } catch (error: any) {
        setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.saveFailed', { defaultValue: '계약 저장 중 오류가 발생했습니다.' }) });
      } finally {
        setWizardSaving(false);
      }
      return;
    }
    if (wizardStep === 4) {
      setWizardStep(5);
      return;
    }
    setWizardStep((s) => s + 1);
  };

  const handleWizardSubmit = async () => {
    if (!wizardContractId) return;
    setWizardSaving(true);
    try {
      const res = await employmentContractService.submitForApproval(wizardContractId);
      if (!res?.success) throw new Error(res?.message || '승인 제출 실패');
      setMessage({ type: 'success', text: t('employmentContractManagement.success.submitted') });
      setWizardOpen(false);
      void loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.submitFailed', { defaultValue: '승인 제출 중 오류가 발생했습니다.' }) });
    } finally {
      setWizardSaving(false);
    }
  };

  const openDetail = async (contractId: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await employmentContractService.getContract(contractId);
      if (!res?.success) throw new Error(res?.message || '조회 실패');
      setDetailContract(res.data || null);
    } catch (error: any) {
      setDetailContract(null);
      setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.detailFailed', { defaultValue: '계약 상세를 불러오지 못했습니다.' }) });
    } finally {
      setDetailLoading(false);
    }
  };

  const submitExistingContract = (contractId: number, title: string) => {
    showConfirm(
      t('employmentContractManagement.confirmSubmit', { defaultValue: `'${title}' 계약을 승인자에게 제출하시겠습니까?`, title }),
      async () => {
        try {
          const res = await employmentContractService.submitForApproval(contractId);
          if (!res?.success) throw new Error(res?.message || '승인 제출 실패');
          setMessage({ type: 'success', text: t('employmentContractManagement.success.submitted') });
      void loadData();
    } catch (error: any) {
          setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.submitFailed', { defaultValue: '승인 제출 중 오류가 발생했습니다.' }) });
        }
      },
      { title: t('employmentContractManagement.actions.submitApproval') }
    );
  };

  const completeContract = (contractId: number, title: string) => {
    showConfirm(
      t('employmentContractManagement.confirmComplete', { defaultValue: `'${title}' 계약을 완료(활성) 처리하시겠습니까?`, title }),
      async () => {
        try {
          const res = await employmentContractService.completeContract(contractId);
          if (!res?.success) throw new Error(res?.message || '완료 처리 실패');
          setMessage({ type: 'success', text: t('employmentContractManagement.success.completed') });
      void loadData();
    } catch (error: any) {
          setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.completeFailed', { defaultValue: '완료 처리 중 오류가 발생했습니다.' }) });
        }
      },
      { title: t('employmentContractManagement.actions.complete') }
    );
  };

  const approveContract = (contractId: number, title: string) => {
    showConfirm(
      t('employmentContractManagement.confirmApprove', { defaultValue: `'{{title}}' 계약을 승인하시겠습니까?`, title }),
      async () => {
        try {
          const res = await employmentContractService.approveContract(contractId);
          if (!res?.success) throw new Error(res?.message || '승인 실패');
          setMessage({ type: 'success', text: t('employmentContractManagement.success.approved') });
          setDetailOpen(false);
          setDetailContract(null);
      void loadData();
    } catch (error: any) {
          setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.approveFailed', { defaultValue: '승인 처리 중 오류가 발생했습니다.' }) });
        }
      },
      { title: t('employmentContractManagement.actions.approve') }
    );
  };

  const openRejectDialog = (contractId: number) => {
    setRejectTargetId(contractId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const rejectContract = async () => {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      setMessage({
        type: 'error',
        text: t('employmentContractManagement.rejectReasonRequired', {
          defaultValue: '반려 시 코멘트를 입력해 주세요.',
        }),
      });
      return;
    }
    try {
      const res = await employmentContractService.rejectApproval(rejectTargetId, rejectReason.trim());
      if (!res?.success) throw new Error(res?.message || '반려 실패');
      setMessage({ type: 'success', text: t('employmentContractManagement.success.rejected') });
      setRejectDialogOpen(false);
      setDetailOpen(false);
      setDetailContract(null);
      void loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.rejectFailed', { defaultValue: '반려 처리 중 오류가 발생했습니다.' }) });
    }
  };

  const openSignDialog = (contractId: number) => {
    setSignContractId(contractId);
    setAadhaarSession(null);
    setSignForm({
      sign_method: 'aadhaar_esign',
      aadhaar_consent: false,
      aadhaar_last4: '',
      mock_otp: '',
    });
    setSignDialogOpen(true);
  };

  const downloadContractPdf = async (contractId: number, title?: string) => {
    try {
      const res = await employmentContractService.downloadContractPdf(contractId);
      const blob =
        res.data instanceof Blob
          ? res.data.type === 'application/pdf'
            ? res.data
            : new Blob([res.data], { type: 'application/pdf' })
          : new Blob([res.data], { type: 'application/pdf' });
      if (blob.type && blob.type.includes('json')) {
        const text = await blob.text();
        let msg = t('employmentContractManagement.pdfSaveFailed', { defaultValue: 'PDF 저장에 실패했습니다.' });
        try {
          const parsed = JSON.parse(text);
          if (parsed?.message) msg = String(parsed.message);
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = String(title || `contract-${contractId}`).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      a.href = url;
      a.download = `EmploymentContract-${contractId}-${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({
        type: 'success',
        text: t('employmentContractManagement.pdfSaved', { defaultValue: 'PDF 파일로 저장했습니다.' }),
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error?.message || t('employmentContractManagement.pdfSaveFailed', { defaultValue: 'PDF 저장에 실패했습니다.' }),
      });
    }
  };

  const signContract = async () => {
    if (!signContractId) return;
    try {
      if (signForm.sign_method === 'aadhaar_esign') {
        if (!aadhaarSession) {
          setAadhaarBusy(true);
          const init = await employmentContractService.initiateAadhaarEsign(signContractId, {
            signer_type: 'employee',
              aadhaar_consent: signForm.aadhaar_consent,
              aadhaar_last4: signForm.aadhaar_last4.trim(),
            return_url: `${window.location.origin}/hr/employment-contracts`,
          });
          if (!init?.success) throw new Error(init?.message || 'Aadhaar 인증 시작 실패');
          const data = init.data || {};
          setAadhaarSession({
            session_token: String(data.session_token || ''),
            asp_txn_id: data.asp_txn_id ? String(data.asp_txn_id) : undefined,
            mode: String(data.mode || 'mock'),
            requires_mock_otp: Boolean(data.requires_mock_otp),
            redirect_url: data.redirect_url || null,
          });
          if (data.redirect_url) {
            window.open(String(data.redirect_url), '_blank', 'noopener,noreferrer');
          }
          setMessage({
            type: 'success',
            text: t('employmentContractManagement.aadhaarInitiated', {
              defaultValue: data.requires_mock_otp
                ? 'Aadhaar 세션이 시작되었습니다. Mock OTP(6자리)를 입력한 뒤 완료하세요.'
                : 'ASP 인증 페이지로 이동했습니다. 인증 후 완료를 눌러 주세요.',
            }),
          });
          return;
        }

        setAadhaarBusy(true);
        const done = await employmentContractService.completeAadhaarEsign({
          session_token: aadhaarSession.session_token,
          mock_otp: aadhaarSession.requires_mock_otp ? signForm.mock_otp.trim() : undefined,
        });
        if (!done?.success) throw new Error(done?.message || 'Aadhaar 서명 완료 실패');
        setMessage({
          type: 'success',
          text: t('employmentContractManagement.aadhaarSignSuccess', {
            defaultValue: 'Aadhaar eSign 서명이 완료되었습니다.',
          }),
        });
        setSignDialogOpen(false);
        setAadhaarSession(null);
        void loadData();
        return;
      }

      const res = await employmentContractService.signContract(signContractId, 'employee', 'internal_ack');
      if (!res?.success) throw new Error(res?.message || '서명 실패');
      setMessage({ type: 'success', text: t('employmentContractManagement.success.signed') });
      setSignDialogOpen(false);
      void loadData();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text:
          error?.response?.data?.message ||
          error?.message ||
          t('employmentContractManagement.signFailed', { defaultValue: '서명 처리 중 오류가 발생했습니다.' }),
      });
    } finally {
      setAadhaarBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (editTemplate ? !editGuard.guard() : !createGuard.guard()) return;
    try {
      const payload: any = { ...templateForm, language: 'en' };
      if (isRoot && selectedCompanyId) payload.company_id = Number(selectedCompanyId);
      if (editTemplate) {
        const res = await employmentContractService.updateTemplate(Number(editTemplate.id), payload);
        if (!res?.success) throw new Error(res?.message || '템플릿 수정 실패');
      } else {
        const res = await employmentContractService.createTemplate(payload);
        if (!res?.success) throw new Error(res?.message || '템플릿 생성 실패');
      }
      setTemplateDialogOpen(false);
      setMessage({
        type: 'success',
        text: editTemplate
          ? t('employmentContractManagement.templateUpdated', { defaultValue: '템플릿이 수정되었습니다.' })
          : t('employmentContractManagement.templateCreated', { defaultValue: '템플릿이 생성되었습니다.' }),
      });
      void loadData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.templateSaveFailed', { defaultValue: '템플릿 저장 중 오류가 발생했습니다.' }) });
    }
  };

  const deleteTemplate = (templateId: number, templateName: string) => {
    if (!canDelete) return;
    showConfirm(
      t('employmentContractManagement.confirmDeleteTemplate', { defaultValue: `'${templateName}' 템플릿을 삭제하시겠습니까?`, name: templateName }),
      async () => {
        try {
          const res = await employmentContractService.deleteTemplate(templateId);
          if (!res?.success) throw new Error(res?.message || '템플릿 삭제 실패');
          setSelectedTemplateIds((prev) => prev.filter((id) => id !== templateId));
          setMessage({ type: 'success', text: t('employmentContractManagement.templateDeleted', { defaultValue: '템플릿이 삭제되었습니다.' }) });
          void loadData();
        } catch (error: any) {
          setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.templateDeleteFailed', { defaultValue: '템플릿 삭제 중 오류가 발생했습니다.' }) });
        }
      },
      { title: t('employmentContractManagement.deleteTemplate', { defaultValue: '템플릿 삭제' }), confirmColor: 'error' }
    );
  };

  const deleteSelectedTemplates = () => {
    if (!canDelete || selectedTemplateIds.length === 0) return;
    showConfirm(
      t('employmentContractManagement.confirmDeleteSelectedBulk', { count: selectedTemplateIds.length }),
      async () => {
        try {
          const results = await Promise.all(selectedTemplateIds.map((id) => employmentContractService.deleteTemplate(id)));
          const failed = results.find((res) => !res?.success);
          if (failed) throw new Error(failed?.message || '템플릿 삭제 실패');
          setSelectedTemplateIds([]);
          setMessage({ type: 'success', text: t('employmentContractManagement.deleteSelectedSuccess', { count: selectedTemplateIds.length }) });
          void loadData();
        } catch (error: any) {
          setMessage({ type: 'error', text: error?.message || t('employmentContractManagement.templateDeleteFailed', { defaultValue: '템플릿 삭제 중 오류가 발생했습니다.' }) });
        }
      },
      { title: t('employmentContractManagement.deleteTemplate', { defaultValue: '템플릿 삭제' }), confirmColor: 'error' }
    );
  };

  const statusChip = useCallback(
    (status: string) => {
      const s = String(status || 'draft').toLowerCase();
      const colorType =
        s === 'signed' || s === 'active'
          ? 'success'
          : s === 'rejected'
              ? 'error'
            : s.includes('awaiting') || s === 'pending_approval'
              ? 'warning'
              : 'default';
      const main =
        colorType === 'success'
          ? theme.palette.success.main
          : colorType === 'warning'
            ? theme.palette.warning.main
            : colorType === 'error'
              ? theme.palette.error.main
              : theme.palette.grey[500];
      const fg =
        colorType === 'success'
          ? theme.palette.success.dark
          : colorType === 'warning'
            ? theme.palette.warning.dark
            : colorType === 'error'
              ? theme.palette.error.dark
              : theme.palette.text.secondary;
      return (
        <Chip
          size="small"
          label={contractStatusLabel(status)}
          variant="outlined"
          sx={{ height: 26, fontWeight: 600, fontSize: '0.75rem', borderColor: alpha(main, 0.35), bgcolor: alpha(main, 0.1), color: fg }}
        />
      );
    },
    [theme, contractStatusLabel]
  );

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
  } as const;

  const tableBaseSx = {
    tableLayout: 'fixed' as const,
    width: '100%',
    minWidth: 720,
    borderCollapse: 'collapse' as const,
    bgcolor: 'transparent',
    '& .MuiTableCell-root': { borderLeft: 'none', borderRight: 'none', borderTop: 'none' },
    '& .MuiTableCell-head.action-cell, & .MuiTableCell-body.action-cell': { overflow: 'visible', textAlign: 'center', px: 1 },
  };

  const actionTableContainerSx = {
    ...mvsBodyListTableSx,
    ...mvsTableScrollSx,
    '& .MuiTableCell-head.action-cell, & .MuiTableCell-body.action-cell': { overflow: 'visible', textAlign: 'center', px: 1 },
  } as const;

  const ACTION_COL = 200;

  const renderHeadCell = (label: string, width?: number | string, opts?: { action?: boolean }) => (
    <TableCell
      className={opts?.action ? 'action-cell' : undefined}
      align={opts?.action ? 'center' : 'left'}
        sx={{
        overflow: opts?.action ? 'visible' : 'hidden',
        verticalAlign: 'middle',
        ...(width != null ? { width, minWidth: width, maxWidth: width, boxSizing: 'border-box' } : {}),
      }}
    >
      {opts?.action ? label : (
        <Box component="span" sx={thLabelEllipsisSx} title={label}>
          {label}
          </Box>
        )}
    </TableCell>
  );

  const iconBtnSx = {
    borderRadius: '10px',
    color: theme.palette.text.secondary,
    '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1) },
  };

  const renderActionIcon = (label: string, icon: React.ReactNode, onClick: () => void, hoverColor: 'primary' | 'error' = 'primary') => (
    <Tooltip key={label} title={label}>
      <span style={{ display: 'inline-flex' }}>
        <IconButton
          size="small"
          aria-label={label}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
            sx={{
            ...iconBtnSx,
            '&:hover':
              hoverColor === 'error'
                ? { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.12) }
                : { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1) },
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );

  const deleteContract = (contractId: number, title: string) => {
    if (!canManage || !deleteGuard.guard()) return;
    const displayTitle = toEnglishContractTitle(title) || title;
    showConfirm(
      t('employmentContractManagement.confirmDeleteContract', {
        defaultValue: `Delete draft contract "{{title}}"?`,
        title: displayTitle,
      }),
      async () => {
        try {
          const res = await employmentContractService.deleteContract(contractId);
          if (!res?.success) throw new Error(res?.message || 'Delete failed');
          setMessage({
            type: 'success',
            text: t('employmentContractManagement.success.deleted', {
              defaultValue: 'Contract deleted.',
            }),
          });
          void loadData();
        } catch (error: any) {
          setMessage({
            type: 'error',
            text:
              error?.message ||
              t('employmentContractManagement.deleteFailed', {
                defaultValue: 'Failed to delete contract.',
              }),
          });
        }
      },
      {
        title: t('employmentContractManagement.deleteContract', { defaultValue: 'Delete contract' }),
        confirmColor: 'error',
        confirmText: t('common.delete', { defaultValue: '삭제' }),
        cancelText: t('common.cancel', { defaultValue: '취소' }),
      }
    );
  };

  const renderContractActions = (row: any) => {
    const status = String(row?.status || '').toLowerCase();
    const id = Number(row.id);
    const title = String(row.title || '');
    const icons: React.ReactNode[] = [
      renderActionIcon(t('employmentContractManagement.view', { defaultValue: '보기' }), <VisibilityIcon fontSize="small" />, () => void openDetail(id)),
    ];
    if (canManage && ['draft', 'rejected'].includes(status)) {
      icons.push(renderActionIcon(t('employmentContractManagement.edit', { defaultValue: '수정' }), <EditIcon fontSize="small" />, () => openWizard(row)));
      icons.push(
        renderActionIcon(t('employmentContractManagement.actions.submitApproval'), <SendIcon fontSize="small" />, () => submitExistingContract(id, title))
      );
      icons.push(
        renderActionIcon(
          t('employmentContractManagement.deleteContract', { defaultValue: '삭제' }),
          <DeleteIcon fontSize="small" />,
          () => deleteContract(id, title),
          'error'
        )
      );
    }
    if (canManage && status === 'signed') {
      icons.push(
        renderActionIcon(t('employmentContractManagement.actions.complete'), <CheckCircleOutlineIcon fontSize="small" />, () => completeContract(id, title))
      );
    }
    return (
      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'nowrap' }}>
        {icons}
                    </Box>
    );
  };

  const renderEmptyState = (opts: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) => (
    <Box sx={listStateBoxSx}>
      {opts.icon}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {opts.title}
                </Typography>
      {opts.hint ? (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {opts.hint}
                          </Typography>
      ) : null}
      {opts.action}
                    </Box>
  );

  const renderPagination = (count: number, page: number, onChange: (v: number) => void) => (
    <Box sx={mvsBodyPaginationSx}>
      <Pagination count={count} page={page} onChange={(_, v) => onChange(v)} color="primary" shape="rounded" />
              </Box>
  );

  const selectedEmployee = users.find((u) => String(u.id) === contractForm.employee_id) || null;
  const selectedApprover = users.filter((u) => String(u.id) !== contractForm.employee_id).find((u) => String(u.id) === contractForm.approver_id) || null;
  const approverOptions = users.filter((u) => String(u.id) !== contractForm.employee_id);

  const renderWizardStepContent = () => {
    if (wizardStep === 0) {
      return (
        <Stack spacing={2}>
            <FormControl fullWidth>
            <InputLabel>{t('employmentContractManagement.template', { defaultValue: '템플릿' })}</InputLabel>
              <Select
                value={contractForm.template_id}
              label={t('employmentContractManagement.template', { defaultValue: '템플릿' })}
                onChange={(e) => {
                const tpl = templates.find((t) => String(t.id) === String(e.target.value));
                const enTitle = toEnglishContractTitle(tpl?.name) || String(tpl?.name || '');
                  setContractForm((prev) => ({
                    ...prev,
                  template_id: String(e.target.value),
                  contract_type: String(tpl?.contract_type || prev.contract_type || 'regular'),
                  title: enTitle || prev.title,
                  }));
                }}
              >
                {templates.map((tpl) => (
                <MenuItem key={tpl.id} value={String(tpl.id)}>
                  {templateDisplayName(tpl)}
                </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
            label={t('employmentContractManagement.contractTitle', { defaultValue: '계약 제목' })}
              value={contractForm.title}
              onChange={(e) => setContractForm((prev) => ({ ...prev, title: e.target.value }))}
            helperText={t('employmentContractManagement.titleEnglishOnly', {
              defaultValue: '전자계약서 제목은 영문으로 입력하세요.',
            })}
          />
        </Stack>
      );
    }
    if (wizardStep === 1) {
      return (
        <Autocomplete
          options={users}
          getOptionLabel={(opt) => `${opt.username} (${opt.userid})`}
          value={selectedEmployee}
          onChange={(_, val) =>
            setContractForm((prev) => ({
              ...prev,
              employee_id: val ? String(val.id) : '',
              approver_id: val && String(prev.approver_id) === String(val.id) ? '' : prev.approver_id,
            }))
          }
          renderInput={(params) => <TextField {...params} label={t('employmentContractManagement.employee', { defaultValue: '근로자' })} />}
        />
      );
    }
    if (wizardStep === 2) {
      return (
        <Stack spacing={1}>
          <Autocomplete
            options={approverOptions}
            getOptionLabel={(opt) => `${opt.username} (${opt.userid})`}
            value={selectedApprover}
            onChange={(_, val) => setContractForm((prev) => ({ ...prev, approver_id: val ? String(val.id) : '' }))}
            renderInput={(params) => <TextField {...params} label={t('employmentContractManagement.approver', { defaultValue: '승인자' })} />}
          />
          <Typography variant="caption" color="text.secondary">
            {t('employmentContractManagement.approverHint', { defaultValue: '승인자는 근로자와 동일할 수 없습니다.' })}
          </Typography>
        </Stack>
      );
    }
    if (wizardStep === 3) {
      return (
        <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                type="date"
              label={t('employmentContractManagement.startDate', { defaultValue: '시작일' })}
                value={contractForm.start_date}
                onChange={(e) => setContractForm((prev) => ({ ...prev, start_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
              <TextField
                type="date"
              label={t('employmentContractManagement.endDate', { defaultValue: '종료일' })}
                value={contractForm.end_date}
                onChange={(e) => setContractForm((prev) => ({ ...prev, end_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
              label={t('employmentContractManagement.salary', { defaultValue: '연봉/급여' })}
                type="number"
                value={contractForm.salary}
                onChange={(e) => setContractForm((prev) => ({ ...prev, salary: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <TextField
              label={t('employmentContractManagement.probation', { defaultValue: '수습(개월)' })}
                type="number"
                value={contractForm.probation_months}
                onChange={(e) => setContractForm((prev) => ({ ...prev, probation_months: e.target.value }))}
                sx={{ flex: 1 }}
              />
            </Stack>
          {isSalaryTemplate && (
              <Stack direction="row" spacing={2}>
                <FormControl sx={{ flex: 1 }}>
                <InputLabel>{t('employmentContractManagement.bonusType', { defaultValue: '보너스 방식' })}</InputLabel>
                  <Select
                    value={contractForm.bonus_type}
                  label={t('employmentContractManagement.bonusType', { defaultValue: '보너스 방식' })}
                    onChange={(e) => setContractForm((prev) => ({ ...prev, bonus_type: String(e.target.value) }))}
                  >
                  <MenuItem value="percent">{t('employmentContractManagement.bonusPercent', { defaultValue: '연 %' })}</MenuItem>
                  <MenuItem value="fixed">{t('employmentContractManagement.bonusFixed', { defaultValue: '금액' })}</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label={
                    contractForm.bonus_type === 'percent'
                    ? t('employmentContractManagement.bonusRate', { defaultValue: '보너스 비율(%)' })
                    : t('employmentContractManagement.bonusAmount', { defaultValue: '보너스 금액' })
                  }
                  type="number"
                  value={contractForm.bonus_value}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, bonus_value: e.target.value }))}
                  sx={{ flex: 1 }}
                  disabled={!contractForm.bonus_type}
                />
              </Stack>
            )}
            <TextField
            label={t('employmentContractManagement.workLocation', { defaultValue: '근무지' })}
              value={contractForm.work_location}
              onChange={(e) => setContractForm((prev) => ({ ...prev, work_location: e.target.value }))}
            />
            <Autocomplete
              freeSolo
              options={workingDayOptions}
              value={contractForm.working_days || ''}
            onChange={(_, v) => setContractForm((prev) => ({ ...prev, working_days: String(v || '') }))}
            onInputChange={(_, v) => setContractForm((prev) => ({ ...prev, working_days: v }))}
            renderInput={(params) => <TextField {...params} label={t('employmentContractManagement.workingDays', { defaultValue: '근무일' })} />}
            />
            <Autocomplete
              freeSolo
              options={workingHourOptions}
              value={contractForm.working_hours || ''}
            onChange={(_, v) => setContractForm((prev) => ({ ...prev, working_hours: String(v || '') }))}
            onInputChange={(_, v) => setContractForm((prev) => ({ ...prev, working_hours: v }))}
            renderInput={(params) => <TextField {...params} label={t('employmentContractManagement.workingHours', { defaultValue: '근무시간' })} />}
          />
        </Stack>
      );
    }
    if (wizardStep === 4) {
      return (
        <Stack spacing={2}>
          {previewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {t('employmentContractManagement.wizard.previewHint')}
              </Typography>
              <Box
                sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', maxHeight: 360, overflowY: 'auto', bgcolor: '#FFFFFF' }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </>
          )}
        </Stack>
      );
    }
    return (
      <Stack spacing={2}>
        <Typography variant="body1">
          {t('employmentContractManagement.submitReady', { defaultValue: '승인자에게 계약을 제출합니다. 제출 후 수정하려면 반려를 기다려야 합니다.' })}
        </Typography>
        <Box sx={{ p: 1.5, border: '1px solid #B4B4B4', bgcolor: '#FAFAFA' }}>
          <Typography variant="body2"><strong>{t('employmentContractManagement.contractTitle', { defaultValue: '계약 제목' })}:</strong> {contractForm.title}</Typography>
          <Typography variant="body2"><strong>{t('employmentContractManagement.employee', { defaultValue: '근로자' })}:</strong> {userLabel(contractForm.employee_id)}</Typography>
          <Typography variant="body2"><strong>{t('employmentContractManagement.approver', { defaultValue: '승인자' })}:</strong> {userLabel(contractForm.approver_id)}</Typography>
          <Typography variant="body2"><strong>{t('employmentContractManagement.period', { defaultValue: '기간' })}:</strong> {contractForm.start_date} ~ {contractForm.end_date}</Typography>
        </Box>
      </Stack>
    );
  };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('employmentContractManagement.pageTitle')}
        description={t('employmentContractManagement.description')}
        actions={
          canSelectCompany ? (
            <Autocomplete
              options={companies}
              value={
                typeof selectedCompanyId === 'number'
                  ? companies.find((c) => c.id === selectedCompanyId) ?? null
                  : null
              }
              onChange={(_, next) => {
                setSelectedCompanyId(next?.id && next.id > 0 ? next.id : '');
              }}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disableClearable={Boolean(
                typeof selectedCompanyId === 'number' &&
                  companies.some((c) => c.id === selectedCompanyId)
              )}
              slotProps={companySelectListboxSlotProps}
              sx={{
                minWidth: 220,
                maxWidth: 320,
                ...mvsSearchFieldSx,
                ...mvsFilterFieldHeightSx,
                ...companySelectNowrapSx,
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={t('employmentContractManagement.company')}
                  placeholder={t('employmentContractManagement.searchCompany', {
                    defaultValue: '회사명 검색',
                  })}
                  {...mvsOutlinedLabelProps}
                  sx={companySelectNowrapSx}
                />
              )}
            />
          ) : null
        }
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: kpiItems.length >= 3 ? 'repeat(3, 1fr)' : kpiItems.length === 2 ? 'repeat(2, 1fr)' : '1fr' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {kpiItems.map((item) => (
          <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {item.label}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, color: 'text.primary' }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: { xs: 2, sm: 2.5 }, py: 1, bgcolor: '#FFFFFF' }}>
          <Tabs
            value={tab}
            onChange={(_, next) => setTab(next)}
            sx={{
              minHeight: 40,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem', minHeight: 40, py: 0.75, color: 'text.secondary' },
              '& .Mui-selected': { color: 'primary.main', fontWeight: 700 },
              '& .MuiTabs-indicator': { height: 3 },
            }}
          >
            <Tab value="my" label={t('employmentContractManagement.tabs.my')} />
            <Tab value="approvals" label={t('employmentContractManagement.tabs.approvals')} />
            {canViewCompanyContracts ? <Tab value="contracts" label={t('employmentContractManagement.tabs.contracts')} /> : null}
            {canViewCompanyContracts ? <Tab value="templates" label={t('employmentContractManagement.tabs.templates')} /> : null}
          </Tabs>
          {tab === 'contracts' && canManage ? (
            <Tooltip title={createGuard.tooltipTitle} disableHoverListener={!createGuard.tooltipTitle}>
              <span>
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={() => openWizard()}
                  disabled={createGuard.disabled}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {t('employmentContractManagement.createContract')}
                </Button>
              </span>
            </Tooltip>
          ) : null}
          {tab === 'templates' && canManage ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {canDelete && selectedTemplateIds.length > 0 ? (
                <Button variant="contained" color="error" disableElevation size="small" startIcon={<DeleteIcon fontSize="small" />} onClick={deleteSelectedTemplates}>
                  {t('employmentContractManagement.deleteSelected')} ({selectedTemplateIds.length})
                </Button>
              ) : null}
              <Button
                variant="contained"
                disableElevation
                size="small"
                startIcon={<AddIcon fontSize="small" />}
                onClick={() => {
                  setEditTemplate(null);
                  setTemplateForm({ name: '', contract_type: 'regular', language: 'en', content_html: '' });
                  setTemplateDialogOpen(true);
                }}
                sx={mvsBodyPrimaryBtnSx}
              >
                {t('employmentContractManagement.createTemplate')}
              </Button>
            </Box>
          ) : null}
        </Box>

        {tab === 'my' || tab === 'contracts' || tab === 'approvals' || tab === 'templates' ? (
          <Box
            sx={{
              px: { xs: 2, sm: 2.5 },
              py: 2,
              bgcolor: '#FFFFFF',
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: tab === 'my' ? '1fr minmax(220px, 320px)' : 'minmax(220px, 360px)',
              },
              gap: 2,
              alignItems: 'center',
              justifyContent: tab === 'my' ? 'stretch' : 'end',
            }}
          >
            {tab === 'my' ? (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(['all', 'in_progress', 'completed'] as MyContractFilterMode[]).map((mode) => (
                  <Button
                    key={mode}
                    size="small"
                    variant={myContractFilter === mode ? 'contained' : 'outlined'}
                    onClick={() => setMyContractFilter(mode)}
                    sx={myContractFilter === mode ? mvsBodyPrimaryBtnSx : mvsBodyOutlinedBtnSx}
                  >
                    {mode === 'all'
                      ? t('employmentContractManagement.filterAll')
                      : mode === 'in_progress'
                        ? t('employmentContractManagement.filterInProgress')
                        : t('employmentContractManagement.filterCompleted')}
                  </Button>
                ))}
              </Box>
            ) : null}
            <TextField
              size="small"
              fullWidth
              label={t('employmentContractManagement.search', { defaultValue: '검색' })}
              placeholder={t('employmentContractManagement.searchPlaceholder', {
                defaultValue: '제목, 이름, ID, 상태 검색',
              })}
              {...CONTRACT_FILTER_OUTLINED}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={contractFilterFieldSx}
            />
          </Box>
        ) : null}
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          renderEmptyState({ icon: <CircularProgress size={36} />, title: t('employmentContractManagement.empty.loading') })
        ) : tab === 'contracts' ? (
          contracts.length === 0 ? (
            renderEmptyState({
              icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
              title: t('employmentContractManagement.empty.noContracts'),
              hint: t('employmentContractManagement.empty.noContractsHint'),
              action: canManage ? (
                <Button variant="contained" disableElevation size="small" startIcon={<AddIcon fontSize="small" />} onClick={() => openWizard()} sx={mvsBodyPrimaryBtnSx}>
                  {t('employmentContractManagement.createContract')}
                </Button>
              ) : undefined,
            })
          ) : visibleContracts.length === 0 ? (
            renderEmptyState({
              icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
              title: t('employmentContractManagement.empty.noSearchResults', { defaultValue: '검색 결과가 없습니다.' }),
              hint: t('employmentContractManagement.empty.noSearchResultsHint', {
                defaultValue: '다른 검색어를 입력해 보세요.',
              }),
            })
          ) : (
            <>
              <TableContainer sx={actionTableContainerSx}>
                <Table size="small" sx={tableBaseSx}>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      {renderHeadCell('ID', 56)}
                      {renderHeadCell(t('employmentContractManagement.contractTitle', { defaultValue: '제목' }))}
                      {renderHeadCell(t('employmentContractManagement.employee', { defaultValue: '근로자' }), '16%')}
                      {renderHeadCell(t('employmentContractManagement.approver', { defaultValue: '승인자' }), '16%')}
                      {renderHeadCell(t('employmentContractManagement.period', { defaultValue: '기간' }), '18%')}
                      {renderHeadCell(t('employmentContractManagement.statusLabel'), 120)}
                      {renderHeadCell(t('employmentContractManagement.actionsLabel', { defaultValue: '작업' }), ACTION_COL, { action: true })}
                    </TableRow>
                  </TableHead>
                  <TableBody sx={contractTableBodyRowSx}>
                    {paginatedContracts.map((row) => (
                      <TableRow key={row.id} onClick={() => void openDetail(Number(row.id))} sx={{ cursor: 'pointer' }}>
                        <TableCell sx={cellEllipsisSx}>{row.id}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{toEnglishContractTitle(row.title) || row.title}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.employee?.username || userLabel(row.employee_id)}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.approver?.username || userLabel(row.approver_id)}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.start_date} ~ {row.end_date}</TableCell>
                        <TableCell>{statusChip(String(row.status || 'draft'))}</TableCell>
                        <TableCell align="center" className="action-cell" onClick={(e) => e.stopPropagation()}>
                          {renderContractActions(row)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {renderPagination(contractsTotalPages, contractsPage, setContractsPage)}
            </>
          )
        ) : tab === 'approvals' ? (
          pendingApprovals.length === 0 ? (
            renderEmptyState({
              icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
              title: t('employmentContractManagement.empty.noApprovals', { defaultValue: '승인 대기 계약이 없습니다.' }),
              hint: t('employmentContractManagement.empty.noApprovalsHint', {
                defaultValue: '행을 클릭하면 계약서 전체를 보고 승인·반려할 수 있습니다.',
              }),
            })
          ) : visibleApprovals.length === 0 ? (
            renderEmptyState({
              icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
              title: t('employmentContractManagement.empty.noSearchResults', { defaultValue: '검색 결과가 없습니다.' }),
              hint: t('employmentContractManagement.empty.noSearchResultsHint', {
                defaultValue: '다른 검색어를 입력해 보세요.',
              }),
            })
          ) : (
            <>
              <TableContainer sx={actionTableContainerSx}>
                <Table size="small" sx={tableBaseSx}>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      {renderHeadCell('ID', 56)}
                      {renderHeadCell(t('employmentContractManagement.contractTitle', { defaultValue: '제목' }))}
                      {renderHeadCell(t('employmentContractManagement.employee', { defaultValue: '근로자' }), '18%')}
                      {renderHeadCell(t('employmentContractManagement.period', { defaultValue: '기간' }), '20%')}
                      {renderHeadCell(t('employmentContractManagement.statusLabel'), 120)}
                    </TableRow>
                  </TableHead>
                  <TableBody sx={contractTableBodyRowSx}>
                    {paginatedApprovals.map((row) => (
                      <TableRow
                        key={row.id}
                        onClick={() => void openDetail(Number(row.id))}
                        sx={{ cursor: 'pointer' }}
                        hover
                      >
                        <TableCell sx={cellEllipsisSx}>{row.id}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{toEnglishContractTitle(row.title) || row.title}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.employee?.username || userLabel(row.employee_id)}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.start_date} ~ {row.end_date}</TableCell>
                        <TableCell>{statusChip(String(row.status || 'pending_approval'))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {renderPagination(approvalsTotalPages, approvalsPage, setApprovalsPage)}
            </>
          )
        ) : tab === 'templates' ? (
          templates.length === 0 ? (
            renderEmptyState({
              icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
              title: t('employmentContractManagement.empty.noTemplates'),
              hint: t('employmentContractManagement.empty.noTemplatesHint'),
            })
          ) : visibleTemplates.length === 0 ? (
            renderEmptyState({
              icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
              title: t('employmentContractManagement.empty.noSearchResults', { defaultValue: '검색 결과가 없습니다.' }),
              hint: t('employmentContractManagement.empty.noSearchResultsHint', {
                defaultValue: '다른 검색어를 입력해 보세요.',
              }),
            })
          ) : (
            <>
              <TableContainer sx={actionTableContainerSx}>
                <Table size="small" sx={tableBaseSx}>
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      {canDelete ? (
                        <TableCell padding="checkbox" align="center">
                          <Checkbox
                            size="small"
                            disabled={paginatedTemplates.length === 0}
                            indeterminate={someVisibleTemplatesSelected && !allVisibleTemplatesSelected}
                            checked={allVisibleTemplatesSelected}
                            onChange={(e) => setSelectedTemplateIds(e.target.checked ? visibleTemplateIds : [])}
                          />
                        </TableCell>
                      ) : null}
                      {renderHeadCell('ID', 56)}
                      {renderHeadCell(t('employmentContractManagement.templateName', { defaultValue: '템플릿명' }))}
                      {renderHeadCell(t('employmentContractManagement.type', { defaultValue: '유형' }), '18%')}
                      {renderHeadCell(t('employmentContractManagement.language', { defaultValue: '언어' }), 96)}
                      {renderHeadCell(t('employmentContractManagement.version', { defaultValue: '버전' }), 80)}
                      {canDelete ? renderHeadCell(t('employmentContractManagement.actionsLabel', { defaultValue: '작업' }), 72, { action: true }) : null}
                    </TableRow>
                  </TableHead>
                  <TableBody sx={contractTableBodyRowSx}>
                    {paginatedTemplates.map((row) => (
                      <TableRow
                        key={row.id}
                        onClick={() => {
                          setEditTemplate(row);
                          setTemplateForm({
                            name: String(row.name || ''),
                            contract_type: String(row.contract_type || 'regular'),
                            language: 'en',
                            content_html: String(row.content_html || ''),
                          });
                          setTemplateDialogOpen(true);
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        {canDelete ? (
                          <TableCell padding="checkbox" align="center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              size="small"
                              checked={selectedTemplateIds.includes(Number(row.id))}
                              onChange={() =>
                                setSelectedTemplateIds((prev) =>
                                  prev.includes(Number(row.id)) ? prev.filter((id) => id !== Number(row.id)) : [...prev, Number(row.id)]
                                )
                              }
                            />
                          </TableCell>
                        ) : null}
                        <TableCell sx={cellEllipsisSx}>{row.id}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.name}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.contract_type}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.language}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.version}</TableCell>
                        {canDelete ? (
                          <TableCell align="center" className="action-cell" onClick={(e) => e.stopPropagation()}>
                            {renderActionIcon(t('employmentContractManagement.delete', { defaultValue: '삭제' }), <DeleteIcon fontSize="small" />, () => deleteTemplate(Number(row.id), String(row.name || '')), 'error')}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {renderPagination(templatesTotalPages, templatesPage, setTemplatesPage)}
            </>
          )
        ) : myContracts.length === 0 ? (
          renderEmptyState({
            icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
            title: myContractFilter === 'completed' ? t('employmentContractManagement.empty.noCompletedContracts') : t('employmentContractManagement.empty.noMyContracts'),
            hint: t('employmentContractManagement.empty.noMyContractsHint'),
          })
        ) : visibleMyContracts.length === 0 ? (
          renderEmptyState({
            icon: <DescriptionIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />,
            title: t('employmentContractManagement.empty.noSearchResults', { defaultValue: '검색 결과가 없습니다.' }),
            hint: t('employmentContractManagement.empty.noSearchResultsHint', {
              defaultValue: '다른 검색어를 입력해 보세요.',
            }),
          })
        ) : (
          <>
            <TableContainer sx={actionTableContainerSx}>
              <Table size="small" sx={tableBaseSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    {renderHeadCell('ID', 56)}
                    {renderHeadCell(t('employmentContractManagement.contractTitle', { defaultValue: '제목' }))}
                    {renderHeadCell(t('employmentContractManagement.period', { defaultValue: '기간' }), '22%')}
                    {renderHeadCell(t('employmentContractManagement.statusLabel'), 140)}
                    {renderHeadCell(t('employmentContractManagement.actionsLabel', { defaultValue: '작업' }), ACTION_COL, { action: true })}
                  </TableRow>
                </TableHead>
                <TableBody sx={contractTableBodyRowSx}>
                  {paginatedMyContracts.map((row) => {
                    const status = String(row.status || '').toLowerCase();
                    const canSign = status === 'awaiting_employee_sign' && Number(row.employee_id) === Number(user?.id);
                    const canDownloadPdf = ['signed', 'active', 'expired'].includes(status);
                    return (
                      <TableRow key={row.id} onClick={() => void openDetail(Number(row.id))} sx={{ cursor: 'pointer' }}>
                        <TableCell sx={cellEllipsisSx}>{row.id}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{toEnglishContractTitle(row.title) || row.title}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{row.start_date} ~ {row.end_date}</TableCell>
                        <TableCell>{statusChip(status)}</TableCell>
                        <TableCell align="center" className="action-cell" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                            {canSign ? (
                              <Button size="small" variant="outlined" startIcon={<DrawIcon fontSize="small" />} onClick={() => openSignDialog(Number(row.id))} sx={mvsBodyOutlinedBtnSx}>
                                {t('employmentContractManagement.actions.sign')}
                              </Button>
                            ) : (
                              <Button size="small" variant="outlined" startIcon={<VisibilityIcon fontSize="small" />} onClick={() => void openDetail(Number(row.id))} sx={mvsBodyOutlinedBtnSx}>
                                {t('employmentContractManagement.view', { defaultValue: '보기' })}
                              </Button>
                            )}
                            {canDownloadPdf ? (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<PictureAsPdfIcon fontSize="small" />}
                                onClick={() =>
                                  void downloadContractPdf(
                                    Number(row.id),
                                    toEnglishContractTitle(row.title) || String(row.title || '')
                                  )
                                }
                                sx={mvsBodyOutlinedBtnSx}
                              >
                                {t('employmentContractManagement.savePdf', { defaultValue: 'PDF 저장' })}
                              </Button>
                            ) : null}
          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {renderPagination(myContractsTotalPages, myContractsPage, setMyContractsPage)}
          </>
        )}
      </Box>

      {/* Wizard */}
      <Dialog open={wizardOpen} onClose={() => setWizardOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{t('employmentContractManagement.wizard.title')}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={wizardStep} alternativeLabel sx={{ mb: 3, mt: 1 }}>
            {WIZARD_STEP_KEYS.map((step) => (
              <Step key={step}>
                <StepLabel>{t(`employmentContractManagement.wizard.${step}`)}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {renderWizardStepContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWizardOpen(false)}>{t('employmentContractManagement.cancel', { defaultValue: '취소' })}</Button>
          {wizardStep > 0 && wizardStep < 5 ? (
            <Button onClick={() => setWizardStep((s) => s - 1)} disabled={wizardSaving}>
              {t('employmentContractManagement.wizard.back')}
          </Button>
          ) : null}
          {wizardStep < 5 ? (
            <Button variant="contained" onClick={() => void handleWizardNext()} disabled={wizardSaving}>
              {wizardSaving ? <CircularProgress size={20} /> : t('employmentContractManagement.wizard.next')}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => void handleWizardSubmit()} disabled={wizardSaving}>
              {wizardSaving ? <CircularProgress size={20} /> : t('employmentContractManagement.wizard.submitApproval')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Template dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          {editTemplate
            ? t('employmentContractManagement.editTemplate', { defaultValue: '템플릿 수정' })
            : t('employmentContractManagement.createTemplate')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('employmentContractManagement.templateName', { defaultValue: '템플릿명' })} value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} />
            <Stack direction="row" spacing={2}>
              <TextField label={t('employmentContractManagement.type', { defaultValue: '유형' })} value={templateForm.contract_type} onChange={(e) => setTemplateForm((p) => ({ ...p, contract_type: e.target.value }))} sx={{ flex: 1 }} />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>{t('employmentContractManagement.language', { defaultValue: '언어' })}</InputLabel>
              <Select
                  value="en"
                  label={t('employmentContractManagement.language', { defaultValue: '언어' })}
                  disabled
                >
                  <MenuItem value="en">en (English only)</MenuItem>
              </Select>
            </FormControl>
            </Stack>
            <TextField label={t('employmentContractManagement.bodyHtml', { defaultValue: '본문(HTML)' })} multiline minRows={8} value={templateForm.content_html} onChange={(e) => setTemplateForm((p) => ({ ...p, content_html: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>{t('employmentContractManagement.cancel', { defaultValue: '취소' })}</Button>
          <Button variant="contained" onClick={() => void saveTemplate()}>{t('employmentContractManagement.save', { defaultValue: '저장' })}</Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog — always English */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{te('employmentContractManagement.detailTitle', { defaultValue: 'Contract details' })}</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : detailContract ? (
            <Stack spacing={1.5}>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.contractTitle', { defaultValue: 'Title' })}:</strong>{' '}
                {toEnglishContractTitle(detailContract.title) || detailContract.title}
            </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.employee', { defaultValue: 'Employee' })}:</strong>{' '}
                {detailContract.employee?.username || userLabel(detailContract.employee_id)}
              </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.approver', { defaultValue: 'Approver' })}:</strong>{' '}
                {detailContract.approver?.username || userLabel(detailContract.approver_id)}
              </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.period', { defaultValue: 'Period' })}:</strong>{' '}
                {detailContract.start_date} ~ {detailContract.end_date}
              </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.salary', { defaultValue: 'Salary' })}:</strong>{' '}
                {detailContract.salary ?? '-'}
              </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.workLocation', { defaultValue: 'Work location' })}:</strong>{' '}
                {detailContract.work_location || '-'}
              </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.workingDays', { defaultValue: 'Working days' })}:</strong>{' '}
                {detailContract.working_days || '-'}
              </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.workingHours', { defaultValue: 'Working hours' })}:</strong>{' '}
                {detailContract.working_hours || '-'}
              </Typography>
              <Typography variant="body2">
                <strong>{te('employmentContractManagement.statusLabel', { defaultValue: 'Status' })}:</strong>{' '}
                {te(`employmentContractManagement.status.${String(detailContract.status || 'draft').toLowerCase()}`, {
                  defaultValue: String(detailContract.status || 'draft').replace(/_/g, ' '),
                })}
              </Typography>
              {detailContract.rejection_reason ? (
                <Typography variant="body2" color="error.main">
                  <strong>{te('employmentContractManagement.rejectionReason', { defaultValue: 'Rejection reason' })}:</strong>{' '}
                  {detailContract.rejection_reason}
                </Typography>
              ) : null}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, pt: 0.5 }}>
                {te('employmentContractManagement.contractBody', { defaultValue: 'Contract body' })}
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                  minHeight: 280,
                  maxHeight: '55vh',
                    overflowY: 'auto',
                  bgcolor: '#FAFAFA',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: String(
                    detailContract.rendered_content_html ||
                      detailContract.template?.content_html ||
                      `<p>${te('employmentContractManagement.noBody', { defaultValue: 'No contract body is registered.' })}</p>`
                    ),
                  }}
                />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {te('employmentContractManagement.noDetail', { defaultValue: 'No contract details available.' })}
                </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setDetailOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {te('employmentContractManagement.close', { defaultValue: 'Close' })}
          </Button>
          {detailContract &&
          ['signed', 'active', 'expired'].includes(String(detailContract.status || '').toLowerCase()) ? (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon fontSize="small" />}
              onClick={() =>
                void downloadContractPdf(
                  Number(detailContract.id),
                  toEnglishContractTitle(detailContract.title) || String(detailContract.title || '')
                )
              }
              sx={mvsBodyOutlinedBtnSx}
            >
              {te('employmentContractManagement.savePdf', { defaultValue: 'Download PDF' })}
            </Button>
          ) : null}
          {detailContract &&
          tab === 'approvals' &&
          ['pending_approval', 'in_review'].includes(String(detailContract.status || '').toLowerCase()) &&
          Number(detailContract.approver_id) === Number(user?.id) ? (
            <>
              <Button
                color="error"
                variant="outlined"
                startIcon={<ThumbDownIcon fontSize="small" />}
                onClick={() => openRejectDialog(Number(detailContract.id))}
                sx={mvsBodyOutlinedBtnSx}
              >
                {te('employmentContractManagement.actions.reject', { defaultValue: 'Reject' })}
              </Button>
              <Button
                variant="contained"
                startIcon={<ThumbUpIcon fontSize="small" />}
                onClick={() =>
                  approveContract(
                    Number(detailContract.id),
                    toEnglishContractTitle(detailContract.title) || String(detailContract.title || '')
                  )
                }
                sx={mvsBodyPrimaryBtnSx}
              >
                {te('employmentContractManagement.actions.approve', { defaultValue: 'Approve' })}
              </Button>
            </>
          ) : null}
          {detailContract &&
          String(detailContract.status || '').toLowerCase() === 'awaiting_employee_sign' &&
          Number(detailContract.employee_id) === Number(user?.id) ? (
            <Button
              variant="contained"
              startIcon={<DrawIcon fontSize="small" />}
              onClick={() => {
                setDetailOpen(false);
                openSignDialog(Number(detailContract.id));
              }}
              sx={mvsBodyPrimaryBtnSx}
            >
              {te('employmentContractManagement.actions.sign', { defaultValue: 'Sign' })}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      {/* Sign dialog */}
      <Dialog
        open={signDialogOpen}
        onClose={() => {
          if (aadhaarBusy) return;
          setSignDialogOpen(false);
          setAadhaarSession(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('employmentContractManagement.signTitle', { defaultValue: '계약서 서명' })}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>{t('employmentContractManagement.signMethod', { defaultValue: '서명 방식' })}</InputLabel>
                    <Select
                value={signForm.sign_method}
                label={t('employmentContractManagement.signMethod', { defaultValue: '서명 방식' })}
                disabled={Boolean(aadhaarSession) || aadhaarBusy}
                onChange={(e) => {
                  const method = e.target.value as 'internal_ack' | 'aadhaar_esign';
                  setAadhaarSession(null);
                  setSignForm((p) => ({
                    ...p,
                    sign_method: method,
                    mock_otp: '',
                  }));
                }}
              >
                <MenuItem value="aadhaar_esign">Aadhaar eSign</MenuItem>
                <MenuItem value="internal_ack">Internal Acknowledgement</MenuItem>
                    </Select>
                  </FormControl>
            {signForm.sign_method === 'aadhaar_esign' && (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t('employmentContractManagement.aadhaarAspSteps', {
                    defaultValue:
                      '1) 끝 4자리·동의 → 2) Aadhaar 인증 시작 → 3) Mock OTP(개발) 또는 ASP 페이지 인증 → 4) 서명 완료. live 모드는 ASP 계약 후 env 설정이 필요합니다.',
                  })}
                </Typography>
                {!aadhaarSession ? (
                  <>
                  <TextField
                      label={t('employmentContractManagement.aadhaarLast4', { defaultValue: 'Aadhaar 마지막 4자리' })}
                      value={signForm.aadhaar_last4}
                      onChange={(e) =>
                        setSignForm((p) => ({ ...p, aadhaar_last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                      }
                      inputProps={{ maxLength: 4 }}
                      helperText={t('employmentContractManagement.aadhaarLast4Hint', {
                        defaultValue: 'ASP 본인확인용 힌트 값입니다. 실제 인증은 OTP/생체(ASP)로 진행됩니다.',
                      })}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={signForm.aadhaar_consent}
                          onChange={(e) => setSignForm((p) => ({ ...p, aadhaar_consent: e.target.checked }))}
                        />
                      }
                      label={t('employmentContractManagement.aadhaarConsent', {
                        defaultValue: 'Aadhaar eSign 본인 인증 및 전자서명 처리에 동의합니다.',
                      })}
                    />
                  </>
                ) : (
                  <>
                    <Alert severity="info">
                      {aadhaarSession.requires_mock_otp
                        ? t('employmentContractManagement.aadhaarMockOtpHint', {
                            defaultValue: `Mock ASP 세션입니다. 거래번호: ${aadhaarSession.asp_txn_id || '-'} / 아무 6자리 OTP를 입력하세요.`,
                          })
                        : t('employmentContractManagement.aadhaarLiveHint', {
                            defaultValue: 'ASP 인증을 마친 뒤 아래 서명 완료를 눌러 주세요.',
                          })}
                    </Alert>
                    {aadhaarSession.requires_mock_otp ? (
                      <TextField
                        label={t('employmentContractManagement.aadhaarMockOtp', { defaultValue: 'Mock OTP (6자리)' })}
                        value={signForm.mock_otp}
                        onChange={(e) =>
                          setSignForm((p) => ({ ...p, mock_otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))
                        }
                        inputProps={{ maxLength: 6 }}
                      />
                    ) : null}
                  </>
                )}
              </>
            )}
            </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSignDialogOpen(false);
              setAadhaarSession(null);
            }}
            disabled={aadhaarBusy}
          >
            {t('employmentContractManagement.cancel', { defaultValue: '취소' })}
          </Button>
          <Button
            variant="contained"
            onClick={() => void signContract()}
            disabled={
              aadhaarBusy ||
              (signForm.sign_method === 'aadhaar_esign' &&
                !aadhaarSession &&
                (!signForm.aadhaar_consent || signForm.aadhaar_last4.length !== 4)) ||
              (signForm.sign_method === 'aadhaar_esign' &&
                Boolean(aadhaarSession?.requires_mock_otp) &&
                signForm.mock_otp.length !== 6)
            }
          >
            {aadhaarBusy ? (
              <CircularProgress size={18} color="inherit" />
            ) : signForm.sign_method === 'aadhaar_esign' && !aadhaarSession ? (
              t('employmentContractManagement.aadhaarStart', { defaultValue: 'Aadhaar 인증 시작' })
            ) : signForm.sign_method === 'aadhaar_esign' ? (
              t('employmentContractManagement.aadhaarComplete', { defaultValue: '서명 완료' })
            ) : (
              t('employmentContractManagement.actions.sign')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('employmentContractManagement.actions.reject')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, mt: 0.5 }}>
            {t('employmentContractManagement.rejectReasonRequired', {
              defaultValue: '반려 시 코멘트를 입력해 주세요.',
            })}
          </Typography>
          <TextField
            fullWidth
            required
            multiline
            minRows={3}
            label={t('employmentContractManagement.rejectionReason', { defaultValue: '반려 사유' })}
            placeholder={t('employmentContractManagement.rejectionReasonPlaceholder', {
              defaultValue: '반려 사유를 입력하세요...',
            })}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            error={Boolean(rejectDialogOpen && rejectReason.trim() === '' && rejectReason.length > 0)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>{t('employmentContractManagement.cancel', { defaultValue: '취소' })}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!rejectReason.trim()}
            onClick={() => void rejectContract()}
          >
            {t('employmentContractManagement.actions.reject')}
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
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <Snackbar open={Boolean(message)} autoHideDuration={5000} onClose={() => setMessage(null)}>
        <Alert severity={message?.type || 'success'} onClose={() => setMessage(null)}>
          {message?.text || ''}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmploymentContractManagement;
