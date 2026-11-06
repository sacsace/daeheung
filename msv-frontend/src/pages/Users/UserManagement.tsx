import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Menu,
  ListItemIcon,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  Card,
  CardContent,
  TableSortLabel,
  Pagination,
  useMediaQuery,
  InputAdornment,
  Avatar,
  IconButton,
  Autocomplete,
} from '@mui/material';
import MvsPageHeader from '../../components/Common/MvsPageHeader';
import {
  mvsPageRootSx,
  mvsOutlinedLabelProps,
  mvsKpiCardSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsTableScrollSx,
  mvsBodyPaginationSx,
  mvsBodySectionHeaderSx,
} from '../../theme/mvsLayout';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  FileDownload as FileDownloadIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  MoreHoriz as MoreHorizIcon,
  ArrowBack as ArrowBackIcon,
  PhotoCamera as PhotoCameraIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Lock as LockOutlinedIcon,
  History as HistoryIcon,
  AttachFile as AttachFileIcon,
  OpenInNew as OpenInNewIcon,
  PictureAsPdf as PictureAsPdfIcon,
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { useStore, useMenuStore } from '../../store';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import { buildEmployeePersonalRecordSections } from './buildEmployeePersonalRecordSections';
import { api, departmentService, positionService, userService } from '../../services/api';
import { companyService } from '../../services/api/domains/company';
import {
  indianStateLabel,
  resolveRegisteredStateCodeFromCompanyLike,
} from '../HR/payroll/indianProfessionalTax';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { usePromptDialog } from '../../hooks/usePromptDialog';
import PromptDialog from '../../components/Common/PromptDialog';
import { getMvsDialogActionsSx, getMvsDialogPaperSx } from '../../components/Common/mvsDialogShell';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import { DepartmentManagementPanel } from '../HR/DepartmentManagement';
import { PositionManagementPanel } from '../HR/PositionManagement';
import { EmploymentTypeManagementPanel } from '../HR/EmploymentTypeManagement';
import { getUploadUrl } from '../../utils/uploadUrl';
import { formatPositionLabel } from '../../utils/positionLabels';
import {
  buildEmployeePersonalRecordFilename,
  downloadEmployeePersonalRecordPdf,
  generateEmployeePersonalRecordPdfBlob,
} from './employeePersonalRecordPdf';
import { shortCompanyName, toPayslipCompanyInfo } from '../HR/PayslipContent';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
} from '../../utils/companyDisplayName';

const USER_MGMT_MENU_ROUTES = ['/hr/users', '/users'];
const USERS_PER_PAGE = 15;

function matchMasterIdByName(
  name: string | undefined | null,
  id: number | '' | null | undefined,
  list: { id: number; name: string }[]
): number | '' {
  if (id != null && id !== '') return Number(id);
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  const exact = list.find((item) => item.name === trimmed);
  if (exact) return exact.id;
  const ci = list.find((item) => item.name.toLowerCase() === lower);
  return ci ? ci.id : '';
}

type ListViewMode = 'page' | 'all';

const listViewModeBarSx = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 0.75,
  mb: 1.25,
} as const;

const listViewModeBtnSx = {
  height: 32,
  minWidth: 0,
  px: 1.5,
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.75rem',
  borderRadius: '8px',
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const,
};

/** 사용자 목록 열 너비 — 상태·생성일은 내용에 맞게 좁게 */
const USER_LIST_COL_WIDTHS = {
  seq: 40,
  select: 48,
  username: '15%',
  email: '24%',
  role: '10%',
  department: '15%',
  position: '15%',
  status: 80,
  created_at: 100,
} as const;

const userSeqColSx = {
  width: USER_LIST_COL_WIDTHS.seq,
  minWidth: USER_LIST_COL_WIDTHS.seq,
  maxWidth: USER_LIST_COL_WIDTHS.seq,
  px: { xs: 0.5, sm: 0.75 },
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontVariantNumeric: 'tabular-nums',
  boxSizing: 'border-box',
  color: 'text.secondary',
} as const;

const userStatusColSx = {
  width: USER_LIST_COL_WIDTHS.status,
  minWidth: USER_LIST_COL_WIDTHS.status,
  maxWidth: USER_LIST_COL_WIDTHS.status,
  px: { xs: 0.75, sm: 1 },
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  boxSizing: 'border-box',
} as const;

const userCreatedColSx = {
  width: USER_LIST_COL_WIDTHS.created_at,
  minWidth: USER_LIST_COL_WIDTHS.created_at,
  maxWidth: USER_LIST_COL_WIDTHS.created_at,
  px: { xs: 0.75, sm: 1 },
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontVariantNumeric: 'tabular-nums',
  boxSizing: 'border-box',
} as const;

const userListChipSx = { fontSize: '0.75rem', fontWeight: 500, borderRadius: '8px' } as const;

const USER_FILTER_OUTLINED = mvsOutlinedLabelProps;
const userFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;
const userFormFieldSx = userFilterFieldSx;

const userTableBodyRowSx: SxProps<Theme> = (theme) => {
  const base = typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hoverBg = theme.palette.mode === 'light' ? '#EFF6FF' : theme.palette.action.hover;
  return {
    ...(base as object),
    '& .MuiTableRow-root:nth-of-type(odd)': { bgcolor: rowBg },
    '& .MuiTableRow-root:nth-of-type(even)': { bgcolor: rowBg },
    '& .MuiTableRow-root:hover': { bgcolor: hoverBg },
    '& .MuiTableCell-body.MuiTableCell-paddingCheckbox': {
      width: 56,
      minWidth: 56,
      maxWidth: 56,
      pl: { xs: 1.5, sm: 2 },
      pr: 1,
      boxSizing: 'border-box',
    },
  };
};

interface User {
  id: number;
  userid: string;
  username: string;
  email: string;
  role: string;
  company_id?: number | null;
  department?: string;
  department_id?: number | null;
  position_id?: number | null;
  position?: string;
  status: string;
  created_at: string;
  updated_at: string;
  is_payment_officer?: boolean;
  // 인사관리 필드
  employee_number?: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  avatar_url?: string;
  hire_date?: string;
  employment_type?: 'fulltime' | 'contract' | 'parttime' | 'intern' | 'daily' | 'service';
  salary?: number;
  has_salary?: boolean;
  ot_eligible?: boolean;
  pt_eligible?: boolean;
  pf_calc_mode?: 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none';
  /** @deprecated pf_calc_mode 사용 */
  pf_cap_1800?: boolean;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
}

interface Company {
  id: number;
  name: string;
}

type CompanyPickOption = { id: number | ''; name: string };

type CompanySearchSelectProps = {
  companies: Company[];
  value: number | '';
  onChange: (companyId: number | '') => void;
  label: string;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  textFieldSx?: object;
  outlinedProps?: object;
  sx?: object;
  helperText?: React.ReactNode;
  error?: boolean;
};

const CompanySearchSelect: React.FC<CompanySearchSelectProps> = ({
  companies,
  value,
  onChange,
  label,
  placeholder,
  allowAll = false,
  allLabel = '',
  disabled,
  required,
  fullWidth = true,
  textFieldSx,
  outlinedProps,
  sx,
  helperText,
  error,
}) => {
  const options = useMemo<CompanyPickOption[]>(() => {
    const list = companies.map((company) => ({
      id: company.id,
      name: shortCompanyName(company.name) || company.name,
    }));
    if (allowAll) return [{ id: '', name: allLabel }, ...list];
    return list;
  }, [allowAll, allLabel, companies]);

  const selected = useMemo(() => {
    if (value === '' || value == null) {
      return allowAll ? options.find((o) => o.id === '') ?? null : null;
    }
    return options.find((o) => o.id === Number(value)) ?? null;
  }, [allowAll, options, value]);

  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_, next) => {
        if (!next || next.id === '') onChange('');
        else onChange(Number(next.id));
      }}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      disabled={disabled}
      fullWidth={fullWidth}
      disableClearable={allowAll ? Boolean(selected) : false}
      slotProps={companySelectListboxSlotProps}
      sx={{ ...companySelectNowrapSx, ...sx }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={label}
          required={required}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          {...(outlinedProps as object)}
          sx={{ ...companySelectNowrapSx, ...textFieldSx }}
        />
      )}
    />
  );
};

/** 급여(INR): 소수 미표시, 천 단위 콤마 (예: ₹100,000) */
function salaryAmountsDiffer(left: unknown, right: unknown): boolean {
  const norm = (value: unknown) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const n = Number(text.replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  return norm(left) !== norm(right);
}

function salaryStatusLabel(status: string, t: (key: string) => string): string {
  if (status === 'approved') return t('userManagement.salaryStatusApproved');
  if (status === 'rejected') return t('userManagement.salaryStatusRejected');
  if (status === 'cancelled') return t('userManagement.salaryStatusCancelled');
  return t('userManagement.salaryStatusPending');
}

function formatSalaryInr(value: unknown): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n)) return '—';
  return `₹${Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
}

/** 계좌번호 저장값: 공백 제거 후 숫자만 */
function normalizeBankAccountDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/\D/g, '');
}

/** 계좌번호 표시: 숫자 4자리마다 공백 */
function formatBankAccountDisplay(digitsOnly: string): string {
  const d = normalizeBankAccountDigits(digitsOnly);
  if (!d) return '';
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 4) {
    parts.push(d.slice(i, i + 4));
  }
  return parts.join(' ');
}

/** IFSC 저장값: 공백·특수문자 제거, 영숫자만, 대문자, 최대 11자(인도 표준) */
function normalizeIfsc(raw: string): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 11);
}

/** IFSC 표시: 4자리마다 공백 */
function formatIfscDisplay(stored: string): string {
  const s = normalizeIfsc(stored);
  if (!s) return '';
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += 4) {
    parts.push(s.slice(i, i + 4));
  }
  return parts.join(' ');
}

/** 전화번호 저장값: 공백 제거 후 숫자만, 최대 10자 */
function normalizePhoneDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/\D/g, '')
    .slice(0, 10);
}

/** 전화번호 표시: 10자리, 5+공백+5 (예: 12345 67890) */
function formatPhoneDisplay(digitsOnly: string): string {
  const d = normalizePhoneDigits(digitsOnly);
  if (!d) return '';
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

/** 생성/수정 폼 아코디언 — MVS Body 리스트 영역 내 섹션 카드 */
function getAccordionFormSx(_theme: Theme) {
  return {
    '&:before': { display: 'none' },
    boxShadow: 'none',
    border: '1px solid #CBD5E1',
    borderRadius: '8px',
    mb: 1,
    bgcolor: '#FFFFFF',
    overflow: 'hidden' as const,
    '&:last-of-type': { mb: 0 },
    '& .MuiAccordionSummary-root': {
      minHeight: '40px !important',
      py: 0,
      px: 1.25,
      bgcolor: '#E2E8F0',
      borderBottom: '1px solid #CBD5E1',
      borderRadius: '8px 8px 0 0',
      '&.Mui-expanded': {
        minHeight: '40px !important',
        borderBottom: '1px solid #CBD5E1',
      },
    },
    '& .MuiAccordionSummary-content': {
      my: '6px !important',
      '&.Mui-expanded': { my: '6px !important' },
    },
    '& .MuiAccordionSummary-expandIconWrapper': { py: 0 },
    '& .MuiAccordionDetails-root': {
      pt: 2,
      pb: 1.25,
      px: 1.25,
    },
    '&.MuiAccordion-root.Mui-expanded': {
      borderRadius: '8px',
    },
    '&.MuiAccordion-root:not(:first-of-type)': {
      mt: 0,
    },
  };
}

const userFormSectionTitleSx = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
  color: 'text.primary',
} as const;

const highlightPayrollFieldsSx = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 1.5,
  width: '100%',
  boxSizing: 'border-box' as const,
};

/** 폼 outlined 라벨 — 테두리 위 고정 */
const OUTLINED_FIELD = mvsOutlinedLabelProps;

const hrHintSx = {
  fontSize: '0.7rem',
  lineHeight: 1.35,
  display: 'block',
  mt: 0.375
} as const;

const highlightBankFieldsSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
  gap: 1.5,
  alignItems: 'flex-start',
  boxSizing: 'border-box' as const,
};

/** 폼 내 TextField·Select 공통 */
const userFormContainerSx = {
  ...userFormFieldSx,
  '& .MuiFormControl-root': { width: '100%' },
  '& .MuiFormHelperText-root': { mx: 0, mt: 0.5 },
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
} as const;

type CareerEntry = {
  company_name: string;
  position: string;
  start_date: string;
  end_date: string;
  description: string;
  certificate_url: string;
};

const emptyCareerEntry = (): CareerEntry => ({
  company_name: '',
  position: '',
  start_date: '',
  end_date: '',
  description: '',
  certificate_url: '',
});

const normalizeCareerForm = (raw: unknown): CareerEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((row: any) => ({
    company_name: String(row?.company_name ?? '').trim(),
    position: String(row?.position ?? '').trim(),
    start_date: String(row?.start_date ?? '').trim(),
    end_date: String(row?.end_date ?? '').trim(),
    description: String(row?.description ?? '').trim(),
    certificate_url: String(row?.certificate_url ?? '').trim(),
  }));
};

type CertificateEntry = {
  name: string;
  issuer: string;
  certificate_number: string;
  issue_date: string;
  expiry_date: string;
  file_url: string;
};

const emptyCertificateEntry = (): CertificateEntry => ({
  name: '',
  issuer: '',
  certificate_number: '',
  issue_date: '',
  expiry_date: '',
  file_url: '',
});

const normalizeCertificateForm = (raw: unknown): CertificateEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((row: any) => ({
    name: String(row?.name ?? '').trim(),
    issuer: String(row?.issuer ?? '').trim(),
    certificate_number: String(row?.certificate_number ?? '').trim(),
    issue_date: String(row?.issue_date ?? '').trim(),
    expiry_date: String(row?.expiry_date ?? '').trim(),
    file_url: String(row?.file_url ?? '').trim(),
  }));
};

type EducationEntry = {
  school_name: string;
  degree: string;
  major: string;
  start_date: string;
  end_date: string;
  description: string;
};

const emptyEducationEntry = (): EducationEntry => ({
  school_name: '',
  degree: '',
  major: '',
  start_date: '',
  end_date: '',
  description: '',
});

const normalizeEducationForm = (raw: unknown): EducationEntry[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((row: any) => ({
    school_name: String(row?.school_name ?? '').trim(),
    degree: String(row?.degree ?? '').trim(),
    major: String(row?.major ?? '').trim(),
    start_date: String(row?.start_date ?? '').trim(),
    end_date: String(row?.end_date ?? '').trim(),
    description: String(row?.description ?? '').trim(),
  }));
};

const UserManagement: React.FC = () => {
  const theme = useTheme();
  const isCompactToolbar = useMediaQuery(theme.breakpoints.down('md'));
  /** 사용자 상세 다이얼로그 — 필드 라벨·값 가독성 */
  const userDetailLabelSx = useMemo(
    () => ({
      mb: 0.5,
      fontWeight: 500 as const,
      color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.85) : theme.palette.grey[800],
      fontSize: '0.8125rem'
    }),
    [theme]
  );
  const userDetailValueSx = useMemo(
    () => ({
      color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.95) : alpha(theme.palette.text.primary, 0.92)
    }),
    [theme]
  );
  const userDetailSectionTitleSx = useMemo(
    () => ({
      fontWeight: 600 as const,
      fontSize: '0.8125rem',
      color: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.92) : theme.palette.grey[900]
    }),
    [theme]
  );
  const { user } = useStore();
  const { loading: menusLoading } = useMenuStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const menuFlags = useMenuRoutePermissionFlags(USER_MGMT_MENU_ROUTES);
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith('en') ? 'en-US' : 'ko-KR';
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const {
    dialogState: promptState,
    showPrompt,
    handleConfirm: handlePromptConfirm,
    handleCancel: handlePromptCancel,
  } = usePromptDialog();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyPtStateCode, setCompanyPtStateCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewSalaryRevealed, setViewSalaryRevealed] = useState<number | string | null>(null);
  const [downloadingPersonalRecord, setDownloadingPersonalRecord] = useState(false);
  const [salaryUnlockOpen, setSalaryUnlockOpen] = useState(false);
  const [salaryUnlockMode, setSalaryUnlockMode] = useState<'view' | 'edit'>('view');
  const [salaryUnlockPassword, setSalaryUnlockPassword] = useState('');
  const [salaryUnlockError, setSalaryUnlockError] = useState('');
  const [salaryUnlocking, setSalaryUnlocking] = useState(false);
  const [salaryUnlocked, setSalaryUnlocked] = useState(false);
  const [salaryPasswordForSubmit, setSalaryPasswordForSubmit] = useState('');
  const [salaryBaseline, setSalaryBaseline] = useState('');
  const [salaryApproverId, setSalaryApproverId] = useState<number | ''>('');
  const [salaryApprovers, setSalaryApprovers] = useState<Array<{ id: number; name: string }>>([]);
  const [salaryHistoryOpen, setSalaryHistoryOpen] = useState(false);
  const [salaryHistoryRows, setSalaryHistoryRows] = useState<any[]>([]);
  const [salaryHistoryLoading, setSalaryHistoryLoading] = useState(false);
  const [salaryPendingOpen, setSalaryPendingOpen] = useState(false);
  const [salaryPendingRows, setSalaryPendingRows] = useState<any[]>([]);
  const [originalHasSalary, setOriginalHasSalary] = useState(false);
  const [importLoginPassword, setImportLoginPassword] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  /** 퇴사(inactive) 사용자 목록·검색 포함 */
  const [includeInactive, setIncludeInactive] = useState(false);
  /** root: 로그인 사용자 소속 회사를 기본 선택 */
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>(() => {
    const u = useStore.getState().user;
    if (u?.role === 'root' && u.company_id != null && Number(u.company_id) > 0) {
      return Number(u.company_id);
    }
    return '';
  });
  const rootCompanyDefaultApplied = useRef(selectedCompanyId !== '');
  const [orderBy, setOrderBy] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string; sort_order: number }[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [careerCertificateFiles, setCareerCertificateFiles] = useState<Record<number, File>>({});
  const [certificateCopyFiles, setCertificateCopyFiles] = useState<Record<number, File>>({});
  const [existingAvatarUrl, setExistingAvatarUrl] = useState('');
  /** 0: 사용자 목록, 1: 사용자 추가/수정 폼, 2: 부서 관리, 3: 직책 관리, 4: 근무형태 */
  const [pageTab, setPageTab] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [formData, setFormData] = useState({
    // 기본 정보
    employee_number: '',
    username: '',
    birth_date: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    // 인사 정보
    hire_date: '',
    department: '',
    department_id: '' as number | '',
    position: '',
    position_id: '' as number | '',
    employment_type: 'fulltime',
    salary: '',
    ot_eligible: false,
    pt_eligible: true,
    pf_calc_mode: 'cap_1800' as 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none',
    bank_name: '',
    bank_account: '',
    bank_ifsc: '',
    career_history: [] as CareerEntry[],
    education_history: [] as EducationEntry[],
    certificate_history: [] as CertificateEntry[],
    // 계정 정보
    userid: '',
    password: '',
    role: 'user',
    status: 'active',
    is_payment_officer: false,
    company_id: undefined as number | undefined
  } as {
    employee_number: string;
    username: string;
    birth_date: string;
    gender: string;
    phone: string;
    email: string;
    address: string;
    emergency_contact: string;
    emergency_phone: string;
    hire_date: string;
    department: string;
    department_id: number | '';
    position: string;
    position_id: number | '';
    employment_type: string;
    salary: string;
    ot_eligible: boolean;
    pt_eligible: boolean;
    pf_calc_mode: 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none';
    bank_name: string;
    bank_account: string;
    bank_ifsc: string;
    career_history: CareerEntry[];
    education_history: EducationEntry[];
    certificate_history: CertificateEntry[];
    userid: string;
    password: string;
    role: string;
    status: string;
    is_payment_officer: boolean;
    company_id?: number;
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewEmployeeNumberLoading, setPreviewEmployeeNumberLoading] = useState(false);
  const [toolbarMenuAnchor, setToolbarMenuAnchor] = useState<null | HTMLElement>(null);
  const [page, setPage] = useState(1);
  const [listViewMode, setListViewMode] = useState<ListViewMode>('page');

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const resetAvatarInput = (avatarUrl = '') => {
    setAvatarFile(null);
    setAvatarPreviewUrl('');
    setExistingAvatarUrl(avatarUrl);
  };

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError(t('userManagement.avatarInvalidType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('userManagement.avatarTooLarge'));
      return;
    }
    setError('');
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const fetchNextEmployeeNumber = useCallback(async (companyId?: number) => {
    if (user?.role === 'root' && !companyId) {
      setFormData((prev) => ({ ...prev, employee_number: '' }));
      return;
    }
    setPreviewEmployeeNumberLoading(true);
    try {
      const response = await userService.getNextEmployeeNumber(companyId);
      if (response?.success) {
        const nextNumber = String(response.data?.employee_number || '').trim().toUpperCase();
        setFormData((prev) => ({ ...prev, employee_number: nextNumber }));
      }
    } catch {
      /* ignore */
    } finally {
      setPreviewEmployeeNumberLoading(false);
    }
  }, [user?.role]);

  const loginUserCompanyId = useMemo(() => {
    const id = user?.company_id;
    return id != null && id > 0 ? id : undefined;
  }, [user?.company_id]);

  // 인사정보 PT: 회사 GST 등록 주(州) 표시용
  useEffect(() => {
    const companyId = Number(
      formData.company_id || editingUser?.company_id || user?.company_id || 0
    );
    if (!Number.isFinite(companyId) || companyId <= 0) {
      setCompanyPtStateCode(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await companyService.getCompany(companyId);
        if (!response?.success || !response.data) {
          if (!cancelled) setCompanyPtStateCode(null);
          return;
        }
        const data = response.data;
        let gstNumbers = data.gst_numbers ?? data.gstNumbers ?? [];
        try {
          const gstRes = await companyService.getCompanyGstNumbers(companyId);
          if (
            gstRes?.success &&
            Array.isArray(gstRes.data?.gst_numbers) &&
            gstRes.data.gst_numbers.length > 0
          ) {
            gstNumbers = gstRes.data.gst_numbers;
          }
        } catch {
          /* ignore */
        }
        const code = resolveRegisteredStateCodeFromCompanyLike({
          settings: data.settings,
          address: data.address,
          business_number: data.business_number || data.businessNumber,
          gst_numbers: gstNumbers,
        });
        if (!cancelled) setCompanyPtStateCode(code);
      } catch {
        if (!cancelled) setCompanyPtStateCode(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.company_id, editingUser?.company_id, user?.company_id]);

  // root: 사용자 정보가 늦게 로드돼도 소속 회사를 한 번만 기본 선택
  useEffect(() => {
    if (rootCompanyDefaultApplied.current) return;
    if (user?.role !== 'root') return;
    const cid = user?.company_id != null ? Number(user.company_id) : NaN;
    if (!Number.isFinite(cid) || cid <= 0) return;
    setSelectedCompanyId(cid);
    rootCompanyDefaultApplied.current = true;
  }, [user?.role, user?.company_id]);

  const fetchCompanies = useCallback(async () => {
    try {
      const companiesData = await useReferenceDataStore.getState().fetchCompanies();
      setCompanies(companiesData.map((c: any) => ({ id: c.id, name: c.name })));
    } catch {
      /* ignore */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params: { search?: string; company_id?: number } = {};
      if (searchTerm) {
        params.search = searchTerm;
      }
      if ((user?.role === 'root' || user?.role === 'audit') && selectedCompanyId) {
        params.company_id = selectedCompanyId;
      }

      const usersData = await useReferenceDataStore.getState().fetchUsers(params, true);
      setUsers(usersData);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || t('userManagement.loadFailed');
      setError(errorMessage);
      setUsers([]);
    } finally {
      setLoading(false);
          }
  }, [searchTerm, selectedCompanyId, user?.role, t]);

  const loadDepartments = useCallback(async (companyId?: number | null) => {
    const cid =
      companyId != null && Number.isFinite(Number(companyId))
        ? Number(companyId)
        : user?.role === 'root' || user?.role === 'audit'
          ? null
          : user?.company_id != null
            ? Number(user.company_id)
            : null;
    if (cid == null) {
      setDepartments([]);
      return;
    }
    try {
      const res = await departmentService.list(false, cid);
      if (res.success && Array.isArray(res.data)) {
        setDepartments(
          (res.data as { id: number; name: string }[]).map((d) => ({ id: d.id, name: d.name }))
        );
      } else {
        setDepartments([]);
      }
    } catch {
      setDepartments([]);
    }
  }, [user?.company_id, user?.role]);

  const loadPositions = useCallback(async (companyId?: number | null) => {
    const cid =
      companyId != null && Number.isFinite(Number(companyId))
        ? Number(companyId)
        : user?.role === 'root' || user?.role === 'audit'
          ? null
          : user?.company_id != null
            ? Number(user.company_id)
            : null;
    if (cid == null) {
      setPositions([]);
      return;
    }
    try {
      const res = await positionService.list(false, cid);
      if (res.success && Array.isArray(res.data)) {
        const list = (res.data as { id: number; name: string; sort_order?: number }[])
          .map((d) => ({ id: d.id, name: d.name, sort_order: d.sort_order ?? 0 }))
          .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko'));
        setPositions(list);
      } else {
        setPositions([]);
      }
    } catch {
      setPositions([]);
    }
  }, [user?.company_id, user?.role]);

  useEffect(() => {
    fetchUsers();
    if (user?.role === 'root' || user?.role === 'audit') {
      fetchCompanies();
    }
  }, [fetchCompanies, fetchUsers, user?.role]);

  useEffect(() => {
    if (viewMode === 'create' || viewMode === 'edit') {
      const cid =
        formData.company_id ??
        editingUser?.company_id ??
        user?.company_id ??
        null;
      void loadDepartments(cid != null ? Number(cid) : null);
      void loadPositions(cid != null ? Number(cid) : null);
    }
  }, [viewMode, loadDepartments, loadPositions, formData.company_id, editingUser?.company_id, user?.company_id]);

  /** 기존 사용자에 department 문자열만 있을 때 마스터와 이름 매칭 */
  useEffect(() => {
    if (viewMode !== 'create' && viewMode !== 'edit') return;
    if (formData.department_id !== '' || !formData.department || departments.length === 0) return;
    const match = departments.find(
      (d) =>
        d.name === formData.department ||
        d.name.toLowerCase() === String(formData.department).trim().toLowerCase()
    );
    if (!match) return;
    setFormData((prev) =>
      prev.department_id === '' &&
      prev.department.trim().toLowerCase() === match.name.trim().toLowerCase()
        ? { ...prev, department_id: match.id, department: match.name }
        : prev
    );
  }, [viewMode, departments, formData.department, formData.department_id]);

  /** 기존 사용자에 position 문자열만 있을 때 마스터와 이름 매칭 */
  useEffect(() => {
    if (viewMode !== 'create' && viewMode !== 'edit') return;
    if (formData.position_id !== '' || !formData.position || positions.length === 0) return;
    const match = positions.find(
      (p) =>
        p.name === formData.position ||
        p.name.toLowerCase() === String(formData.position).trim().toLowerCase()
    );
    if (!match) return;
    setFormData((prev) =>
      prev.position_id === '' &&
      prev.position.trim().toLowerCase() === match.name.trim().toLowerCase()
        ? { ...prev, position_id: match.id, position: match.name }
        : prev
    );
  }, [viewMode, positions, formData.position, formData.position_id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab !== 'departments' && tab !== 'positions') return;
    if (menusLoading) return;
    if (!menuFlags.canCreate) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      }, { replace: true });
      return;
    }
    setPageTab(tab === 'positions' ? 3 : 2);
    setViewMode('list');
    setEditingUser(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('tab');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams, menusLoading, menuFlags.canCreate]);

  useEffect(() => {
    const prefillEmailRaw = searchParams.get('prefill_email');
    if (!prefillEmailRaw) return;
    const prefillEmail = prefillEmailRaw.trim().toLowerCase();
    if (!prefillEmail) return;
    if (!menuFlags.canCreate) {
      setError(t('userManagement.tabDisabledNoCreate'));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('prefill_email');
        return next;
      }, { replace: true });
      return;
    }

    setEditingUser(null);
    resetAvatarInput();
    setCareerCertificateFiles({});
    setCertificateCopyFiles({});
    setFormData({
      employee_number: '',
      username: prefillEmail.split('@')[0] || '',
      birth_date: '',
      gender: '',
      phone: '',
      email: prefillEmail,
      address: '',
      emergency_contact: '',
      emergency_phone: '',
      hire_date: '',
      department: '',
      department_id: '' as number | '',
      position: '',
      position_id: '' as number | '',
      employment_type: 'fulltime',
      salary: '',
      ot_eligible: false,
      pt_eligible: true,
      pf_calc_mode: 'cap_1800',
      bank_name: '',
      bank_account: '',
      bank_ifsc: '',
      career_history: [],
      education_history: [],
      certificate_history: [],
      userid: prefillEmail,
      password: '',
      role: 'user',
      status: 'active',
      is_payment_officer: false,
      company_id: loginUserCompanyId
    } as any);
    setSalaryUnlocked(true);
    setSalaryPasswordForSubmit('');
    setSalaryBaseline('');
    setOriginalHasSalary(false);
    setPageTab(1);
    setViewMode('create');
    setSuccess(t('userManagement.prefillReady'));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('prefill_email');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams, menuFlags.canCreate, loginUserCompanyId, t]);

  /** 메뉴 로드 후 권한 없는 탭에 머물러 있으면 목록으로 */
  useEffect(() => {
    if (menusLoading) return;
    if (pageTab === 1 && viewMode === 'create' && !menuFlags.canCreate) {
      setPageTab(0);
      setViewMode('list');
      setEditingUser(null);
    }
    if ((pageTab === 2 || pageTab === 3 || pageTab === 4) && !menuFlags.canCreate) {
      setPageTab(0);
      setViewMode('list');
      setEditingUser(null);
    }
    if (pageTab === 0 && !menuFlags.canRead) {
      /* 목록 탭도 못 보면 API가 막히므로 안내만 — 다른 탭으로 보내지 않음 */
    }
  }, [menusLoading, pageTab, viewMode, menuFlags.canCreate, menuFlags.canRead]);

  const formCompanyId = (formData as { company_id?: number }).company_id;

  useEffect(() => {
    if (pageTab !== 1 || viewMode !== 'create' || editingUser) return;
    void fetchNextEmployeeNumber(formCompanyId);
  }, [pageTab, viewMode, editingUser, formCompanyId, fetchNextEmployeeNumber]);

  useEffect(() => {
    // 검색어나 회사 필터가 변경되면 사용자 목록 다시 조회
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300); // 디바운싱

    return () => clearTimeout(timer);
  }, [fetchUsers, searchTerm, selectedCompanyId]);

  const handleCreateUser = () => {
    if (!menuFlags.canCreate) {
      setError(t('userManagement.tabDisabledNoCreate'));
      return;
    }
    setEditingUser(null);
    resetAvatarInput();
    setCareerCertificateFiles({});
    setCertificateCopyFiles({});
    setFormData({
      employee_number: '',
      username: '',
      birth_date: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      emergency_contact: '',
      emergency_phone: '',
      hire_date: '',
      department: '',
      department_id: '' as number | '',
      position: '',
      position_id: '' as number | '',
      employment_type: 'fulltime',
      salary: '',
      ot_eligible: false,
      pt_eligible: true,
      pf_calc_mode: 'cap_1800',
      bank_name: '',
      bank_account: '',
      bank_ifsc: '',
      career_history: [],
      education_history: [],
      certificate_history: [],
      userid: '',
      password: '',
      role: 'user',
      status: 'active',
    is_payment_officer: false,
    company_id: loginUserCompanyId
    } as any);
    setSalaryUnlocked(true);
    setSalaryPasswordForSubmit('');
    setSalaryBaseline('');
    setOriginalHasSalary(false);
    setPageTab(1);
    setViewMode('create');
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    resetAvatarInput(user.avatar_url || '');
    setCareerCertificateFiles({});
    setCertificateCopyFiles({});
    setFormData({
      employee_number: String((user as any).employee_number || '').trim().toUpperCase(),
      username: user.username,
      birth_date: (user as any).birth_date || '',
      gender: (user as any).gender || '',
      phone: (user as any).phone || '',
      email: user.email,
      address: (user as any).address || '',
      emergency_contact: (user as any).emergency_contact || '',
      emergency_phone: (user as any).emergency_phone || '',
      hire_date: (user as any).hire_date || '',
      department: user.department || '',
      department_id: matchMasterIdByName(user.department, (user as any).department_id, departments),
      position: user.position || '',
      position_id: matchMasterIdByName(user.position, (user as any).position_id, positions),
      employment_type: (user as any).employment_type || 'fulltime',
      salary: '',
      ot_eligible: (user as any).ot_eligible === true,
      pt_eligible: (user as any).pt_eligible !== false,
      pf_calc_mode: (() => {
        const m = String((user as any).pf_calc_mode ?? '').trim();
        if (m === 'basic_12pct' || m === 'total_12pct' || m === 'cap_1800' || m === 'none') return m;
        if ((user as any).pf_cap_1800 === false) return 'basic_12pct';
        return 'cap_1800';
      })(),
      bank_name: (user as any).bank_name || '',
      bank_account: normalizeBankAccountDigits((user as any).bank_account || ''),
      bank_ifsc: normalizeIfsc((user as any).bank_ifsc || ''),
      career_history: normalizeCareerForm((user as any).career_history),
      education_history: normalizeEducationForm((user as any).education_history),
      certificate_history: normalizeCertificateForm((user as any).certificate_history),
      userid: user.userid,
      password: '',
      role: user.role,
      status: (user as any).status || 'active',
      is_payment_officer: (user as any).is_payment_officer || false,
      company_id:
        user.company_id != null && Number(user.company_id) > 0
          ? Number(user.company_id)
          : undefined
    } as any);
    setSalaryUnlocked(false);
    setSalaryPasswordForSubmit('');
    setSalaryBaseline('');
    setSalaryApproverId('');
    setOriginalHasSalary(Boolean((user as any).has_salary));
    setPageTab(1);
    setViewMode('edit');
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setViewSalaryRevealed(null);
    setOpenViewDialog(true);
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedUsers(visibleUserIds);
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) {
      setError(t('userManagement.selectUsers'));
      return;
    }

    const selectedRows = users.filter((row) => selectedUsers.includes(row.id));
    const resignedCount = selectedRows.filter((row) => row.status === 'inactive').length;
    const activeCount = selectedRows.length - resignedCount;
    const confirmMessage =
      resignedCount > 0 && activeCount === 0
        ? t('userManagement.confirmPurgeInactive', { count: resignedCount })
        : resignedCount > 0
          ? t('userManagement.confirmDeleteMixed', { count: selectedRows.length, resigned: resignedCount })
          : t('userManagement.confirmDeleteSelectedBulk', { count: selectedUsers.length });
    const successMessage =
      resignedCount > 0 && activeCount === 0
        ? t('userManagement.purgeInactiveSuccess', { count: resignedCount })
        : resignedCount > 0
          ? t('userManagement.deleteMixedSuccess', { count: selectedRows.length })
          : t('userManagement.deleteSelectedSuccess', { count: selectedUsers.length });

    showConfirm(
      confirmMessage,
      async () => {
        try {
          await Promise.all(selectedUsers.map(userId => api.delete(`/users/${userId}`)));
          setSuccess(successMessage);
          setSelectedUsers([]);
          fetchUsers();
        } catch {
          setError(t('userManagement.deleteFailed'));
        }
      },
      {
        title: resignedCount > 0 && activeCount === 0 ? t('userManagement.purgeSelected') : undefined,
        confirmColor: 'error',
      }
    );
  };

  // Excel 샘플 파일 다운로드
  const handleDownloadSample = async () => {
    try {
      const response = await api.get('/users/excel/sample', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${t('userManagement.excelSampleFilename')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t('userManagement.excelSampleDownloadError'));
    }
  };

  // Excel 파일 내보내기
  const handleExportExcel = async () => {
    try {
      const params: any = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedCompanyId) params.company_id = selectedCompanyId;
      if (includeInactive) params.include_inactive = '1';

      const response = await api.get('/users/excel/export', {
        params,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${t('userManagement.excelExportFilename')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t('userManagement.excelExportError'));
    }
  };

  // Excel 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  // Excel 파일 가져오기
  const handleImportExcel = async () => {
    if (!importFile) {
      setError(t('userManagement.excelSelectFile'));
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);
    if (importLoginPassword.trim()) {
      formData.append('currentPassword', importLoginPassword.trim());
    }

    setImportLoading(true);
    setImportResult(null);

    try {
      const response = await api.post('/users/excel/import', formData, {
        headers: {
          'x-skip-error-popup': 'true',
        },
        timeout: 120000,
      });

      setImportResult(response.data.data);
      setSuccess(response.data.message);
      setImportLoginPassword('');

      if (response.data.data.success.length > 0) {
        setTimeout(() => {
          fetchUsers();
          setImportDialogOpen(false);
          setImportFile(null);
        }, 2000);
      }
    } catch (error: any) {
      const isNetworkFailure =
        !error.response &&
        (error.code === 'ECONNABORTED' ||
          String(error.message || '')
            .toLowerCase()
            .includes('network error') ||
          String(error.message || '').toLowerCase().includes('timeout'));

      if (isNetworkFailure) {
        await fetchUsers();
        setError(t('userManagement.excelImportNetworkMaybeSucceeded'));
      } else {
        setError(error.response?.data?.message || t('userManagement.excelImportError'));
      }
    } finally {
      setImportLoading(false);
    }
  };

  const openSalaryUnlock = (mode: 'view' | 'edit' | 'history') => {
    setSalaryUnlockMode(mode);
    setSalaryUnlockPassword('');
    setSalaryUnlockError('');
    setSalaryUnlockOpen(true);
  };

  const handleSalaryUnlockConfirm = async () => {
    if (!salaryUnlockPassword.trim()) {
      setSalaryUnlockError(t('personalSettings.salaryPasswordRequired'));
      return;
    }
    setSalaryUnlocking(true);
    setSalaryUnlockError('');
    try {
      if (salaryUnlockMode === 'history') {
        const targetId = editingUser?.id || selectedUser?.id;
        if (!targetId) {
          setSalaryUnlockError(t('personalSettings.salaryRevealFailed'));
          return;
        }
        const res = await userService.getSalaryHistory(targetId, salaryUnlockPassword);
        if (!res?.success) {
          setSalaryUnlockError(res?.message || t('personalSettings.salaryRevealFailed'));
          return;
        }
        setSalaryHistoryRows(Array.isArray(res.data) ? res.data : []);
        setSalaryHistoryOpen(true);
      } else if (salaryUnlockMode === 'view') {
        if (!selectedUser?.id) {
          setSalaryUnlockError(t('personalSettings.salaryRevealFailed'));
          return;
        }
        const res = await userService.revealUserSalary(selectedUser.id, salaryUnlockPassword);
        if (!res?.success) {
          setSalaryUnlockError(res?.message || t('personalSettings.salaryRevealFailed'));
          return;
        }
        setViewSalaryRevealed(res.data?.salary ?? null);
      } else {
        const targetId = editingUser?.id;
        if (targetId) {
          const res = await userService.revealUserSalary(targetId, salaryUnlockPassword);
          if (!res?.success) {
            setSalaryUnlockError(res?.message || t('personalSettings.salaryRevealFailed'));
            return;
          }
          setFormData((prev) => ({
            ...prev,
            salary: res.data?.salary != null && res.data.salary !== '' ? String(res.data.salary) : '',
          }));
          setSalaryBaseline(
            res.data?.salary != null && res.data.salary !== '' ? String(res.data.salary) : ''
          );
        } else {
          // 신규 등록: 본인 비밀번호만 검증
          const res = await userService.revealMySalary(salaryUnlockPassword);
          if (!res?.success) {
            setSalaryUnlockError(res?.message || t('personalSettings.salaryRevealFailed'));
            return;
          }
          setSalaryBaseline('');
        }
        setSalaryUnlocked(true);
        setSalaryPasswordForSubmit(salaryUnlockPassword);
      }
      setSalaryUnlockOpen(false);
      setSalaryUnlockPassword('');
    } catch (err: any) {
      setSalaryUnlockError(err?.response?.data?.message || t('personalSettings.salaryRevealFailed'));
    } finally {
      setSalaryUnlocking(false);
    }
  };

  const loadPendingSalaryChanges = useCallback(async () => {
    try {
      const res = await userService.listPendingSalaryChanges();
      setSalaryPendingRows(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setSalaryPendingRows([]);
    }
  }, []);

  const openSalaryHistory = async (userId?: number) => {
    if (!userId) return;
    if (salaryPasswordForSubmit) {
      setSalaryHistoryLoading(true);
      setSalaryHistoryOpen(true);
      try {
        const res = await userService.getSalaryHistory(userId, salaryPasswordForSubmit);
        setSalaryHistoryRows(Array.isArray(res?.data) ? res.data : []);
      } catch (err: any) {
        setSalaryHistoryOpen(false);
        setError(err?.response?.data?.message || t('personalSettings.salaryRevealFailed'));
      } finally {
        setSalaryHistoryLoading(false);
      }
      return;
    }
    openSalaryUnlock('history');
  };

  const salaryDraftChanged =
    salaryUnlocked && salaryAmountsDiffer(formData.salary, salaryBaseline);

  useEffect(() => {
    if (viewMode !== 'edit' || !salaryDraftChanged) return;
    const companyId = Number(
      (formData as { company_id?: number }).company_id || editingUser?.company_id || user?.company_id
    );
    if (!companyId) return;
    let cancelled = false;
    userService
      .listSalaryApprovers(companyId)
      .then((res) => {
        if (!cancelled) setSalaryApprovers(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setSalaryApprovers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, salaryDraftChanged, formData, editingUser?.company_id, user?.company_id]);

  useEffect(() => {
    if (viewMode !== 'list') return;
    void loadPendingSalaryChanges();
  }, [viewMode, loadPendingSalaryChanges]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // root: 등록·수정 모두 회사 필수
      if (user?.role === 'root' && !(formData as { company_id?: number }).company_id) {
        setError(t('userManagement.selectCompany'));
        return;
      }

      // 비밀번호가 없으면 기본값 설정 (신규 등록 시)
      const submitData: any = {
        ...formData,
        userid: String(formData.userid || '').trim().toLowerCase(),
        password: formData.password || (editingUser ? undefined : 'default123')
      };

      if (submitData.department_id === '' || submitData.department_id === undefined) {
        submitData.department_id = null;
      } else {
        submitData.department_id = Number(submitData.department_id);
      }

      if (submitData.position_id === '' || submitData.position_id === undefined) {
        submitData.position_id = null;
      } else {
        submitData.position_id = Number(submitData.position_id);
      }

      submitData.career_history = normalizeCareerForm(submitData.career_history).filter(
        (row: CareerEntry) => row.company_name.length > 0
      );
      submitData.education_history = normalizeEducationForm(submitData.education_history).filter(
        (row: EducationEntry) => row.school_name.length > 0
      );
      submitData.certificate_history = normalizeCertificateForm(submitData.certificate_history).filter(
        (row: CertificateEntry) => row.name.length > 0
      );

      if (
        submitData.role === 'audit' &&
        user?.role !== 'root' &&
        !(editingUser && editingUser.role === 'audit')
      ) {
        setError(t('userManagement.auditRoleRootOnly'));
        return;
      }

      if (
        submitData.role &&
        !(editingUser && editingUser.role === submitData.role) &&
        !canAssignRole(user?.role, String(submitData.role))
      ) {
        setError(t('userManagement.roleHigherDenied'));
        return;
      }

      if (viewMode === 'create' || !editingUser) {
        // 최초 등록: 급여 보안 없음 — 입력값 그대로 저장
        const nextSalary = String(submitData.salary ?? '').trim();
        if (!nextSalary) delete submitData.salary;
      } else if (salaryUnlocked) {
        if (!salaryPasswordForSubmit) {
          openSalaryUnlock('edit');
          setError(t('userManagement.salaryUnlockHint'));
          return;
        }
        const nextSalary = String(submitData.salary ?? '').trim();
        const baseline = String(salaryBaseline ?? '').trim();
        if (!salaryAmountsDiffer(nextSalary, baseline)) {
          // 잠금 해제만 하고 값을 바꾸지 않았으면 급여 미전송 (실수 삭제/재저장 방지)
          delete submitData.salary;
        } else {
          if (!salaryApproverId) {
            setError(t('userManagement.salaryApproverRequired'));
            return;
          }
          submitData.currentPassword = salaryPasswordForSubmit;
          submitData.salary_approver_id = salaryApproverId;
        }
      } else {
        delete submitData.salary;
      }

      let savedUserId: number;
      if (editingUser) {
        // 수정 시 비밀번호가 없으면 제외
        if (!submitData.password) {
          delete submitData.password;
        }
        if (user?.role === 'root' && (formData as { company_id?: number }).company_id) {
          submitData.company_id = Number((formData as { company_id?: number }).company_id);
        } else {
          delete submitData.company_id;
        }
        const updateResponse = await api.put(`/users/${editingUser.id}`, submitData);
        savedUserId = editingUser.id;
        if (updateResponse.data?.salary_change_pending) {
          setFormData((prev) => ({ ...prev, salary: salaryBaseline }));
          setSalaryApproverId('');
          setSuccess(t('userManagement.salaryChangeRequested'));
          void loadPendingSalaryChanges();
        } else {
          setSuccess(t('userManagement.userUpdated'));
        }
      } else {
        // root가 다른 회사에 사용자를 등록하는 경우
        if (user?.role === 'root' && (formData as { company_id?: number }).company_id) {
          submitData.company_id = (formData as { company_id?: number }).company_id;
        }
        // root가 사원번호를 직접 입력하지 않으면 서버 자동 발번
        if (!(user?.role === 'root' && String(submitData.employee_number || '').trim())) {
          submitData.employee_number = '';
        } else {
          submitData.employee_number = String(submitData.employee_number).trim().toUpperCase();
        }
        const createResponse = await api.post('/users', submitData);
        savedUserId = Number(createResponse.data?.data?.id);
        setSuccess(t('userManagement.userCreated'));
      }

      if (avatarFile && Number.isFinite(savedUserId)) {
        const avatarForm = new FormData();
        avatarForm.append('avatar', avatarFile);
        const avatarResponse = await api.post(`/users/${savedUserId}/avatar`, avatarForm, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const nextAvatarUrl = avatarResponse.data?.data?.avatar_url;
        if (nextAvatarUrl && user?.id === savedUserId) {
          useStore.getState().updateUser({ avatar_url: nextAvatarUrl });
        }
      }

      if (Object.keys(careerCertificateFiles).length && Number.isFinite(savedUserId)) {
        const careerHistoryWithFiles = [...submitData.career_history];
        await Promise.all(
          Object.entries(careerCertificateFiles).map(async ([index, file]) => {
            const certificateForm = new FormData();
            certificateForm.append('certificate', file);
            const response = await api.post(`/users/${savedUserId}/career-certificate`, certificateForm, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            const row = careerHistoryWithFiles[Number(index)];
            if (row) row.certificate_url = response.data?.data?.certificate_url || '';
          })
        );
        await api.put(`/users/${savedUserId}`, { career_history: careerHistoryWithFiles });
      }

      if (Object.keys(certificateCopyFiles).length && Number.isFinite(savedUserId)) {
        const certificateHistoryWithFiles = [...submitData.certificate_history];
        await Promise.all(
          Object.entries(certificateCopyFiles).map(async ([index, file]) => {
            const certificateForm = new FormData();
            certificateForm.append('certificate', file);
            const response = await api.post(`/users/${savedUserId}/certificate-copy`, certificateForm, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            const row = certificateHistoryWithFiles[Number(index)];
            if (row) row.file_url = response.data?.data?.file_url || '';
          })
        );
        await api.put(`/users/${savedUserId}`, { certificate_history: certificateHistoryWithFiles });
      }

      resetAvatarInput();
      setCareerCertificateFiles({});
      setCertificateCopyFiles({});
      setSalaryUnlocked(false);
      setSalaryPasswordForSubmit('');
      setSalaryBaseline('');
      setSalaryApproverId('');
      setOriginalHasSalary(false);
      setPageTab(0);
      setViewMode('list');
      fetchUsers();
    } catch (error: any) {
      setError(error.response?.data?.message || t('userManagement.operationFailed'));
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'root': return 'error';
      case 'admin': return 'error';
      case 'user': return 'primary';
      case 'audit': return 'warning';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'root': return t('userManagement.roleRoot');
      case 'admin': return t('userManagement.roleAdmin');
      case 'user': return t('userManagement.roleUser');
      case 'audit': return t('userManagement.roleAudit');
      default: return role;
    }
  };

  const canAssignRole = (actorRole: string | undefined, targetRole: string) => {
    const actor = String(actorRole || '').toLowerCase();
    const target = String(targetRole || '').toLowerCase();
    if (target === 'root' || target === 'audit') return actor === 'root';
    const rank: Record<string, number> = { user: 1, admin: 2, audit: 3, root: 4 };
    return (rank[actor] || 0) >= (rank[target] || 0);
  };

  const assignableRoles = useMemo(() => {
    const all = ['user', 'admin', 'audit', 'root'] as const;
    return all.filter((r) => canAssignRole(user?.role, r));
  }, [user?.role]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('userManagement.statusActive');
      case 'inactive': return t('userManagement.statusInactive');
      case 'suspended': return t('userManagement.statusSuspended');
      default: return status;
    }
  };

  const getGenderLabel = (g: string | undefined) => {
    switch (g) {
      case 'male': return t('userManagement.genderMale');
      case 'female': return t('userManagement.genderFemale');
      case 'other': return t('userManagement.genderOther');
      default: return '';
    }
  };

  const getEmploymentTypeLabel = (type: string | undefined) => {
    switch (type) {
      case 'fulltime': return t('userManagement.empFulltime');
      case 'daily': return t('userManagement.empDaily');
      case 'service': return t('userManagement.empService');
      case 'contract': return t('userManagement.empContract');
      case 'parttime': return t('userManagement.empParttime');
      case 'intern': return t('userManagement.empIntern');
      default: return '';
    }
  };

  const hasDetailValue = (value: unknown) => {
    if (value == null) return false;
    const text = String(value).trim();
    return text.length > 0 && text !== '-' && text !== '—';
  };

  const handleDownloadPersonalRecordPdf = useCallback(async () => {
    if (!selectedUser || downloadingPersonalRecord) return;
    setDownloadingPersonalRecord(true);
    setError('');
    try {
      const su = selectedUser as any;
      const hasSalary =
        Boolean(selectedUser.has_salary) || (su.salary != null && su.salary !== '');
      const salaryDisplay =
        viewSalaryRevealed != null && viewSalaryRevealed !== ''
          ? formatSalaryInr(viewSalaryRevealed)
          : hasSalary
            ? t('userManagement.salaryMasked')
            : '';

      const companyId = Number(su.company_id) || Number(user?.company_id) || 0;
      let companyName = '';
      let companyLogoUrl = '';
      let companyContact = '';
      if (companyId > 0) {
        try {
          const company = await useReferenceDataStore.getState().fetchCompanyById(companyId);
          const info = toPayslipCompanyInfo(company);
          companyName = shortCompanyName(info.name) || info.name || '';
          companyLogoUrl = info.logo || '';
          companyContact = [info.address, info.phone, info.email]
            .filter((x) => !!String(x || '').trim())
            .join(' · ');
        } catch {
          /* ignore */
        }
      }
      if (!companyName) {
        const fromList = companies.find((c) => Number(c.id) === companyId);
        companyName = shortCompanyName(fromList?.name) || fromList?.name || '';
      }

      const sections = buildEmployeePersonalRecordSections({
        user: selectedUser,
        t,
        dateLocale,
        language: i18n.language,
        salaryDisplay,
      });

      const blob = await generateEmployeePersonalRecordPdfBlob({
        documentTitle: t('userManagement.personalRecordTitle'),
        companyName: companyName || '—',
        companyLogoUrl: companyLogoUrl || null,
        companyContact: companyContact || undefined,
        photoUrl: su.avatar_url ? getUploadUrl(su.avatar_url) || null : null,
        photoAlt: selectedUser.username,
        employeeName: selectedUser.username || selectedUser.userid || 'Employee',
        generatedAtLabel: t('userManagement.personalRecordGeneratedAt'),
        generatedAt: new Date().toLocaleDateString(dateLocale),
        sections,
      });
      downloadEmployeePersonalRecordPdf(
        blob,
        buildEmployeePersonalRecordFilename(selectedUser.username || selectedUser.userid)
      );
      setSuccess(t('userManagement.personalRecordPdfDone'));
    } catch {
      setError(t('userManagement.personalRecordPdfFailed'));
    } finally {
      setDownloadingPersonalRecord(false);
    }
  }, [
    companies,
    dateLocale,
    downloadingPersonalRecord,
    i18n.language,
    selectedUser,
    t,
    user?.company_id,
    viewSalaryRevealed,
  ]);

  const renderDetailField = (
    label: string,
    value: React.ReactNode,
    opts?: { show?: boolean; fullWidth?: boolean; valueSx?: SxProps<Theme> }
  ) => {
    if (opts?.show === false) return null;
    return (
      <Box sx={opts?.fullWidth ? { gridColumn: { xs: '1', sm: '1 / -1' } } : undefined}>
        <Typography variant="body2" sx={userDetailLabelSx}>
          {label}
        </Typography>
        <Typography variant="body1" sx={{ ...userDetailValueSx, ...(opts?.valueSx as object) }}>
          {value}
        </Typography>
      </Box>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'suspended': return 'warning';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  // 필터링된 사용자 목록 계산
  const filteredUsers = React.useMemo(() => {
    const filtered = users.filter((rowUser) => {
      if (!includeInactive && rowUser.status === 'inactive') {
        return false;
      }

      // 검색어 필터링
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const employeeNo = String((rowUser as any).employee_number || '').toLowerCase();
        return (
          rowUser.username.toLowerCase().includes(searchLower) ||
          rowUser.userid.toLowerCase().includes(searchLower) ||
          rowUser.email.toLowerCase().includes(searchLower) ||
          (employeeNo && employeeNo.includes(searchLower)) ||
          (rowUser.department && rowUser.department.toLowerCase().includes(searchLower)) ||
          (rowUser.position && rowUser.position.toLowerCase().includes(searchLower)) ||
          getStatusLabel(rowUser.status).toLowerCase().includes(searchLower)
        );
      }

      return true;
    });

    // 정렬 처리
    if (orderBy) {
      return [...filtered].sort((a, b) => {
        let aValue: any = a[orderBy as keyof User];
        let bValue: any = b[orderBy as keyof User];

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = (bValue || '').toLowerCase();
        }

        if (aValue < bValue) return order === 'asc' ? -1 : 1;
        if (aValue > bValue) return order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [users, searchTerm, orderBy, order, includeInactive, t]);

  const userStats = useMemo(() => {
    const inactiveCount = users.filter((u) => u.status === 'inactive').length;
    const activeCount = users.filter((u) => u.status === 'active').length;
    return {
      total: includeInactive ? users.length : users.filter((u) => u.status !== 'inactive').length,
      active: activeCount,
      inactive: inactiveCount,
    };
  }, [users, includeInactive]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));

  const paginatedUsers = useMemo(
    () => filteredUsers.slice((page - 1) * USERS_PER_PAGE, page * USERS_PER_PAGE),
    [filteredUsers, page]
  );

  const displayedUsers = listViewMode === 'all' ? filteredUsers : paginatedUsers;

  const visibleUserIds = useMemo(
    () => displayedUsers.map((u) => u.id),
    [displayedUsers]
  );

  const allVisibleSelected =
    visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedUsers.includes(id));
  const someVisibleSelected = visibleUserIds.some((id) => selectedUsers.includes(id));

  useEffect(() => {
    setPage(1);
    setSelectedUsers([]);
  }, [searchTerm, selectedCompanyId, includeInactive]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const rootDefaultCompanyId =
    user?.role === 'root' && loginUserCompanyId != null ? loginUserCompanyId : '';

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      includeInactive ||
      (user?.role === 'root'
        ? selectedCompanyId !== rootDefaultCompanyId
        : Boolean(selectedCompanyId))
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setIncludeInactive(false);
    setSelectedCompanyId(rootDefaultCompanyId === '' ? '' : rootDefaultCompanyId);
  };

  const closeToolbarMenu = () => setToolbarMenuAnchor(null);

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

  const handleSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const isListView = pageTab === 0 && viewMode === 'list';
  const isFormView = pageTab === 1 && (viewMode === 'create' || viewMode === 'edit');

  const handleBackToList = () => {
    setPageTab(0);
    setViewMode('list');
    setEditingUser(null);
  };

  return (
    <Box sx={{ ...mvsPageRootSx, borderRadius: 0 }}>
      <MvsPageHeader
        title={t('userManagement.title')}
        description={t('userManagement.description')}
      />

      {/* 탭 네비게이션 */}
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: isListView ? 3 : 2 }}>
          <Tabs
            value={pageTab}
            sx={{
              minHeight: 40,
              px: { xs: 1, sm: 1.5 },
              bgcolor: '#FFFFFF',
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8125rem',
                minHeight: 40,
                py: 0.75,
                letterSpacing: '-0.01em',
                color: 'text.secondary',
              },
              '& .MuiTab-root.Mui-selected': {
                color: 'primary.main',
                fontWeight: 700,
              },
              '& .MuiTab-root.Mui-disabled': {
                color: 'text.disabled',
              },
            }}
            onChange={(e, newValue) => {
              const v = newValue as 0 | 1 | 2 | 3 | 4;
              if (v === 0 && !menusLoading && !menuFlags.canRead) {
                return;
              }
              if (v === 1 && !menusLoading && !menuFlags.canCreate) {
                return;
              }
              if ((v === 2 || v === 3 || v === 4) && !menusLoading && !menuFlags.canCreate) {
                return;
              }
              if (v === 1) {
                handleCreateUser();
                return;
              }
              setPageTab(v);
              setViewMode('list');
              setEditingUser(null);
            }}
          >
            <Tab
              label={t('userManagement.userList')}
              disabled={!menusLoading && !menuFlags.canRead}
              title={
                !menusLoading && !menuFlags.canRead
                  ? t('userManagement.tabDisabledNoView')
                  : undefined
              }
            />
            <Tab
              label={t('userManagement.addUser')}
              disabled={!menusLoading && !menuFlags.canCreate}
              title={
                !menusLoading && !menuFlags.canCreate
                  ? t('userManagement.tabDisabledNoCreate')
                  : undefined
              }
            />
            <Tab
              label={t('userManagement.departmentTab')}
              disabled={!menusLoading && !menuFlags.canCreate}
              title={
                !menusLoading && !menuFlags.canCreate
                  ? t('userManagement.tabDisabledNoCreate')
                  : undefined
              }
            />
            <Tab
              label={t('userManagement.positionTab')}
              disabled={!menusLoading && !menuFlags.canCreate}
              title={
                !menusLoading && !menuFlags.canCreate
                  ? t('userManagement.tabDisabledNoCreate')
                  : undefined
              }
            />
            <Tab
              label={t('userManagement.employmentTypeTab')}
              disabled={!menusLoading && !menuFlags.canCreate}
              title={
                !menusLoading && !menuFlags.canCreate
                  ? t('userManagement.tabDisabledNoCreate')
                  : undefined
              }
            />
          </Tabs>
      </Card>

      {/* 알림 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {isListView && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: includeInactive ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
              },
              gap: 2.5,
              mb: 3,
            }}
          >
            {[
              { key: 'total', label: t('userManagement.stats.totalUsers'), value: userStats.total },
              { key: 'active', label: t('userManagement.stats.activeUsers'), value: userStats.active },
              ...(includeInactive
                ? [
                    {
                      key: 'inactive',
                      label: t('userManagement.stats.inactiveUsers'),
                      value: userStats.inactive,
                    },
                  ]
                : []),
            ].map((item) => (
              <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
                <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                    {item.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Card elevation={0} sx={mvsBodyCardSx}>
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
                {isCompactToolbar ? (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<MoreHorizIcon fontSize="small" />}
                      disabled={menusLoading}
                      onClick={(e) => setToolbarMenuAnchor(e.currentTarget)}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('userManagement.moreTools')}
                    </Button>
                    <Menu
                      anchorEl={toolbarMenuAnchor}
                      open={Boolean(toolbarMenuAnchor)}
                      onClose={closeToolbarMenu}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                      slotProps={{
                        paper: {
                          sx: {
                            mt: 0.5,
                            minWidth: 220,
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
                          },
                        },
                      }}
                    >
                      <MenuItem
                        disabled={menusLoading || !menuFlags.canRead}
                        onClick={() => {
                          closeToolbarMenu();
                          handleDownloadSample();
                        }}
                      >
                        <ListItemIcon>
                          <DownloadIcon fontSize="small" />
                        </ListItemIcon>
                        {t('userManagement.excelSample')}
                      </MenuItem>
                      <MenuItem
                        disabled={menusLoading || !menuFlags.canRead}
                        onClick={() => {
                          closeToolbarMenu();
                          handleExportExcel();
                        }}
                      >
                        <ListItemIcon>
                          <FileDownloadIcon fontSize="small" />
                        </ListItemIcon>
                        {t('userManagement.excelExport')}
                      </MenuItem>
                      <MenuItem
                        disabled={menusLoading || !menuFlags.canCreate}
                        onClick={() => {
                          closeToolbarMenu();
                          setImportDialogOpen(true);
                        }}
                      >
                        <ListItemIcon>
                          <UploadIcon fontSize="small" />
                        </ListItemIcon>
                        {t('userManagement.excelImport')}
                      </MenuItem>
                    </Menu>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon fontSize="small" />}
                      disabled={menusLoading || !menuFlags.canRead}
                      onClick={handleDownloadSample}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('userManagement.excelSample')}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadIcon fontSize="small" />}
                      disabled={menusLoading || !menuFlags.canRead}
                      onClick={handleExportExcel}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('userManagement.excelExport')}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UploadIcon fontSize="small" />}
                      disabled={menusLoading || !menuFlags.canCreate}
                      onClick={() => setImportDialogOpen(true)}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('userManagement.excelImport')}
                    </Button>
                  </>
                )}
              </Box>
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
                {selectedUsers.length > 0 ? (
                  <Button
                    variant="contained"
                    color="error"
                    disableElevation
                    size="small"
                    startIcon={<DeleteIcon fontSize="small" />}
                    disabled={menusLoading || !menuFlags.canDelete}
                    onClick={handleDeleteSelected}
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
                    {selectedUsers.every((id) => users.find((row) => row.id === id)?.status === 'inactive')
                      ? t('userManagement.purgeSelected')
                      : t('userManagement.deleteSelected')} ({selectedUsers.length})
                  </Button>
                ) : null}
                {menuFlags.canEdit ? (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      void loadPendingSalaryChanges();
                      setSalaryPendingOpen(true);
                    }}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t('userManagement.salaryApproval')}
                    {salaryPendingRows.length > 0 ? ` (${salaryPendingRows.length})` : ''}
                  </Button>
                ) : null}
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={<AddIcon fontSize="small" />}
                  disabled={menusLoading || !menuFlags.canCreate}
                  onClick={handleCreateUser}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {t('userManagement.addUser')}
                </Button>
              </Box>
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
                  sm: user?.role === 'root' ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                  lg:
                    user?.role === 'root'
                      ? 'minmax(0, 2fr) minmax(0, 1fr) auto auto auto'
                      : 'minmax(0, 2fr) auto auto auto',
                },
                gap: 2,
                alignItems: 'flex-end',
              }}
            >
              <TextField
                fullWidth
                size="small"
                label={t('common.search')}
                {...USER_FILTER_OUTLINED}
                placeholder={t('userManagement.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={menusLoading || !menuFlags.canRead}
                sx={userFilterFieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
              {user?.role === 'root' && (
                <CompanySearchSelect
                  companies={companies}
                  value={selectedCompanyId === '' ? '' : selectedCompanyId}
                  onChange={setSelectedCompanyId}
                  label={t('userManagement.company')}
                  placeholder={t('userManagement.searchCompany')}
                  allowAll
                  allLabel={t('userManagement.allCompanies')}
                  disabled={menusLoading || !menuFlags.canRead}
                  outlinedProps={USER_FILTER_OUTLINED}
                  textFieldSx={userFilterFieldSx}
                />
              )}
              <FormControlLabel
                sx={{
                  m: 0,
                  height: 40,
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  mr: 0.5,
                }}
                control={
                  <Checkbox
                    size="small"
                    checked={includeInactive}
                    onChange={(e) => {
                      setIncludeInactive(e.target.checked);
                      setPage(1);
                    }}
                    disabled={menusLoading || !menuFlags.canRead}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {t('userManagement.includeInactive')}
                  </Typography>
                }
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<ResetIcon fontSize="small" />}
                onClick={handleResetFilters}
                disabled={menusLoading || !menuFlags.canRead}
                sx={{
                  ...mvsBodyOutlinedBtnSx,
                  height: 40,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('userManagement.reset')}
              </Button>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            {loading ? (
              <Box sx={listStateBoxSx}>
                <CircularProgress size={36} />
                <Typography variant="body2" color="text.secondary">
                  {t('userManagement.empty.loading')}
                </Typography>
              </Box>
            ) : filteredUsers.length === 0 ? (
              <Box sx={listStateBoxSx}>
                <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
                  {hasActiveFilters
                    ? t('userManagement.empty.noResults')
                    : t('userManagement.empty.noItems')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                  {hasActiveFilters
                    ? !includeInactive
                      ? t('userManagement.noUsersIncludeInactive')
                      : t('userManagement.empty.noResultsHint')
                    : t('userManagement.empty.noItemsHint')}
                </Typography>
                {hasActiveFilters ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ResetIcon fontSize="small" />}
                    onClick={handleResetFilters}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t('userManagement.reset')}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    disabled={menusLoading || !menuFlags.canCreate}
                    onClick={handleCreateUser}
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {t('userManagement.addUser')}
                  </Button>
                )}
              </Box>
            ) : (
              <>
                <Box sx={listViewModeBarSx}>
                  <Button
                    size="small"
                    disableElevation
                    variant={listViewMode === 'all' ? 'contained' : 'outlined'}
                    onClick={() => setListViewMode('all')}
                    sx={{
                      ...listViewModeBtnSx,
                      ...(listViewMode === 'all'
                        ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                        : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
                    }}
                  >
                    {t('userManagement.listView.viewAll')}
                  </Button>
                  <Button
                    size="small"
                    disableElevation
                    variant={listViewMode === 'page' ? 'contained' : 'outlined'}
                    onClick={() => setListViewMode('page')}
                    sx={{
                      ...listViewModeBtnSx,
                      ...(listViewMode === 'page'
                        ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                        : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
                    }}
                  >
                    {t('userManagement.listView.viewPages')}
                  </Button>
                </Box>
                <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
                  <Table
                    size="small"
                    sx={{
                      tableLayout: 'fixed',
                      width: '100%',
                      borderCollapse: 'collapse',
                      bgcolor: 'transparent',
                      '& .MuiTableCell-root': {
                        borderLeft: 'none',
                        borderRight: 'none',
                        borderTop: 'none',
                      },
                    }}
                  >
                    <colgroup>
                      <col style={{ width: USER_LIST_COL_WIDTHS.seq }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.select }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.username }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.email }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.role }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.department }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.position }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.status }} />
                      <col style={{ width: USER_LIST_COL_WIDTHS.created_at }} />
                    </colgroup>
                    <TableHead sx={mvsTableHeadHighlightSx}>
                      <TableRow>
                        <TableCell sx={userSeqColSx} align="center" />
                        <TableCell padding="checkbox" align="center">
                          <Checkbox
                            size="small"
                            disabled={
                              menusLoading ||
                              !menuFlags.canDelete ||
                              paginatedUsers.length === 0
                            }
                            indeterminate={someVisibleSelected && !allVisibleSelected}
                            checked={allVisibleSelected}
                            onChange={handleSelectAll}
                          />
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden' }}>
                          <TableSortLabel
                            active={orderBy === 'username'}
                            direction={orderBy === 'username' ? order : 'asc'}
                            onClick={() => handleSort('username')}
                          >
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t('userManagement.name')}
                            </Box>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden' }}>
                          <TableSortLabel
                            active={orderBy === 'email'}
                            direction={orderBy === 'email' ? order : 'asc'}
                            onClick={() => handleSort('email')}
                          >
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t('userManagement.email')}
                            </Box>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden' }}>
                          <TableSortLabel
                            active={orderBy === 'role'}
                            direction={orderBy === 'role' ? order : 'asc'}
                            onClick={() => handleSort('role')}
                          >
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t('userManagement.role')}
                            </Box>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden' }}>
                          <TableSortLabel
                            active={orderBy === 'department'}
                            direction={orderBy === 'department' ? order : 'asc'}
                            onClick={() => handleSort('department')}
                          >
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t('userManagement.department')}
                            </Box>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden' }}>
                          <TableSortLabel
                            active={orderBy === 'position'}
                            direction={orderBy === 'position' ? order : 'asc'}
                            onClick={() => handleSort('position')}
                          >
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t('userManagement.position')}
                            </Box>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ ...userStatusColSx, overflow: 'hidden' }}>
                          <TableSortLabel
                            active={orderBy === 'status'}
                            direction={orderBy === 'status' ? order : 'asc'}
                            onClick={() => handleSort('status')}
                          >
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t('userManagement.status')}
                            </Box>
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ ...userCreatedColSx, overflow: 'hidden' }}>
                          <TableSortLabel
                            active={orderBy === 'created_at'}
                            direction={orderBy === 'created_at' ? order : 'asc'}
                            onClick={() => handleSort('created_at')}
                          >
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t('userManagement.createdAt')}
                            </Box>
                          </TableSortLabel>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody sx={userTableBodyRowSx}>
                      {displayedUsers.map((rowUser, index) => {
                        const rowNumber =
                          listViewMode === 'all'
                            ? index + 1
                            : (page - 1) * USERS_PER_PAGE + index + 1;
                        return (
                        <TableRow
                          key={rowUser.id}
                          onClick={() => {
                            if (!menusLoading && menuFlags.canRead) {
                              handleViewUser(rowUser);
                            }
                          }}
                          sx={{
                            cursor: menusLoading || !menuFlags.canRead ? 'default' : 'pointer',
                          }}
                        >
                          <TableCell sx={userSeqColSx} align="center">
                            <Typography variant="body2" color="text.secondary">
                              {rowNumber}
                            </Typography>
                          </TableCell>
                          <TableCell padding="checkbox" align="center" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              size="small"
                              disabled={menusLoading || !menuFlags.canDelete}
                              checked={selectedUsers.includes(rowUser.id)}
                              onChange={() => handleSelectUser(rowUser.id)}
                            />
                          </TableCell>
                          <TableCell sx={{ overflow: 'hidden' }}>
                            <Typography variant="subtitle2" fontWeight={600} noWrap title={rowUser.username}>
                              {rowUser.username}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ overflow: 'hidden' }}>
                            <Typography variant="body2" noWrap title={rowUser.email}>
                              {rowUser.email}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getRoleLabel(rowUser.role)}
                              color={getRoleColor(rowUser.role) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell sx={{ overflow: 'hidden' }}>
                            <Typography variant="body2" color="text.secondary" noWrap title={rowUser.department || '—'}>
                              {rowUser.department || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ overflow: 'hidden' }}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              noWrap
                              title={formatPositionLabel(rowUser.position, i18n.language) || '—'}
                            >
                              {formatPositionLabel(rowUser.position, i18n.language) || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={userStatusColSx}>
                            <Chip
                              label={getStatusLabel(rowUser.status)}
                              color={getStatusColor(rowUser.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                              size="small"
                              sx={userListChipSx}
                            />
                          </TableCell>
                          <TableCell sx={{ ...userCreatedColSx, color: 'text.secondary' }}>
                            {new Date(rowUser.created_at).toLocaleDateString(dateLocale)}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {listViewMode === 'page' ? (
                  <Box sx={mvsBodyPaginationSx}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={(_, value) => setPage(value)}
                      color="primary"
                      shape="rounded"
                      sx={{
                        '& .MuiPaginationItem-root': {
                          borderRadius: '10px',
                          fontWeight: 500,
                        },
                      }}
                    />
                  </Box>
                ) : (
                  <Box sx={{ ...mvsBodyPaginationSx, justifyContent: 'flex-end' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('userManagement.listView.showingAll', { count: displayedUsers.length })}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </>
      )}

      {/* 부서 관리 (탭) — 회사별 */}
      {pageTab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(user?.role === 'root' || user?.role === 'audit') && (
            <Card elevation={0} sx={mvsBodyCardSx}>
              <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, maxWidth: 420 }}>
                <CompanySearchSelect
                  companies={companies}
                  value={selectedCompanyId === '' ? '' : selectedCompanyId}
                  onChange={setSelectedCompanyId}
                  label={t('userManagement.company')}
                  placeholder={t('departmentManagement.selectCompanyFirst')}
                  outlinedProps={USER_FILTER_OUTLINED}
                  textFieldSx={userFilterFieldSx}
                />
              </Box>
            </Card>
          )}
          <DepartmentManagementPanel
            embedded
            companyId={
              user?.role === 'root' || user?.role === 'audit'
                ? selectedCompanyId === ''
                  ? null
                  : Number(selectedCompanyId)
                : user?.company_id != null
                  ? Number(user.company_id)
                  : null
            }
            canCreate={menuFlags.canCreate}
            canEdit={menuFlags.canEdit}
            canDelete={menuFlags.canDelete}
          />
        </Box>
      )}

      {/* 직책 관리 (탭) — 회사별 */}
      {pageTab === 3 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(user?.role === 'root' || user?.role === 'audit') && (
            <Card elevation={0} sx={mvsBodyCardSx}>
              <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, maxWidth: 420 }}>
                <CompanySearchSelect
                  companies={companies}
                  value={selectedCompanyId === '' ? '' : selectedCompanyId}
                  onChange={setSelectedCompanyId}
                  label={t('userManagement.company')}
                  placeholder={t('positionManagement.selectCompanyFirst')}
                  outlinedProps={USER_FILTER_OUTLINED}
                  textFieldSx={userFilterFieldSx}
                />
              </Box>
            </Card>
          )}
          <PositionManagementPanel
            embedded
            companyId={
              user?.role === 'root' || user?.role === 'audit'
                ? selectedCompanyId === ''
                  ? null
                  : Number(selectedCompanyId)
                : user?.company_id != null
                  ? Number(user.company_id)
                  : null
            }
            canCreate={menuFlags.canCreate}
            canEdit={menuFlags.canEdit}
            canDelete={menuFlags.canDelete}
          />
        </Box>
      )}

      {/* 근무형태 (탭) — 회사별 급여 계산 옵션 */}
      {pageTab === 4 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(user?.role === 'root' || user?.role === 'audit') && (
            <Card elevation={0} sx={mvsBodyCardSx}>
              <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, maxWidth: 420 }}>
                <CompanySearchSelect
                  companies={companies}
                  value={selectedCompanyId === '' ? '' : selectedCompanyId}
                  onChange={setSelectedCompanyId}
                  label={t('userManagement.company')}
                  placeholder={t('employmentTypeManagement.selectCompanyFirst')}
                  outlinedProps={USER_FILTER_OUTLINED}
                  textFieldSx={userFilterFieldSx}
                />
              </Box>
            </Card>
          )}
          <EmploymentTypeManagementPanel
            embedded
            companyId={
              user?.role === 'root' || user?.role === 'audit'
                ? selectedCompanyId === ''
                  ? null
                  : Number(selectedCompanyId)
                : user?.company_id != null
                  ? Number(user.company_id)
                  : null
            }
            canEdit={menuFlags.canEdit || menuFlags.canCreate}
          />
        </Box>
      )}

      {/* 사용자 생성/편집 폼 */}
      {isFormView && (
        <>
          <Card elevation={0} sx={mvsBodyCardSx}>
            <Box sx={mvsBodySectionHeaderSx}>
              <Typography
                component="h2"
                sx={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'text.primary',
                  lineHeight: 1.3,
                }}
              >
                {editingUser ? t('userManagement.editUserTitle') : t('userManagement.createUserTitle')}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowBackIcon fontSize="small" />}
                onClick={handleBackToList}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('userManagement.backToList')}
              </Button>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            <Box
              sx={{
                ...mvsBodyListTableSx,
                p: { xs: 2, sm: 2.5 },
                overflow: 'hidden',
                overflowX: 'auto',
              }}
            >
              <form onSubmit={handleSubmit}>
                <Box sx={userFormContainerSx}>
              {/* 기본 정보 섹션 */}
              <Accordion defaultExpanded sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userFormSectionTitleSx}>
                    {t('userManagement.sectionBasic')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 1.5,
                  }}>
                    <Box
                      sx={{
                        gridColumn: '1 / -1',
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: 1.5,
                        p: 1,
                        border: `1px dashed ${theme.palette.divider}`,
                        borderRadius: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          flexShrink: 0,
                        }}
                      >
                        <Avatar
                          src={
                            avatarPreviewUrl ||
                            (existingAvatarUrl ? getUploadUrl(existingAvatarUrl) : undefined)
                          }
                          alt={formData.username}
                          sx={{ width: 88, height: 88, bgcolor: 'action.selected' }}
                        >
                          <PersonIcon sx={{ fontSize: 44 }} />
                        </Avatar>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                          <Typography variant="subtitle2">
                            {t('userManagement.profilePhoto')}
                          </Typography>
                          <Button
                            component="label"
                            variant="outlined"
                            size="small"
                            startIcon={<PhotoCameraIcon />}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            {avatarFile
                              ? t('userManagement.changePhoto')
                              : t('userManagement.selectPhoto')}
                            <input
                              hidden
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={handleAvatarSelect}
                            />
                          </Button>
                          <Typography variant="caption" color="text.secondary">
                            {avatarFile?.name || t('userManagement.avatarHelper')}
                          </Typography>
                        </Box>
                      </Box>
                      {user?.role === 'root' ? (
                        <Box
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            width: '100%',
                            p: 1,
                            borderRadius: 1,
                            border: '2px solid',
                            borderColor: 'error.main',
                            bgcolor: (t) =>
                              t.palette.mode === 'light' ? 'rgba(211, 47, 47, 0.06)' : 'rgba(211, 47, 47, 0.16)',
                          }}
                        >
                          <CompanySearchSelect
                            companies={companies}
                            value={(formData as { company_id?: number }).company_id || ''}
                            onChange={(company_id) => {
                              setFormData({
                                ...formData,
                                company_id: company_id === '' ? undefined : company_id,
                                department_id: '',
                                department: '',
                                position_id: '',
                                position: '',
                              } as typeof formData);
                            }}
                            label={t('userManagement.companySelect')}
                            placeholder={t('userManagement.searchCompany')}
                            required
                            error
                            helperText={t('userManagement.companySelectRootHint')}
                            outlinedProps={OUTLINED_FIELD}
                            textFieldSx={{
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': { borderColor: 'error.main', borderWidth: 1.5 },
                                '&:hover fieldset': { borderColor: 'error.dark' },
                                '&.Mui-focused fieldset': { borderColor: 'error.main' },
                              },
                              '& .MuiInputLabel-root': { color: 'error.main' },
                              '& .MuiInputLabel-root.Mui-focused': { color: 'error.main' },
                              '& .MuiFormHelperText-root': {
                                color: 'error.main',
                                mx: 0,
                                mt: 0.75,
                                fontWeight: 600,
                              },
                            }}
                          />
                        </Box>
                      ) : null}
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.employeeNumber')}
                      {...OUTLINED_FIELD}
                      value={
                        previewEmployeeNumberLoading && !editingUser
                          ? t('common.loading')
                          : formData.employee_number
                      }
                      onChange={(e) => {
                        if (user?.role !== 'root') return;
                        setFormData({
                          ...formData,
                          employee_number: e.target.value.toUpperCase(),
                        });
                      }}
                      inputProps={{ style: { textTransform: 'uppercase' } }}
                      disabled={user?.role !== 'root'}
                      helperText={
                        user?.role === 'root'
                          ? editingUser
                            ? t('userManagement.helperEmployeeRootEditable')
                            : t('userManagement.helperEmployeeRootCreate')
                          : !editingUser
                            ? t('userManagement.helperEmployeeAuto')
                            : ''
                      }
                      sx={{
                        '& .MuiInputBase-input.Mui-disabled': {
                          WebkitTextFillColor: theme.palette.text.primary,
                          color: 'text.primary',
                        },
                      }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.name')}
                      {...OUTLINED_FIELD}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label={t('userManagement.dateOfBirth')}
                      {...OUTLINED_FIELD}
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label={t('userManagement.gender')}
                      {...OUTLINED_FIELD}
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      SelectProps={{ displayEmpty: true }}
                    >
                      <MenuItem value="">{t('userManagement.selectPlaceholder')}</MenuItem>
                      <MenuItem value="male">{t('userManagement.genderMale')}</MenuItem>
                      <MenuItem value="female">{t('userManagement.genderFemale')}</MenuItem>
                      <MenuItem value="other">{t('userManagement.genderOther')}</MenuItem>
                    </TextField>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.phoneNumber')}
                      {...OUTLINED_FIELD}
                      value={formatPhoneDisplay(formData.phone)}
                      onChange={(e) => setFormData({ ...formData, phone: normalizePhoneDigits(e.target.value) })}
                      placeholder={t('userManagement.phonePlaceholder')}
                      inputProps={{ inputMode: 'numeric', maxLength: 11, autoComplete: 'off' }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      type="email"
                      label={t('userManagement.email')}
                      {...OUTLINED_FIELD}
                      value={formData.email}
                      onChange={(e) => {
                        const email = e.target.value;
                        setFormData({
                          ...formData,
                          email,
                          ...(!editingUser ? { userid: email.toLowerCase() } : {})
                        });
                      }}
                      required
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.address')}
                      {...OUTLINED_FIELD}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.emergencyContactName')}
                      {...OUTLINED_FIELD}
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      placeholder={t('userManagement.placeholderEmergencyName')}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.emergencyContactPhone')}
                      {...OUTLINED_FIELD}
                      value={formatPhoneDisplay(formData.emergency_phone)}
                      onChange={(e) => setFormData({ ...formData, emergency_phone: normalizePhoneDigits(e.target.value) })}
                      placeholder={t('userManagement.phonePlaceholder')}
                      inputProps={{ inputMode: 'numeric', maxLength: 11, autoComplete: 'off' }}
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 인사 정보 섹션 — 신규 등록·수정 시 기본 펼침 */}
              <Accordion
                key={viewMode === 'create' ? 'hr-create' : 'hr-edit'}
                defaultExpanded={viewMode === 'create' || viewMode === 'edit'}
                sx={getAccordionFormSx(theme)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userFormSectionTitleSx}>
                    {t('userManagement.sectionHr')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                      gap: 1.5,
                      alignItems: 'start',
                      width: '100%',
                    }}
                  >
                    {/* 1행: 입사일 | 근무형태 */}
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label={t('userManagement.hireDate')}
                      {...OUTLINED_FIELD}
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label={t('userManagement.employmentType')}
                      {...OUTLINED_FIELD}
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                      SelectProps={{
                        displayEmpty: true,
                        MenuProps: {
                          PaperProps: {
                            sx: { maxHeight: 320, '& .MuiMenuItem-root': { fontSize: '0.8125rem' } },
                          },
                          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                          transformOrigin: { vertical: 'top', horizontal: 'left' },
                        },
                      }}
                    >
                      <MenuItem value="fulltime">{t('userManagement.empFulltime')}</MenuItem>
                      <MenuItem value="daily">{t('userManagement.empDaily')}</MenuItem>
                      <MenuItem value="service">{t('userManagement.empService')}</MenuItem>
                      <MenuItem value="contract">{t('userManagement.empContract')}</MenuItem>
                      <MenuItem value="parttime">{t('userManagement.empParttime')}</MenuItem>
                      <MenuItem value="intern">{t('userManagement.empIntern')}</MenuItem>
                    </TextField>

                    {/* 2행: 급여 | 부서 — 신규 등록은 잠금 없이 입력 */}
                    <Box sx={{ ...highlightPayrollFieldsSx, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                      {viewMode === 'create' ? (
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label={t('userManagement.salary')}
                          {...OUTLINED_FIELD}
                          value={formData.salary}
                          onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                          placeholder={t('userManagement.placeholderMonthlySalary')}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <Typography sx={{ fontSize: '0.75rem' }}>INR</Typography>
                              </InputAdornment>
                            ),
                          }}
                        />
                      ) : (
                        <Box>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          label={t('userManagement.salary')}
                          {...OUTLINED_FIELD}
                          value={salaryUnlocked ? formData.salary : ''}
                          onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                          placeholder={
                            salaryUnlocked
                              ? t('userManagement.placeholderMonthlySalary')
                              : originalHasSalary || formData.salary
                                ? t('userManagement.salaryMasked')
                                : t('userManagement.salaryLockedHint')
                          }
                          disabled={!salaryUnlocked}
                          helperText={
                            salaryDraftChanged
                              ? t('userManagement.salaryApproverHint')
                              : salaryUnlocked
                                ? undefined
                                : t('userManagement.salaryUnlockHint')
                          }
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <Typography sx={{ fontSize: '0.75rem', mr: 0.5 }}>INR</Typography>
                                {editingUser ? (
                                  <IconButton
                                    size="small"
                                    edge="end"
                                    aria-label={t('userManagement.salaryHistory')}
                                    onClick={() => void openSalaryHistory(editingUser.id)}
                                  >
                                    <HistoryIcon fontSize="small" />
                                  </IconButton>
                                ) : null}
                                <IconButton
                                  size="small"
                                  edge="end"
                                  aria-label={t('userManagement.salaryUnlock')}
                                  onClick={() => {
                                    if (salaryUnlocked) {
                                      setSalaryUnlocked(false);
                                      setSalaryPasswordForSubmit('');
                                      setSalaryBaseline('');
                                      setFormData((prev) => ({ ...prev, salary: '' }));
                                    } else {
                                      openSalaryUnlock('edit');
                                    }
                                  }}
                                >
                                  {salaryUnlocked ? (
                                    <VisibilityOffIcon fontSize="small" />
                                  ) : (
                                    <LockOutlinedIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                        {salaryDraftChanged ? (
                          <TextField
                            select
                            fullWidth
                            size="small"
                            sx={{ mt: 1.5 }}
                            label={t('userManagement.salaryApprover')}
                            {...OUTLINED_FIELD}
                            value={salaryApproverId === '' ? '' : String(salaryApproverId)}
                            onChange={(e) =>
                              setSalaryApproverId(e.target.value ? Number(e.target.value) : '')
                            }
                          >
                            {salaryApprovers.map((person) => (
                              <MenuItem key={person.id} value={String(person.id)}>
                                {person.name}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : null}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ width: '100%', minWidth: 0 }}>
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label={t('userManagement.department')}
                        {...OUTLINED_FIELD}
                        value={formData.department_id === '' ? '' : String(formData.department_id)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') {
                            setFormData({ ...formData, department_id: '', department: '' });
                          } else {
                            const id = Number(v);
                            const d = departments.find((x) => x.id === id);
                            setFormData({
                              ...formData,
                              department_id: id,
                              department: d?.name || '',
                            });
                          }
                        }}
                        SelectProps={{
                          displayEmpty: true,
                          renderValue: (selected) => {
                            if (selected === '') {
                              return (
                                <Typography
                                  component="span"
                                  color="text.secondary"
                                  sx={{ fontStyle: 'italic', fontSize: '0.8125rem' }}
                                >
                                  {t('departmentManagement.noDepartment')}
                                </Typography>
                              );
                            }
                            const d = departments.find((x) => String(x.id) === selected);
                            return d?.name ?? '';
                          },
                          MenuProps: {
                            PaperProps: {
                              sx: { maxHeight: 320, '& .MuiMenuItem-root': { fontSize: '0.8125rem' } },
                            },
                            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                            transformOrigin: { vertical: 'top', horizontal: 'left' },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>{t('departmentManagement.noDepartment')}</em>
                        </MenuItem>
                        {departments.map((d) => (
                          <MenuItem key={d.id} value={String(d.id)}>
                            {d.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Typography color="text.secondary" sx={hrHintSx}>
                        {t('userManagement.deptFromMasterHint')}
                      </Typography>
                    </Box>

                    {/* 3행: 직책 | PF 선택 */}
                    <Box sx={{ width: '100%', minWidth: 0 }}>
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label={t('userManagement.positionTitle')}
                        {...OUTLINED_FIELD}
                        value={formData.position_id === '' ? '' : String(formData.position_id)}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '') {
                            setFormData({ ...formData, position_id: '', position: '' });
                          } else {
                            const id = Number(v);
                            const p = positions.find((x) => x.id === id);
                            setFormData({
                              ...formData,
                              position_id: id,
                              position: p?.name || '',
                            });
                          }
                        }}
                        SelectProps={{
                          displayEmpty: true,
                          renderValue: (selected) => {
                            if (selected === '') {
                              return (
                                <Typography
                                  component="span"
                                  color="text.secondary"
                                  sx={{ fontStyle: 'italic', fontSize: '0.8125rem' }}
                                >
                                  {t('positionManagement.noPosition')}
                                </Typography>
                              );
                            }
                            const p = positions.find((x) => String(x.id) === selected);
                            const label = p?.name ?? formData.position ?? '';
                            return formatPositionLabel(label, i18n.language) || label;
                          },
                          MenuProps: {
                            PaperProps: {
                              sx: { maxHeight: 320, '& .MuiMenuItem-root': { fontSize: '0.8125rem' } },
                            },
                            anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                            transformOrigin: { vertical: 'top', horizontal: 'left' },
                          },
                        }}
                      >
                        <MenuItem value="">
                          <em>{t('positionManagement.noPosition')}</em>
                        </MenuItem>
                        {positions.map((p, idx) => (
                          <MenuItem key={p.id} value={String(p.id)}>
                            {t('positionManagement.rankBadge', { level: idx + 1 })} ·{' '}
                            {formatPositionLabel(p.name, i18n.language)}
                          </MenuItem>
                        ))}
                        {formData.position_id !== '' &&
                          !positions.some((p) => p.id === formData.position_id) &&
                          formData.position && (
                            <MenuItem value={String(formData.position_id)}>
                              {formatPositionLabel(formData.position, i18n.language)}
                            </MenuItem>
                          )}
                      </TextField>
                      <Typography color="text.secondary" sx={hrHintSx}>
                        {t('userManagement.positionFromMasterHint')}
                      </Typography>
                    </Box>
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label={t('userManagement.pfCap')}
                      {...OUTLINED_FIELD}
                      value={formData.pf_calc_mode || 'cap_1800'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pf_calc_mode: e.target.value as
                            | 'cap_1800'
                            | 'basic_12pct'
                            | 'total_12pct'
                            | 'none',
                        })
                      }
                    >
                      <MenuItem value="cap_1800">{t('userManagement.pfCap1800')}</MenuItem>
                      <MenuItem value="basic_12pct">{t('userManagement.pfCap12pct')}</MenuItem>
                      <MenuItem value="total_12pct">{t('userManagement.pfCapTotal12pct')}</MenuItem>
                      <MenuItem value="none">{t('userManagement.pfCapNone')}</MenuItem>
                    </TextField>

                    <FormControlLabel
                      sx={{ m: 0, alignSelf: 'center' }}
                      control={
                        <Checkbox
                          checked={Boolean(formData.ot_eligible)}
                          onChange={(e) => setFormData({ ...formData, ot_eligible: e.target.checked })}
                        />
                      }
                      label={t('userManagement.otEligible')}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <FormControlLabel
                        sx={{ m: 0 }}
                        control={
                          <Checkbox
                            checked={formData.pt_eligible !== false}
                            onChange={(e) =>
                              setFormData({ ...formData, pt_eligible: e.target.checked })
                            }
                          />
                        }
                        label={t('userManagement.ptEligible')}
                      />
                      <Typography color="text.secondary" sx={hrHintSx}>
                        {companyPtStateCode
                          ? t('userManagement.ptEligibleHintWithState', {
                              state: indianStateLabel(companyPtStateCode),
                              code: companyPtStateCode,
                            })
                          : t('userManagement.ptEligibleHint')}
                      </Typography>
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 경력 정보 */}
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userFormSectionTitleSx}>
                    {t('userManagement.sectionCareer')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                    {t('userManagement.careerHint')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(formData.career_history || []).map((entry, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          border: `1px solid ${theme.palette.divider}`,
                          p: 1,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                          gap: 1.5,
                        }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          label={t('userManagement.careerCompany')}
                          {...OUTLINED_FIELD}
                          value={entry.company_name}
                          onChange={(e) => {
                            const next = [...formData.career_history];
                            next[idx] = { ...next[idx], company_name: e.target.value };
                            setFormData({ ...formData, career_history: next });
                          }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label={t('userManagement.careerPosition')}
                          {...OUTLINED_FIELD}
                          value={entry.position}
                          onChange={(e) => {
                            const next = [...formData.career_history];
                            next[idx] = { ...next[idx], position: e.target.value };
                            setFormData({ ...formData, career_history: next });
                          }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label={t('userManagement.careerStartDate')}
                          {...OUTLINED_FIELD}
                          value={entry.start_date}
                          onChange={(e) => {
                            const next = [...formData.career_history];
                            next[idx] = { ...next[idx], start_date: e.target.value };
                            setFormData({ ...formData, career_history: next });
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label={t('userManagement.careerEndDate')}
                          {...OUTLINED_FIELD}
                          value={entry.end_date}
                          onChange={(e) => {
                            const next = [...formData.career_history];
                            next[idx] = { ...next[idx], end_date: e.target.value };
                            setFormData({ ...formData, career_history: next });
                          }}
                          InputLabelProps={{ shrink: true }}
                          helperText={t('userManagement.careerEndDateHint')}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          minRows={2}
                          label={t('userManagement.careerDescription')}
                          {...OUTLINED_FIELD}
                          value={entry.description}
                          onChange={(e) => {
                            const next = [...formData.career_history];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setFormData({ ...formData, career_history: next });
                          }}
                          sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}
                        />
                        <Box
                          sx={{
                            gridColumn: { xs: '1', sm: '1 / -1' },
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Button
                            component="label"
                            size="small"
                            variant="outlined"
                            startIcon={<AttachFileIcon fontSize="small" />}
                          >
                            {t('userManagement.careerCertificateAttach')}
                            <input
                              hidden
                              type="file"
                              accept=".pdf,image/jpeg,image/png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setCareerCertificateFiles((prev) => ({ ...prev, [idx]: file }));
                                }
                              }}
                            />
                          </Button>
                          {careerCertificateFiles[idx]?.name ? (
                            <Typography variant="caption" color="text.secondary">
                              {careerCertificateFiles[idx].name}
                            </Typography>
                          ) : entry.certificate_url ? (
                            <Button
                              size="small"
                              component="a"
                              href={getUploadUrl(entry.certificate_url)}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<OpenInNewIcon fontSize="small" />}
                            >
                              {t('userManagement.careerCertificateView')}
                            </Button>
                          ) : null}
                        </Box>
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon fontSize="small" />}
                            onClick={() =>
                              setFormData({
                                ...formData,
                                career_history: formData.career_history.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            {t('userManagement.careerRemove')}
                          </Button>
                        </Box>
                      </Box>
                    ))}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon fontSize="small" />}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          career_history: [...(formData.career_history || []), emptyCareerEntry()],
                        })
                      }
                      sx={{ alignSelf: 'flex-start', ...mvsBodyOutlinedBtnSx }}
                    >
                      {t('userManagement.careerAdd')}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 학력 정보 */}
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userFormSectionTitleSx}>
                    {t('userManagement.sectionEducation')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                    {t('userManagement.educationHint')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(formData.education_history || []).map((entry, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          border: `1px solid ${theme.palette.divider}`,
                          p: 1,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                          gap: 1.5,
                        }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          label={t('userManagement.educationSchool')}
                          {...OUTLINED_FIELD}
                          value={entry.school_name}
                          onChange={(e) => {
                            const next = [...formData.education_history];
                            next[idx] = { ...next[idx], school_name: e.target.value };
                            setFormData({ ...formData, education_history: next });
                          }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label={t('userManagement.educationDegree')}
                          {...OUTLINED_FIELD}
                          value={entry.degree}
                          onChange={(e) => {
                            const next = [...formData.education_history];
                            next[idx] = { ...next[idx], degree: e.target.value };
                            setFormData({ ...formData, education_history: next });
                          }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label={t('userManagement.educationMajor')}
                          {...OUTLINED_FIELD}
                          value={entry.major}
                          onChange={(e) => {
                            const next = [...formData.education_history];
                            next[idx] = { ...next[idx], major: e.target.value };
                            setFormData({ ...formData, education_history: next });
                          }}
                          sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label={t('userManagement.educationStartDate')}
                          {...OUTLINED_FIELD}
                          value={entry.start_date}
                          onChange={(e) => {
                            const next = [...formData.education_history];
                            next[idx] = { ...next[idx], start_date: e.target.value };
                            setFormData({ ...formData, education_history: next });
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label={t('userManagement.educationEndDate')}
                          {...OUTLINED_FIELD}
                          value={entry.end_date}
                          onChange={(e) => {
                            const next = [...formData.education_history];
                            next[idx] = { ...next[idx], end_date: e.target.value };
                            setFormData({ ...formData, education_history: next });
                          }}
                          InputLabelProps={{ shrink: true }}
                          helperText={t('userManagement.educationEndDateHint')}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          minRows={2}
                          label={t('userManagement.educationDescription')}
                          {...OUTLINED_FIELD}
                          value={entry.description}
                          onChange={(e) => {
                            const next = [...formData.education_history];
                            next[idx] = { ...next[idx], description: e.target.value };
                            setFormData({ ...formData, education_history: next });
                          }}
                          sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}
                        />
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon fontSize="small" />}
                            onClick={() =>
                              setFormData({
                                ...formData,
                                education_history: formData.education_history.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            {t('userManagement.educationRemove')}
                          </Button>
                        </Box>
                      </Box>
                    ))}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon fontSize="small" />}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          education_history: [...(formData.education_history || []), emptyEducationEntry()],
                        })
                      }
                      sx={{ alignSelf: 'flex-start', ...mvsBodyOutlinedBtnSx }}
                    >
                      {t('userManagement.educationAdd')}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 자격증 정보 */}
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userFormSectionTitleSx}>
                    {t('userManagement.sectionCertificate')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                    {t('userManagement.certificateHint')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(formData.certificate_history || []).map((entry, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          border: `1px solid ${theme.palette.divider}`,
                          p: 1,
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                          gap: 1.5,
                        }}
                      >
                        {([
                          ['name', 'certificateName'],
                          ['issuer', 'certificateIssuer'],
                          ['certificate_number', 'certificateNumber'],
                        ] as const).map(([field, label]) => (
                          <TextField
                            key={field}
                            fullWidth
                            size="small"
                            label={t(`userManagement.${label}`)}
                            {...OUTLINED_FIELD}
                            value={entry[field]}
                            onChange={(e) => {
                              const next = [...formData.certificate_history];
                              next[idx] = { ...next[idx], [field]: e.target.value };
                              setFormData({ ...formData, certificate_history: next });
                            }}
                            sx={field === 'certificate_number' ? { gridColumn: { xs: '1', sm: '1 / -1' } } : undefined}
                          />
                        ))}
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label={t('userManagement.certificateIssueDate')}
                          {...OUTLINED_FIELD}
                          value={entry.issue_date}
                          onChange={(e) => {
                            const next = [...formData.certificate_history];
                            next[idx] = { ...next[idx], issue_date: e.target.value };
                            setFormData({ ...formData, certificate_history: next });
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          type="date"
                          label={t('userManagement.certificateExpiryDate')}
                          {...OUTLINED_FIELD}
                          value={entry.expiry_date}
                          onChange={(e) => {
                            const next = [...formData.certificate_history];
                            next[idx] = { ...next[idx], expiry_date: e.target.value };
                            setFormData({ ...formData, certificate_history: next });
                          }}
                          InputLabelProps={{ shrink: true }}
                        />
                        <Box
                          sx={{
                            gridColumn: { xs: '1', sm: '1 / -1' },
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Button
                            component="label"
                            size="small"
                            variant="outlined"
                            startIcon={<AttachFileIcon fontSize="small" />}
                          >
                            {t('userManagement.certificateCopyAttach')}
                            <input
                              hidden
                              type="file"
                              accept=".pdf,image/jpeg,image/png"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setCertificateCopyFiles((prev) => ({ ...prev, [idx]: file }));
                                }
                              }}
                            />
                          </Button>
                          {certificateCopyFiles[idx]?.name ? (
                            <Typography variant="caption" color="text.secondary">
                              {certificateCopyFiles[idx].name}
                            </Typography>
                          ) : entry.file_url ? (
                            <Button
                              size="small"
                              component="a"
                              href={getUploadUrl(entry.file_url)}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<OpenInNewIcon fontSize="small" />}
                            >
                              {t('userManagement.certificateCopyView')}
                            </Button>
                          ) : null}
                        </Box>
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon fontSize="small" />}
                            onClick={() => {
                              setCertificateCopyFiles((prev) => {
                                const next = { ...prev };
                                delete next[idx];
                                return next;
                              });
                              setFormData({
                                ...formData,
                                certificate_history: formData.certificate_history.filter((_, i) => i !== idx),
                              });
                            }}
                          >
                            {t('userManagement.certificateRemove')}
                          </Button>
                        </Box>
                      </Box>
                    ))}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon fontSize="small" />}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          certificate_history: [...(formData.certificate_history || []), emptyCertificateEntry()],
                        })
                      }
                      sx={{ alignSelf: 'flex-start', ...mvsBodyOutlinedBtnSx }}
                    >
                      {t('userManagement.certificateAdd')}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 개인 은행 계좌 */}
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userFormSectionTitleSx}>
                    {t('userManagement.sectionBank')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={highlightBankFieldsSx}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.bankName')}
                      {...OUTLINED_FIELD}
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder={t('userManagement.bankNamePlaceholder')}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.accountNumber')}
                      {...OUTLINED_FIELD}
                      value={formatBankAccountDisplay(formData.bank_account)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bank_account: normalizeBankAccountDigits(e.target.value)
                        })
                      }
                      placeholder={t('userManagement.accountPlaceholder')}
                      inputProps={{ inputMode: 'numeric', autoComplete: 'off' }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.ifscCode')}
                      {...OUTLINED_FIELD}
                      value={formatIfscDisplay(formData.bank_ifsc)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bank_ifsc: normalizeIfsc(e.target.value)
                        })
                      }
                      placeholder={t('userManagement.ifscPlaceholder')}
                      inputProps={{ maxLength: 14, autoComplete: 'off' }}
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 계정 정보 섹션 */}
              <Accordion defaultExpanded sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userFormSectionTitleSx}>
                    {t('userManagement.sectionAccount')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 1.5,
                  }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('userManagement.userId')}
                      {...OUTLINED_FIELD}
                      value={formData.userid}
                      onChange={(e) =>
                        setFormData({ ...formData, userid: e.target.value.toLowerCase() })
                      }
                      required
                      disabled={!!editingUser && user?.role !== 'root'}
                      helperText={t('userManagement.userIdLowercaseOnly')}
                      inputProps={{ autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }}
                      sx={{
                        '& .MuiInputBase-input': { textTransform: 'lowercase' },
                      }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      type="password"
                      label={t('userManagement.password')}
                      {...OUTLINED_FIELD}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                      placeholder={editingUser ? t('userManagement.passwordPlaceholderEdit') : t('userManagement.passwordPlaceholderNew')}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label={t('userManagement.roleLabel')}
                      {...OUTLINED_FIELD}
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                      SelectProps={{ displayEmpty: true }}
                    >
                      {assignableRoles.map((r) => (
                        <MenuItem key={r} value={r}>
                          {r === 'root' ? 'Root' : getRoleLabel(r)}
                        </MenuItem>
                      ))}
                      {editingUser && !canAssignRole(user?.role, editingUser.role) && (
                        <MenuItem value={editingUser.role} disabled>
                          {editingUser.role === 'root' ? 'Root' : getRoleLabel(editingUser.role)}
                        </MenuItem>
                      )}
                    </TextField>
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label={t('userManagement.statusLabel')}
                      {...OUTLINED_FIELD}
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      SelectProps={{ displayEmpty: true }}
                    >
                      <MenuItem value="active">{t('userManagement.statusActive')}</MenuItem>
                      <MenuItem value="inactive">{t('userManagement.statusInactive')}</MenuItem>
                      <MenuItem value="suspended">{t('userManagement.statusSuspended')}</MenuItem>
                    </TextField>
                    <Box>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean((formData as any).is_payment_officer)}
                            onChange={(e) => setFormData({ ...formData, is_payment_officer: e.target.checked })}
                          />
                        }
                        label={t('userManagement.paymentOfficerAssign')}
                      />
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 1.5,
                    mt: 2.5,
                    pt: 2,
                    borderTop: '1px solid #E8EDF3',
                  }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleBackToList}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disableElevation
                    size="small"
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {editingUser ? t('userManagement.submitEdit') : t('userManagement.submitRegister')}
                  </Button>
                </Box>
              </form>
            </Box>
          </Box>
        </>
      )}

      {/* 사용자 상세 보기 다이얼로그 */}
      <Dialog 
        open={openViewDialog} 
        onClose={() => setOpenViewDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { maxHeight: '90vh', borderRadius: '8px' }
        }}
      >
        <DialogTitle sx={{ pt: 2.5, px: 3, pb: 1.5 }}>
          <Typography
            component="span"
            sx={{
              fontWeight: 700,
              fontSize: '1.125rem',
              letterSpacing: '-0.02em',
              color:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.95)
                  : theme.palette.grey[900],
            }}
          >
            {t('userManagement.userDetailTitle')}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {selectedUser && (() => {
            const su = selectedUser as any;
            const genderLabel = getGenderLabel(su.gender);
            const phoneDisplay = formatPhoneDisplay(su.phone || '');
            const emergencyPhoneDisplay = formatPhoneDisplay(su.emergency_phone || '');
            const hireDateDisplay = su.hire_date
              ? new Date(su.hire_date).toLocaleDateString(dateLocale)
              : '';
            const birthDateDisplay = su.birth_date
              ? new Date(su.birth_date).toLocaleDateString(dateLocale)
              : '';
            const employmentLabel = getEmploymentTypeLabel(su.employment_type);
            const positionLabel = formatPositionLabel(selectedUser.position, i18n.language);
            const hasSalary =
              Boolean(selectedUser.has_salary) ||
              (su.salary != null && su.salary !== '');
            const careers = normalizeCareerForm(su.career_history).filter((c) => c.company_name);
            const educations = normalizeEducationForm(su.education_history).filter((e) => e.school_name);
            const certificates = normalizeCertificateForm(su.certificate_history).filter((c) => c.name);
            const hasBank =
              hasDetailValue(su.bank_name) ||
              hasDetailValue(su.bank_account) ||
              hasDetailValue(su.bank_ifsc);
            const hasHr =
              hasDetailValue(hireDateDisplay) ||
              hasDetailValue(employmentLabel) ||
              hasDetailValue(selectedUser.department) ||
              hasDetailValue(positionLabel) ||
              hasSalary;

            return (
            <Box>
              <Accordion defaultExpanded sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userDetailSectionTitleSx}>
                    {t('userManagement.sectionBasic')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 2.25,
                  }}>
                    {su.avatar_url ? (
                      <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                        <Typography variant="body2" sx={userDetailLabelSx}>
                          {t('userManagement.profilePhoto')}
                        </Typography>
                        {(() => {
                          const photoUrl = getUploadUrl(su.avatar_url);
                          return (
                            <Avatar
                              src={photoUrl || undefined}
                              alt={selectedUser.username}
                              onClick={() => {
                                if (photoUrl) setPhotoPreviewUrl(photoUrl);
                              }}
                              sx={{
                                width: 96,
                                height: 96,
                                mt: 1,
                                bgcolor: 'action.selected',
                                fontSize: '2rem',
                                cursor: photoUrl ? 'zoom-in' : 'default',
                                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                                ...(photoUrl
                                  ? {
                                      '&:hover': {
                                        boxShadow: 4,
                                        transform: 'scale(1.03)',
                                      },
                                    }
                                  : {}),
                              }}
                            >
                              {selectedUser.username?.trim().charAt(0).toUpperCase()}
                            </Avatar>
                          );
                        })()}
                      </Box>
                    ) : null}
                    {renderDetailField(
                      t('userManagement.employeeNumber'),
                      su.employee_number ? String(su.employee_number).toUpperCase() : su.employee_number,
                      {
                        show: hasDetailValue(su.employee_number),
                      }
                    )}
                    {renderDetailField(t('userManagement.name'), selectedUser.username, {
                      show: hasDetailValue(selectedUser.username),
                      valueSx: { fontWeight: 600 },
                    })}
                    {renderDetailField(t('userManagement.dateOfBirth'), birthDateDisplay, {
                      show: hasDetailValue(birthDateDisplay),
                    })}
                    {renderDetailField(t('userManagement.gender'), genderLabel, {
                      show: hasDetailValue(genderLabel),
                    })}
                    {renderDetailField(t('userManagement.phoneNumber'), phoneDisplay, {
                      show: hasDetailValue(phoneDisplay),
                    })}
                    {renderDetailField(t('userManagement.email'), selectedUser.email, {
                      show: hasDetailValue(selectedUser.email),
                    })}
                    {su.is_payment_officer ? (
                      <Box>
                        <Typography variant="body2" sx={userDetailLabelSx}>
                          {t('userManagement.paymentOfficer')}
                        </Typography>
                        <FormControlLabel
                          control={<Checkbox checked disabled />}
                          label={t('userManagement.paymentOfficerAssigned')}
                        />
                      </Box>
                    ) : null}
                    {renderDetailField(t('userManagement.address'), su.address, {
                      show: hasDetailValue(su.address),
                      fullWidth: true,
                    })}
                    {renderDetailField(t('userManagement.emergencyContactName'), su.emergency_contact, {
                      show: hasDetailValue(su.emergency_contact),
                    })}
                    {renderDetailField(
                      t('userManagement.emergencyContactPhone'),
                      emergencyPhoneDisplay,
                      { show: hasDetailValue(emergencyPhoneDisplay) }
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {hasHr ? (
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userDetailSectionTitleSx}>
                    {t('userManagement.sectionHr')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 2.25,
                  }}>
                    {renderDetailField(t('userManagement.hireDate'), hireDateDisplay, {
                      show: hasDetailValue(hireDateDisplay),
                    })}
                    {renderDetailField(t('userManagement.employmentType'), employmentLabel, {
                      show: hasDetailValue(employmentLabel),
                    })}
                    {hasSalary ? (
                      <Box>
                        <Typography variant="body2" sx={userDetailLabelSx}>
                          {t('userManagement.salary')}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body1" sx={userDetailValueSx}>
                            {viewSalaryRevealed != null && viewSalaryRevealed !== ''
                              ? formatSalaryInr(viewSalaryRevealed)
                              : t('userManagement.salaryMasked')}
                          </Typography>
                          {viewSalaryRevealed != null && viewSalaryRevealed !== '' ? (
                            <IconButton
                              size="small"
                              aria-label={t('personalSettings.salaryHide')}
                              onClick={() => setViewSalaryRevealed(null)}
                              sx={{ p: 0.25 }}
                            >
                              <VisibilityOffIcon fontSize="small" />
                            </IconButton>
                          ) : (
                            <IconButton
                              size="small"
                              aria-label={t('personalSettings.salaryReveal')}
                              onClick={() => openSalaryUnlock('view')}
                              sx={{ p: 0.25 }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            aria-label={t('userManagement.salaryHistory')}
                            onClick={() => void openSalaryHistory(selectedUser.id)}
                            sx={{ p: 0.25 }}
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : null}
                    {renderDetailField(t('userManagement.department'), selectedUser.department, {
                      show: hasDetailValue(selectedUser.department),
                    })}
                    {renderDetailField(t('userManagement.positionTitle'), positionLabel, {
                      show: hasDetailValue(positionLabel),
                    })}
                    <Box>
                      <Typography variant="body2" sx={userDetailLabelSx}>
                        {t('userManagement.pfCap')}
                      </Typography>
                      <Typography variant="body1" sx={userDetailValueSx}>
                        {(() => {
                          const m = String(su.pf_calc_mode ?? '').trim();
                          if (m === 'none') return t('userManagement.pfCapNone');
                          if (m === 'total_12pct') return t('userManagement.pfCapTotal12pct');
                          if (m === 'basic_12pct' || su.pf_cap_1800 === false)
                            return t('userManagement.pfCap12pct');
                          return t('userManagement.pfCap1800');
                        })()}
                      </Typography>
                    </Box>
                    <Box sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }}>
                      <Typography variant="body2" sx={userDetailLabelSx}>
                        {t('userManagement.otEligible')}
                      </Typography>
                      <Typography variant="body1" sx={userDetailValueSx}>
                        {su.ot_eligible === true
                          ? t('userManagement.otEligibleYes')
                          : t('userManagement.otEligibleNo')}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={userDetailLabelSx}>
                        {t('userManagement.ptEligible')}
                      </Typography>
                      <Typography variant="body1" sx={userDetailValueSx}>
                        {su.pt_eligible === false
                          ? t('userManagement.ptEligibleNo')
                          : t('userManagement.ptEligibleYes')}
                      </Typography>
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
              ) : null}

              {careers.length > 0 ? (
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userDetailSectionTitleSx}>
                    {t('userManagement.sectionCareer')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {careers.map((c, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          borderBottom:
                            idx < careers.length - 1
                              ? `1px solid ${theme.palette.divider}`
                              : 'none',
                          pb: idx < careers.length - 1 ? 1.5 : 0,
                        }}
                      >
                        <Typography variant="body1" sx={{ ...userDetailValueSx, fontWeight: 600 }}>
                          {c.company_name}
                          {c.position ? ` · ${c.position}` : ''}
                        </Typography>
                        {(c.start_date || c.end_date) ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {(c.start_date
                              ? new Date(c.start_date).toLocaleDateString(dateLocale)
                              : '—') +
                              ' ~ ' +
                              (c.end_date
                                ? new Date(c.end_date).toLocaleDateString(dateLocale)
                                : t('userManagement.careerPresent'))}
                          </Typography>
                        ) : null}
                        {c.description ? (
                          <Typography variant="body2" sx={{ ...userDetailValueSx, mt: 0.75 }}>
                            {c.description}
                          </Typography>
                        ) : null}
                        {c.certificate_url ? (
                          <Button
                            size="small"
                            component="a"
                            href={getUploadUrl(c.certificate_url)}
                            target="_blank"
                            rel="noreferrer"
                            startIcon={<OpenInNewIcon fontSize="small" />}
                            sx={{ mt: 0.5 }}
                          >
                            {t('userManagement.careerCertificateView')}
                          </Button>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
              ) : null}

              {educations.length > 0 ? (
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userDetailSectionTitleSx}>
                    {t('userManagement.sectionEducation')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {educations.map((e, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          borderBottom:
                            idx < educations.length - 1
                              ? `1px solid ${theme.palette.divider}`
                              : 'none',
                          pb: idx < educations.length - 1 ? 1.25 : 0,
                        }}
                      >
                        <Typography variant="body1" sx={{ ...userDetailValueSx, fontWeight: 600 }}>
                          {e.school_name}
                          {e.degree ? ` · ${e.degree}` : ''}
                          {e.major ? ` · ${e.major}` : ''}
                        </Typography>
                        {(e.start_date || e.end_date) ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {(e.start_date
                              ? new Date(e.start_date).toLocaleDateString(dateLocale)
                              : '—') +
                              ' ~ ' +
                              (e.end_date
                                ? new Date(e.end_date).toLocaleDateString(dateLocale)
                                : t('userManagement.educationPresent'))}
                          </Typography>
                        ) : null}
                        {e.description ? (
                          <Typography variant="body2" sx={{ ...userDetailValueSx, mt: 0.75 }}>
                            {e.description}
                          </Typography>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
              ) : null}

              {certificates.length > 0 ? (
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userDetailSectionTitleSx}>
                    {t('userManagement.sectionCertificate')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {certificates.map((c, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          borderBottom:
                            idx < certificates.length - 1
                              ? `1px solid ${theme.palette.divider}`
                              : 'none',
                          pb: idx < certificates.length - 1 ? 1.25 : 0,
                        }}
                      >
                        <Typography variant="body1" sx={{ ...userDetailValueSx, fontWeight: 600 }}>
                          {c.name}
                          {c.issuer ? ` · ${c.issuer}` : ''}
                        </Typography>
                        {c.certificate_number ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {c.certificate_number}
                          </Typography>
                        ) : null}
                        {(c.issue_date || c.expiry_date) ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {(c.issue_date
                              ? new Date(c.issue_date).toLocaleDateString(dateLocale)
                              : '—') +
                              (c.expiry_date
                                ? ` ~ ${new Date(c.expiry_date).toLocaleDateString(dateLocale)}`
                                : '')}
                          </Typography>
                        ) : null}
                        {c.file_url ? (
                          <Button
                            size="small"
                            component="a"
                            href={getUploadUrl(c.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            startIcon={<OpenInNewIcon fontSize="small" />}
                            sx={{ mt: 0.5, alignSelf: 'flex-start' }}
                          >
                            {t('userManagement.certificateCopyView')}
                          </Button>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
              ) : null}

              {hasBank ? (
              <Accordion sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userDetailSectionTitleSx}>
                    {t('userManagement.sectionBank')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                      gap: 2.25,
                    }}
                  >
                    {renderDetailField(t('userManagement.bankName'), su.bank_name, {
                      show: hasDetailValue(su.bank_name),
                    })}
                    {renderDetailField(
                      t('userManagement.accountNumber'),
                      formatBankAccountDisplay(String(su.bank_account || '')),
                      { show: hasDetailValue(su.bank_account) }
                    )}
                    {renderDetailField(
                      t('userManagement.ifscCode'),
                      formatIfscDisplay(String(su.bank_ifsc || '')),
                      { show: hasDetailValue(su.bank_ifsc) }
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
              ) : null}

              <Accordion defaultExpanded sx={getAccordionFormSx(theme)}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography component="h3" sx={userDetailSectionTitleSx}>
                    {t('userManagement.sectionAccount')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                    gap: 2.25,
                  }}>
                    {renderDetailField(t('userManagement.userId'), selectedUser.userid, {
                      show: hasDetailValue(selectedUser.userid),
                      valueSx: { fontWeight: 600 },
                    })}
                    <Box>
                      <Typography variant="body2" sx={userDetailLabelSx}>
                        {t('userManagement.roleLabel')}
                      </Typography>
                      <Chip
                        label={getRoleLabel(selectedUser.role)}
                        color={getRoleColor(selectedUser.role) as any}
                        size="small"
                      />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={userDetailLabelSx}>
                        {t('userManagement.statusLabel')}
                      </Typography>
                      <Chip
                        label={getStatusLabel(selectedUser.status)}
                        color={getStatusColor(selectedUser.status) as any}
                        size="small"
                      />
                    </Box>
                    {renderDetailField(
                      t('userManagement.createdAt'),
                      selectedUser.created_at
                        ? new Date(selectedUser.created_at).toLocaleDateString(dateLocale)
                        : '',
                      { show: Boolean(selectedUser.created_at) }
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setOpenViewDialog(false)} sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}>
            {t('common.close')}
          </Button>
          {selectedUser && (
            <Button
              variant="outlined"
              startIcon={
                downloadingPersonalRecord ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <PictureAsPdfIcon />
                )
              }
              onClick={() => void handleDownloadPersonalRecordPdf()}
              disabled={downloadingPersonalRecord}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, ml: 'auto' }}
            >
              {downloadingPersonalRecord
                ? t('userManagement.personalRecordPdfGenerating')
                : t('userManagement.downloadPersonalRecordPdf')}
            </Button>
          )}
          {selectedUser && (
            <Button 
              variant="contained"
              disableElevation
              startIcon={<EditIcon />}
              onClick={() => {
                setOpenViewDialog(false);
                handleEditUser(selectedUser);
              }}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
            >
              {t('userManagement.edit')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={salaryUnlockOpen}
        onClose={() => !salaryUnlocking && setSalaryUnlockOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('personalSettings.salaryRevealTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('userManagement.salaryUnlockHint')}
          </Typography>
          {salaryUnlockError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {salaryUnlockError}
            </Alert>
          ) : null}
          <TextField
            autoFocus
            fullWidth
            type="password"
            size="small"
            label={t('userManagement.salaryPasswordLabel')}
            value={salaryUnlockPassword}
            onChange={(e) => setSalaryUnlockPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSalaryUnlockConfirm();
              }
            }}
            disabled={salaryUnlocking}
            {...OUTLINED_FIELD}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSalaryUnlockOpen(false)} disabled={salaryUnlocking}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => void handleSalaryUnlockConfirm()}
            disabled={salaryUnlocking}
          >
            {salaryUnlocking ? <CircularProgress size={18} color="inherit" /> : t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 프로필 사진 확대 보기 */}
      <Dialog
        open={!!photoPreviewUrl}
        onClose={() => setPhotoPreviewUrl(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            bgcolor: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          },
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            bgcolor: 'transparent',
          }}
          onClick={() => setPhotoPreviewUrl(null)}
        >
          {photoPreviewUrl ? (
            <Box
              component="img"
              src={photoPreviewUrl}
              alt={selectedUser?.username || t('userManagement.profilePhoto')}
              onClick={(e) => e.stopPropagation()}
              sx={{
                maxWidth: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: 2,
                boxShadow: '0 12px 40px rgba(15, 23, 42, 0.35)',
                bgcolor: '#fff',
              }}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pt: 1.5, pb: 0 }}>
          <Button
            variant="contained"
            onClick={() => setPhotoPreviewUrl(null)}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Excel 가져오기 다이얼로그 */}
      <Dialog 
        open={importDialogOpen} 
        onClose={() => {
          setImportDialogOpen(false);
          setImportFile(null);
          setImportResult(null);
          setImportLoginPassword('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('userManagement.excelImportTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              style={{ marginBottom: 16 }}
            />
            {importFile && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('userManagement.selectedFile')}: {importFile.name}
              </Alert>
            )}
            <TextField
              fullWidth
              size="small"
              type="password"
              label={t('userManagement.salaryPasswordLabel')}
              helperText={t('userManagement.excelImportSalaryPasswordHint')}
              value={importLoginPassword}
              onChange={(e) => setImportLoginPassword(e.target.value)}
              sx={{ mb: 2 }}
              {...OUTLINED_FIELD}
            />
            {importResult && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {t('userManagement.importResultTitle')}
                </Typography>
                <Alert severity="success" sx={{ mb: 2 }}>
                  {t('userManagement.importSuccessSummary', { total: importResult.total, success: importResult.success.length })}
                </Alert>
                {importResult.failed.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" color="error" gutterBottom>
                      {t('userManagement.importFailedCount', { count: importResult.failed.length })}
                    </Typography>
                    <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                      {importResult.failed.map((item: any, index: number) => (
                        <Alert key={index} severity="error" sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            {t('userManagement.importRowError', { row: item.row, error: item.error })}
                          </Typography>
                          {item.data && (
                            <Typography variant="caption" color="text.secondary">
                              사용자ID: {item.data['사용자ID']}, 이름: {item.data['이름']}
                            </Typography>
                          )}
                        </Alert>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => {
              setImportDialogOpen(false);
              setImportFile(null);
              setImportResult(null);
            }}
          >
            {t('common.close')}
          </Button>
          <Button
            variant="contained"
            onClick={handleImportExcel} 
            disabled={!importFile || importLoading}
            startIcon={importLoading ? <CircularProgress size={20} /> : <UploadIcon />}
          >
            {importLoading ? t('userManagement.importing') : t('userManagement.importButton')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={salaryHistoryOpen}
        onClose={() => setSalaryHistoryOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle>{t('userManagement.salaryHistoryTitle')}</DialogTitle>
        <DialogContent>
          {salaryHistoryLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : salaryHistoryRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t('userManagement.salaryHistoryEmpty')}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell>{t('userManagement.salaryColWhen')}</TableCell>
                  <TableCell align="right">{t('userManagement.salaryColPrevious')}</TableCell>
                  <TableCell align="right">{t('userManagement.salaryColRequested')}</TableCell>
                  <TableCell>{t('userManagement.salaryColStatus')}</TableCell>
                  <TableCell>{t('userManagement.salaryColRequester')}</TableCell>
                  <TableCell>{t('userManagement.salaryColApprover')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {salaryHistoryRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell align="right">{formatSalaryInr(row.previous_salary)}</TableCell>
                    <TableCell align="right">{formatSalaryInr(row.requested_salary)}</TableCell>
                    <TableCell>{salaryStatusLabel(String(row.status || ''), t)}</TableCell>
                    <TableCell>{row.requester_name || '-'}</TableCell>
                    <TableCell>{row.approver_name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setSalaryHistoryOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={salaryPendingOpen}
        onClose={() => setSalaryPendingOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle>{t('userManagement.salaryApproval')}</DialogTitle>
        <DialogContent>
          {salaryPendingRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {t('userManagement.salaryApprovalEmpty')}
            </Typography>
          ) : (
            <Table size="small">
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell>{t('userManagement.name')}</TableCell>
                  <TableCell align="right">{t('userManagement.salaryColPrevious')}</TableCell>
                  <TableCell align="right">{t('userManagement.salaryColRequested')}</TableCell>
                  <TableCell>{t('userManagement.salaryColRequester')}</TableCell>
                  <TableCell>{t('userManagement.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {salaryPendingRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.employee_name || '-'}</TableCell>
                    <TableCell align="right">{formatSalaryInr(row.previous_salary)}</TableCell>
                    <TableCell align="right">{formatSalaryInr(row.requested_salary)}</TableCell>
                    <TableCell>{row.requester_name || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        sx={{ ...mvsBodyPrimaryBtnSx, mr: 1 }}
                        onClick={() =>
                          showConfirm(
                            t('userManagement.salaryApproveConfirm', {
                              name: row.employee_name || '-',
                              amount: formatSalaryInr(row.requested_salary),
                            }),
                            () => {
                              void userService
                                .decideSalaryChange(row.id, 'approve')
                                .then(() => {
                                  setSuccess(t('userManagement.salaryApproved'));
                                  void loadPendingSalaryChanges();
                                  void fetchUsers();
                                })
                                .catch((err: any) =>
                                  setError(err?.response?.data?.message || t('userManagement.operationFailed'))
                                );
                            }
                          )
                        }
                      >
                        {t('userManagement.salaryStatusApproved')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        sx={mvsBodyOutlinedBtnSx}
                        onClick={() =>
                          showPrompt(
                            t('userManagement.salaryRejectPrompt'),
                            (reason) => {
                              void userService
                                .decideSalaryChange(row.id, 'reject', reason)
                                .then(() => {
                                  setSuccess(t('userManagement.salaryRejected'));
                                  void loadPendingSalaryChanges();
                                })
                                .catch((err: any) =>
                                  setError(err?.response?.data?.message || t('userManagement.operationFailed'))
                                );
                            },
                            { title: t('userManagement.salaryRejectTitle'), required: false }
                          )
                        }
                      >
                        {t('userManagement.salaryStatusRejected')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setSalaryPendingOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        message={promptState.message}
        label={promptState.label}
        defaultValue={promptState.defaultValue}
        placeholder={promptState.placeholder}
        multiline={promptState.multiline}
        minRows={promptState.minRows}
        confirmText={promptState.confirmText}
        cancelText={promptState.cancelText}
        required={promptState.required}
        onConfirm={handlePromptConfirm}
        onCancel={handlePromptCancel}
      />

      {/* 확인 다이얼로그 */}
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
    </Box>
  );
};

export default UserManagement;
