import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Avatar,
  IconButton,
  Alert,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  InputAdornment,
  CircularProgress,
  Tooltip,
  Checkbox,
  Pagination,
  Collapse } from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsFilterFieldHeightSx,
  mvsSearchFieldSx,
  mvsOutlinedLabelProps,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsTableScrollSx,
  mvsBodyPaginationSx } from '../../theme/daeheungLayout';
import {
  Business as BusinessIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  People as PeopleIcon,
  Close as CloseIcon,
  PhotoCamera as PhotoCameraIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useStore } from '../../store';
import { api } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import AuthMedia from '../../components/Common/AuthMedia';
import { getUploadUrl } from '../../utils/uploadUrl';
import { normalizePartnerCompanyName } from '../../utils/partnerCompanyName';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import { IS_STANDALONE } from '../../config/deployment';

type CompanyDialogSectionKey = 'tax' | 'bank' | 'transfer' | 'mvs' | 'images';

const DEFAULT_COMPANY_DIALOG_SECTIONS: Record<CompanyDialogSectionKey, boolean> = {
  tax: false,
  bank: false,
  transfer: false,
  mvs: false,
  images: false
};

/** 입력 중 회사명: 단어별 첫 글자 대문자·나머지 소문자 (공백·커서 유지) */
function formatCompanyNameWhileTyping(raw: string): string {
  return String(raw ?? '').replace(/[A-Za-zÀ-ÿ]+/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

const COMPANY_MENU_ROUTES = ['/basic-info/company', '/basic-info'] as const;
const COMPANIES_PER_PAGE = 15;

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

const COMP_COL_DEFAULTS: Record<string, number> = {
  select: 48,
  name: 280,
  ceo_name: 140,
  industry: 140,
  employee_count: 120,
  mvs_start: 180,
  actions: 72 };

const COMP_COL_TOTAL = Object.values(COMP_COL_DEFAULTS).reduce((s, n) => s + n, 0);

const COMP_COL_ALIGN: Record<string, 'left' | 'right' | 'center'> = {
  select: 'center',
  name: 'left',
  ceo_name: 'left',
  industry: 'left',
  employee_count: 'right',
  mvs_start: 'left',
  actions: 'center' };

const COMP_COL_MIN_WIDTH: Record<string, number> = {
  select: 48,
  name: 120,
  ceo_name: 88,
  industry: 72,
  employee_count: 96,
  mvs_start: 120,
  actions: 56 };

function compColWidthPct(key: string): string {
  const w = COMP_COL_DEFAULTS[key] ?? 80;
  return `${(w / COMP_COL_TOTAL) * 100}%`;
}

function compColTableAlign(key: string): 'left' | 'right' | 'center' {
  return COMP_COL_ALIGN[key] ?? 'left';
}

function compColSortLabelJustify(key: string): 'flex-start' | 'flex-end' | 'center' {
  const align = compColTableAlign(key);
  if (align === 'right') return 'flex-end';
  if (align === 'center') return 'center';
  return 'flex-start';
}

const COMPANY_FILTER_OUTLINED = mvsOutlinedLabelProps;
const companyFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

const companyTableBodyRowSx: SxProps<Theme> = (theme) => {
  const base = typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hoverBg = theme.palette.mode === 'light' ? '#EFF6FF' : theme.palette.action.hover;
  const cellPaddingX = { xs: 1, sm: 1.25 };
  return {
    ...(base as object),
    '& .MuiTableCell-body': {
      py: 0.75,
      px: cellPaddingX,
      fontSize: { xs: '0.75rem', sm: '0.8125rem' },
      lineHeight: 1.35 },
    '& .MuiTableCell-body.MuiTableCell-paddingCheckbox': {
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      px: cellPaddingX,
      py: 0.75 },
    '& .MuiTableRow-root:nth-of-type(odd)': { bgcolor: rowBg },
    '& .MuiTableRow-root:nth-of-type(even)': { bgcolor: rowBg },
    '& .MuiTableRow-root:hover': { bgcolor: hoverBg } };
};

const companyListTextSx = {
  fontSize: 'inherit',
  lineHeight: 1.35 } as const;

const companyCheckboxColSx = {
  width: 48,
  minWidth: 48,
  maxWidth: 48,
  px: { xs: 1, sm: 1.25 },
  py: 0.75,
  boxSizing: 'border-box' as const } as const;

/** 회사 정보 보기(단일 회사) 화면 타이포 */
const companyDetailViewSx = {
  cardTitle: { fontWeight: 600, letterSpacing: '-0.02em', fontSize: '1rem' },
  companyName: { fontWeight: 600, mb: 1, fontSize: '1.125rem', lineHeight: 1.35 },
  companyMeta: { fontSize: '0.8125rem', lineHeight: 1.45 },
  sectionTitle: { fontWeight: 600, mb: 2, fontSize: '0.875rem' },
  fieldLabel: { mb: 1, fontSize: '0.8125rem', lineHeight: 1.35 },
  fieldValue: { fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.45 },
} as const;

// TabPanel 컴포넌트 정의

// 회사 정보 타입 정의
interface Company {
  id: number;
  tenant_id: number;
  name: string;
  business_number: string;
  ceo_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  industry: string;
  employee_count: number;
  subscription_plan: string;
  subscription_status: string;
  // 인도 관련 필드
  gst_numbers?: string[]; // GST 번호 배열 (최대 10개)
  msme_number?: string;
  iec_number?: string;
  pan_number?: string;
  // 회사 이미지 정보
  company_logo: string;
  company_seal: string;
  ceo_signature: string;
  // 은행 정보
  account_holder_name: string;
  bank_name: string;
  bank_address: string;
  account_number: string;
  ifsc_code: string;
  swift_code: string;
  // 로그인 기간 설정
  login_period_start: string;
  login_period_end: string;
  login_time_start: string;
  login_time_end: string;
  timezone: string;
  // MVS 사용 기간
  mvs_start_date: string;
  mvs_end_date: string;
  settings: any;
  created_at: string;
  updated_at: string;
}

type CompanySortKey = 'name' | 'ceo_name' | 'industry' | 'employee_count' | 'mvs_start';

function descendingComparator(a: Company, b: Company, orderBy: CompanySortKey): number {
  if (orderBy === 'employee_count') {
    return (b.employee_count ?? 0) - (a.employee_count ?? 0);
  }
  if (orderBy === 'mvs_start') {
    const as = a.mvs_start_date || '';
    const bs = b.mvs_start_date || '';
    if (bs < as) return -1;
    if (bs > as) return 1;
    return 0;
  }
  const va = String(a[orderBy] ?? '').toLowerCase();
  const vb = String(b[orderBy] ?? '').toLowerCase();
  if (vb < va) return -1;
  if (vb > va) return 1;
  return 0;
}

function getCompanySortComparator(
  order: 'asc' | 'desc',
  orderBy: CompanySortKey
): (a: Company, b: Company) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

// 회사 이미지 타입
interface CompanyImages {
  company_logo: File | null;
  company_seal: File | null;
  ceo_signature: File | null;
}

// 이미지 미리보기 타입
interface ImagePreview {
  company_logo: string;
  company_seal: string;
  ceo_signature: string;
}

function transformCompanyFromApi(company: any): Company {
  let gstNumbers: string[] = [];
  if (Array.isArray(company.gst_numbers) && company.gst_numbers.length > 0) {
    gstNumbers = company.gst_numbers.filter((gst: string) => gst && gst.trim() !== '');
  }

  return {
    ...company,
    employee_count: company.employee_count || 0,
    subscription_plan: company.subscription_plan || 'basic',
    subscription_status: company.status || 'active',
    company_logo: company.company_logo || '',
    company_seal: company.company_seal || '',
    ceo_signature: company.ceo_signature || '',
    account_holder_name: company.account_holder_name || '',
    bank_name: company.bank_name || '',
    bank_address: company.bank_address || '',
    account_number: company.account_number || '',
    ifsc_code: company.ifsc_code || '',
    swift_code: company.swift_code || '',
    gst_numbers: gstNumbers.length > 0 ? gstNumbers : [''],
    msme_number: company.msme_number || '',
    iec_number: company.iec_number || '',
    pan_number: company.pan_number || '',
    login_period_start: company.login_period_start || '',
    login_period_end: company.login_period_end || '',
    login_time_start: company.login_time_start || '09:00:00',
    login_time_end: company.login_time_end || '18:00:00',
    timezone: company.timezone || 'Asia/Kolkata',
    settings: company.settings || {},
  };
}

async function reloadCompaniesForUser(
  user: { role?: string; company_id?: number } | null,
  force: boolean
): Promise<{ companies: Company[]; error?: string }> {
  if (!user) {
    return { companies: [] };
  }

  if (!IS_STANDALONE && user.role === 'root') {
    // 회사 관리: 사용 종료 회사도 표시(기간 연장·관리용). 선택 드롭다운은 기본 목록에서 제외됨.
    const companiesData = await useReferenceDataStore
      .getState()
      .fetchCompanies(force, { includeExpired: true });
    return { companies: companiesData.map(transformCompanyFromApi) };
  }

  if (user.company_id) {
    const company = await useReferenceDataStore.getState().fetchCompanyById(Number(user.company_id), force);
    if (company) {
      return { companies: [transformCompanyFromApi(company)] };
    }
    return { companies: [], error: '회사 정보를 불러오는데 실패했습니다.' };
  }

  return { companies: [], error: '회사 정보가 없습니다. 관리자에게 문의하세요.' };
}

/** 서버 응답에서 실패 사유를 최대한 구체적으로 뽑아낸다 */
const describeSaveFailure = (responseData: any, fallback: string): string => {
  const message = responseData?.message || fallback;
  const detail = responseData?.error;
  if (detail && typeof detail === 'string' && !message.includes(detail)) {
    return `${message} (${detail})`;
  }
  return message;
};

const CompanyManagement: React.FC = () => {
  const { t } = useTranslation();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const theme = useTheme();
  /** 테이블 주요 본문(회사명·대표 등) */
  const tablePrimaryFg = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'dark' ? 0.98 : 0.92
  );
  const { user } = useStore();
  const menuFlags = useMenuRoutePermissionFlags(COMPANY_MENU_ROUTES);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<CompanySortKey>('name');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');
  const [dialogSections, setDialogSections] = useState(DEFAULT_COMPANY_DIALOG_SECTIONS);
  const toggleDialogSection = (key: CompanyDialogSectionKey) => {
    setDialogSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const [formData, setFormData] = useState<Omit<Company, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>({
    name: '',
    business_number: '',
    ceo_name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    industry: '',
    employee_count: 0,
    subscription_plan: 'basic',
    subscription_status: 'active',
    gst_numbers: [''],
    msme_number: '',
    iec_number: '',
    pan_number: '',
    company_logo: '',
    company_seal: '',
    ceo_signature: '',
    account_holder_name: '',
    bank_name: '',
    bank_address: '',
    account_number: '',
    ifsc_code: '',
    swift_code: '',
    login_period_start: '',
    login_period_end: '',
    login_time_start: '09:00:00',
    login_time_end: '18:00:00',
    timezone: 'Asia/Kolkata',
    mvs_start_date: '',
    mvs_end_date: '',
    settings: {}
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testingBankProvider, setTestingBankProvider] = useState<'icici' | 'kotak' | null>(null);
  const [imageFiles, setImageFiles] = useState<CompanyImages>({
    company_logo: null,
    company_seal: null,
    ceo_signature: null
  });
  const [imagePreviews, setImagePreviews] = useState<ImagePreview>({
    company_logo: '',
    company_seal: '',
    ceo_signature: ''
  });
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [listViewMode, setListViewMode] = useState<ListViewMode>('page');

  // 이미지 파일을 Base64로 변환하는 함수
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = async (field: keyof CompanyImages, file: File) => {
    try {
      const base64 = await convertToBase64(file);
      setImageFiles(prev => ({ ...prev, [field]: file }));
      setImagePreviews(prev => ({ ...prev, [field]: base64 }));
      setFormData(prev => ({ ...prev, [field]: base64 }));
    } catch {
      setError('이미지 업로드 중 오류가 발생했습니다.');
    }
  };

  // 이미지 삭제 핸들러
  const handleImageRemove = (field: keyof CompanyImages) => {
    setImageFiles(prev => ({ ...prev, [field]: null }));
    setImagePreviews(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: '' }));
  };

  // 회사 목록 로드
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (menuFlags.menusLoading || !menuFlags.canRead) {
        setCompanies([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        
        const { companies: nextCompanies, error: loadError } = await reloadCompaniesForUser(user, false);
        if (loadError) {
          setError(loadError);
        }
        setCompanies(nextCompanies);
      } catch (error: any) {
        // 인증 오류인 경우 특별 처리
        if (error.response?.status === 401 || error.response?.status === 403) {
          const errorMessage = error.response?.data?.message || '인증 오류가 발생했습니다. 다시 로그인해주세요.';
          setError(errorMessage);
          // 로그아웃 처리는 API 인터셉터에서 처리됨
        } else {
          const errorMessage = error.response?.data?.message || error.message || '회사 정보를 불러오는데 실패했습니다.';
          setError(errorMessage);
        }
        setCompanies([]);
      } finally {
        setLoading(false);
              }
    };

    fetchCompanies();
  }, [user?.role, user?.company_id, user?.id, menuFlags.menusLoading, menuFlags.canRead]);

  // 회사 추가
  const handleAdd = () => {
    setSelectedCompany(null);
    setFormData({
      name: '',
      business_number: '',
      ceo_name: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      industry: '',
      employee_count: 0,
      subscription_plan: 'basic',
      subscription_status: 'active',
      gst_numbers: [''],
      msme_number: '',
      iec_number: '',
      pan_number: '',
      company_logo: '',
      company_seal: '',
      ceo_signature: '',
      account_holder_name: '',
      bank_name: '',
      bank_address: '',
      account_number: '',
      ifsc_code: '',
      swift_code: '',
      login_period_start: '',
      login_period_end: '',
      login_time_start: '09:00:00',
      login_time_end: '18:00:00',
      timezone: 'Asia/Kolkata',
      mvs_start_date: '',
      mvs_end_date: '',
      settings: {}
    });
    // 이미지 상태 초기화
    setImageFiles({
      company_logo: null,
      company_seal: null,
      ceo_signature: null
    });
    setImagePreviews({
      company_logo: '',
      company_seal: '',
      ceo_signature: ''
    });
    setDialogMode('add');
    setDialogSections(DEFAULT_COMPANY_DIALOG_SECTIONS);
    setOpenDialog(true);
  };

  // 회사 수정
  const handleEdit = (company: Company) => {
        
    setSelectedCompany(company);
    
    // GST 번호 처리 - 빈 문자열이 아닌 값만 필터링
    let gstNumbers: string[] = [];
    if (company.gst_numbers) {
      if (Array.isArray(company.gst_numbers)) {
        gstNumbers = company.gst_numbers.filter((gst: string) => gst && gst.trim() !== '');
      } else if (typeof company.gst_numbers === 'string') {
        // 문자열인 경우 배열로 변환
        gstNumbers = [company.gst_numbers].filter((gst: string) => gst && gst.trim() !== '');
      }
    }
    
        
    setFormData({
      ...company,
      gst_numbers: gstNumbers.length > 0 ? gstNumbers : [''],
      bank_address: company.bank_address || '',
      swift_code: company.swift_code || '',
      iec_number: company.iec_number || ''
    });
    // 기존 이미지 데이터를 미리보기에 설정
    setImagePreviews({
      company_logo: company.company_logo || '',
      company_seal: company.company_seal || '',
      ceo_signature: company.ceo_signature || ''
    });
    setDialogMode('edit');
    setDialogSections(DEFAULT_COMPANY_DIALOG_SECTIONS);
    setOpenDialog(true);
  };

  // 회사 보기
  const handleView = (company: Company) => {
        
    setSelectedCompany(company);
    
    // GST 번호 처리 - 빈 문자열이 아닌 값만 필터링
    let gstNumbers: string[] = [];
    if (company.gst_numbers) {
      if (Array.isArray(company.gst_numbers)) {
        gstNumbers = company.gst_numbers.filter((gst: string) => gst && gst.trim() !== '');
      } else if (typeof company.gst_numbers === 'string') {
        // 문자열인 경우 배열로 변환
        gstNumbers = [company.gst_numbers].filter((gst: string) => gst && gst.trim() !== '');
      }
    }
    
        
    setFormData({
      ...company,
      gst_numbers: gstNumbers.length > 0 ? gstNumbers : [''],
      bank_address: company.bank_address || '',
      swift_code: company.swift_code || '',
      iec_number: company.iec_number || ''
    });
    // 기존 이미지 데이터를 미리보기에 설정
    setImagePreviews({
      company_logo: company.company_logo || '',
      company_seal: company.company_seal || '',
      ceo_signature: company.ceo_signature || ''
    });
    setImageFiles({
      company_logo: null,
      company_seal: null,
      ceo_signature: null
    });
    setDialogMode('view');
    setDialogSections(DEFAULT_COMPANY_DIALOG_SECTIONS);
    setOpenDialog(true);
  };

  const handleTestBankConnection = async (provider: 'icici' | 'kotak') => {
    setError('');
    setSuccess('');
    setTestingBankProvider(provider);
    try {
      const cred = formData.settings?.bank_transfer?.[provider] || {};
      const response = await api.post('/company/bank-transfer/test', {
        companyId: selectedCompany?.id,
        provider,
        apiUrl: cred.apiUrl || '',
        apiKey: cred.apiKey || '',
        transferPath: cred.transferPath || ''
      });
      if (response.data?.success) {
        setSuccess(
          response.data?.message ||
            response.data?.data?.message ||
            t('companyManagement.bankTransferTestSuccess')
        );
      } else {
        setError(
          response.data?.message || t('companyManagement.bankTransferTestFailed')
        );
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          t('companyManagement.bankTransferTestFailed')
      );
    } finally {
      setTestingBankProvider(null);
    }
  };

  // 회사 저장
  const handleSave = async () => {
                
    setLoading(true);
    setError('');
    setSuccess('');

    // 필수 항목 검증 (NOT NULL 제약조건이 있는 필드)
    // address는 DB에서 NOT NULL이므로 추가/수정 모두에서 필수 (phone은 선택)
    if (!formData.address || formData.address.trim() === '') {
            setError('주소는 필수 입력 항목입니다.');
      setLoading(false);
      return;
    }

    // 필수 항목 검증 (새 회사 추가 시에만)
    if (dialogMode === 'add') {
      // 회사명 검증
      if (!formData.name || formData.name.trim() === '') {
                setError('회사명은 필수 입력 항목입니다.');
        setLoading(false);
        return;
      }

      // 사업자등록번호 검증
      if (!formData.business_number || formData.business_number.trim() === '') {
                setError('사업자등록번호는 필수 입력 항목입니다.');
        setLoading(false);
        return;
      }
    }

    try {
      if (dialogMode === 'add') {
                // 회사 등록 시 MVS 시스템 사용 가능하도록 설정
        const companyData = {
          ...formData,
          name: normalizePartnerCompanyName(formData.name),
          subscription_status: 'active',
          status: 'active' // 백엔드에서 사용하는 status 필드
        };
                
        const response = await api.post('/company', companyData);
                if (response.data.success) {
          const baseMsg = '회사가 성공적으로 등록되었습니다. MVS 시스템을 사용할 수 있습니다.';
          setSuccess(
            response.data.warning ? `${baseMsg} (주의: ${response.data.warning})` : baseMsg
          );
        } else {
          setError(describeSaveFailure(response.data, '회사 등록에 실패했습니다.'));
          setLoading(false);
          return;
        }
      } else if (dialogMode === 'edit' && selectedCompany) {
        // 수정 시 이미지 처리: 새로 업로드한 이미지만 전송
        const updateData: any = {
          ...formData,
          name: normalizePartnerCompanyName(formData.name),
        };
        
        // 이미지 필드 처리: 새로 업로드한 이미지(파일이 있는 경우)만 전송
        const imageFields: (keyof CompanyImages)[] = ['company_logo', 'company_seal', 'ceo_signature'];
        imageFields.forEach(field => {
          // 새로 업로드한 파일이 있는 경우에만 전송
          if (imageFiles[field]) {
            // Base64 데이터가 이미 formData에 있으므로 그대로 전송
            // updateData[field]는 이미 Base64로 설정되어 있음
          } else {
            // 파일이 없고, 이미지가 삭제된 경우 (빈 문자열)
            if (!formData[field] || formData[field] === '') {
              updateData[field] = null;
            } else {
              // 기존 이미지를 유지하는 경우 - 전송하지 않음 (백엔드에서 업데이트하지 않음)
              delete updateData[field];
            }
          }
        });
        
        // NOT NULL 필드가 빈 문자열이거나 undefined인 경우 빈 문자열로 설정
        const notNullFields = ['address', 'phone', 'email'];
        notNullFields.forEach(field => {
          if (updateData[field] === undefined || updateData[field] === null) {
            updateData[field] = '';
          }
        });
        
                const response = await api.put(`/company/${selectedCompany.id}`, updateData);
                if (response.data.success) {
                    setSuccess('회사 정보가 성공적으로 수정되었습니다.');
          // 성공 시 다이얼로그 닫기
          setOpenDialog(false);
        } else {
          // 오류 메시지는 메인 페이지에 표시되도록 유지 (다이얼로그는 닫지 않음)
          setError(describeSaveFailure(response.data, '회사 정보 수정에 실패했습니다.'));
          setLoading(false);
          return;
        }
      }
      
      const { companies: nextCompanies, error: loadError } = await reloadCompaniesForUser(user, true);
      if (loadError) {
        setError(loadError);
      }
      setCompanies(nextCompanies);

      // 등록 모드에서는 성공 시 다이얼로그 닫기 (수정 모드는 위에서 처리)
      if (dialogMode === 'add') {
        setOpenDialog(false);
      }
    } catch (error: any) {
      const errorMessage = describeSaveFailure(
        error.response?.data,
        error.message || '회사 저장 중 오류가 발생했습니다.'
      );
      setError(errorMessage);
      // 오류 발생 시 다이얼로그는 닫지 않음 (사용자가 직접 닫도록)
    } finally {
      setLoading(false);
    }
  };

  // 회사 삭제
  const removeCompaniesFromList = (ids: number[]) => {
    const idSet = new Set(ids);
    setCompanies((prev) => prev.filter((company) => !idSet.has(company.id)));
    setSelectedCompanyIds((prev) => prev.filter((id) => !idSet.has(id)));
  };

  const handleDelete = (id: number) => {
    showConfirm(
      t('companyManagement.confirmDelete'),
      () => {
        void (async () => {
          setLoading(true);
          setError('');
          setSuccess('');

          try {
            await api.delete(`/company/${id}`);
            removeCompaniesFromList([id]);
            setSuccess(t('companyManagement.companyDeleted'));

            const { companies: nextCompanies, error: loadError } = await reloadCompaniesForUser(user, true);
            if (loadError) {
              setError(loadError);
            }
            setCompanies(nextCompanies);
          } catch (error: any) {
            setError(error.response?.data?.message || '회사 삭제 중 오류가 발생했습니다.');
          } finally {
            setLoading(false);
          }
        })();
      },
      { title: t('common.confirm'), confirmColor: 'error', confirmText: t('common.delete'), cancelText: t('common.cancel') }
    );
  };

  const handleDeleteSelected = () => {
    if (!menuFlags.canDelete) return;
    if (selectedCompanyIds.length === 0) return;

    const idsToDelete = [...selectedCompanyIds];

    showConfirm(
      t('companyManagement.deleteSelectedConfirm', { count: idsToDelete.length }),
      () => {
        void (async () => {
          setLoading(true);
          setError('');
          setSuccess('');

          try {
            await Promise.all(idsToDelete.map((id) => api.delete(`/company/${id}`)));
            removeCompaniesFromList(idsToDelete);
            setSuccess(t('companyManagement.deleteSelectedSuccess', { count: idsToDelete.length }));

            const { companies: nextCompanies, error: loadError } = await reloadCompaniesForUser(user, true);
            if (loadError) {
              setError(loadError);
            }
            setCompanies(nextCompanies);
          } catch (error: any) {
            setError(error.response?.data?.message || '회사 삭제 중 오류가 발생했습니다.');
          } finally {
            setLoading(false);
          }
        })();
      },
      { title: t('common.confirm'), confirmColor: 'error', confirmText: t('common.delete'), cancelText: t('common.cancel') }
    );
  };

  // 필터링된 회사 목록 - MVS 시스템을 사용할 수 있는 회사들 (활성 상태)
  const filteredCompanies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return companies.filter((company) => {
      const isActive = company.subscription_status === 'active';
      if (!isActive) return false;
      if (!q) return true;
      const haystack = [
        company.name,
        company.business_number,
        company.ceo_name,
        company.industry,
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join('\n');
      return haystack.includes(q);
    });
  }, [companies, searchTerm]);

  /** admin 등 단일 회사 보기: 로그인 사용자 company_id와 일치하는 행 사용 */
  const ownCompany = useMemo(() => {
    const companyId = Number(user?.company_id);
    if (Number.isFinite(companyId) && companyId > 0) {
      const matched = companies.find((company) => company.id === companyId);
      if (matched) return matched;
    }
    return companies[0] ?? null;
  }, [companies, user?.company_id]);

  const handleRequestSort = (property: CompanySortKey) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedCompanies = useMemo(() => {
    const copy = [...filteredCompanies];
    copy.sort(getCompanySortComparator(order, orderBy));
    return copy;
  }, [filteredCompanies, order, orderBy]);

  const totalPages = Math.max(1, Math.ceil(sortedCompanies.length / COMPANIES_PER_PAGE));

  const paginatedCompanies = useMemo(
    () => sortedCompanies.slice((page - 1) * COMPANIES_PER_PAGE, page * COMPANIES_PER_PAGE),
    [sortedCompanies, page]
  );

  const displayedCompanies = listViewMode === 'all' ? sortedCompanies : paginatedCompanies;

  const visibleCompanyIds = useMemo(
    () => displayedCompanies.map((company) => company.id),
    [displayedCompanies]
  );

  const allVisibleSelected =
    visibleCompanyIds.length > 0 && visibleCompanyIds.every((id) => selectedCompanyIds.includes(id));
  const someVisibleSelected = visibleCompanyIds.some((id) => selectedCompanyIds.includes(id));

  useEffect(() => {
    setPage(1);
    setSelectedCompanyIds([]);
  }, [searchTerm]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const hasActiveFilters = Boolean(searchTerm.trim());

  const handleResetFilters = () => setSearchTerm('');

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!menuFlags.canDelete) return;
    if (event.target.checked) {
      setSelectedCompanyIds(visibleCompanyIds);
    } else {
      setSelectedCompanyIds([]);
    }
  };

  const handleToggleSelectCompany = (id: number) => {
    if (!menuFlags.canDelete) return;
    setSelectedCompanyIds((prev) =>
      prev.includes(id) ? prev.filter((companyId) => companyId !== id) : [...prev, id]
    );
  };

  const thLabelEllipsisSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: '1 1 auto' } as const;

  const companyColBaseSx = (key: string) => {
    const align = compColTableAlign(key);
    return {
      width: compColWidthPct(key),
      minWidth: COMP_COL_MIN_WIDTH[key] ?? 0,
      maxWidth: compColWidthPct(key),
      textAlign: align,
      verticalAlign: 'middle' as const,
      boxSizing: 'border-box' as const,
      px: { xs: 1, sm: 1.25 },
      py: 0.75,
      overflow: 'hidden' };
  };

  const thSx = (key: string) => {
    const align = compColTableAlign(key);
    return {
      ...companyColBaseSx(key),
      '& .MuiTableSortLabel-root': {
        color: 'inherit',
        display: 'inline-flex',
        width: '100%',
        maxWidth: '100%',
        justifyContent: compColSortLabelJustify(key),
        overflow: 'hidden',
        ...(align === 'right' ? { flexDirection: 'row-reverse' as const } : {}) },
      '& .MuiTableSortLabel-icon': {
        flexShrink: 0,
        opacity: 0,
        width: 0,
        margin: 0 },
      '& .MuiTableSortLabel-root.Mui-active .MuiTableSortLabel-icon': {
        opacity: 1,
        width: '1.125rem',
        marginLeft: align === 'right' ? 0 : '4px',
        marginRight: align === 'right' ? '4px' : 0 } };
  };

  const tdSx = (key: string) => ({
    ...companyColBaseSx(key),
    textOverflow:
      key === 'name' || key === 'ceo_name' || key === 'industry' || key === 'mvs_start'
        ? ('ellipsis' as const)
        : undefined });

  const renderHeadSortCell = (key: CompanySortKey, label: string) => (
    <TableCell key={key} align={compColTableAlign(key)} sx={thSx(key)}>
      <TableSortLabel
        disabled={menuFlags.menusLoading || !menuFlags.canRead}
        active={orderBy === key}
        direction={orderBy === key ? order : 'asc'}
        onClick={() => handleRequestSort(key)}
      >
        <Box component="span" sx={thLabelEllipsisSx} title={label}>
          {label}
        </Box>
      </TableSortLabel>
    </TableCell>
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
    gap: 1.5 } as const;

  // 공통 TextField 스타일 (한 줄 입력 높이 36px)
  const textFieldStyles = {
    size: 'small' as const,
    InputLabelProps: {
      shrink: true,
      sx: {
        backgroundColor: 'white',
        px: 1,
        color: 'primary.main',
        transform: 'translate(14px, -9px) scale(0.75)',
        transformOrigin: 'top left'
      }
    },
    sx: {
      '& .MuiOutlinedInput-root': {
        height: 36,
        minHeight: 36,
        fontSize: '0.8125rem',
        '& .MuiOutlinedInput-input': {
          py: 0.75,
          height: 'auto',
          boxSizing: 'border-box'
        },
        '& textarea': {
          py: 0.75
        },
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#e0e0e0'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: '#1976d2'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
          borderColor: '#1976d2',
          borderWidth: 2
        },
        '&.MuiInputBase-multiline': {
          height: 'auto',
          minHeight: 36
        }
      }
    }
  };

  const renderCollapsibleSection = (
    key: CompanyDialogSectionKey,
    title: string,
    children: React.ReactNode,
    hint?: string,
    options?: { accent?: boolean }
  ) => {
    const open = dialogSections[key];
    const accent = Boolean(options?.accent);
    const headerBg = accent ? '#FFF4E5' : '#EAF2EA';
    const headerBgOpen = accent ? '#FFE8CC' : '#DDEDDD';
    const borderColor = accent ? '#F0C987' : '#B7C9B7';
    return (
      <Box
        sx={{
          mt: 0.75,
          border: '1px solid',
          borderColor,
          borderLeft: accent ? '3px solid #E6A23C' : '1px solid',
          borderLeftColor: accent ? '#E6A23C' : borderColor,
          borderRadius: 0.75,
          overflow: 'hidden',
          bgcolor: 'background.paper'
        }}
      >
        <Box
          onClick={() => toggleDialogSection(key)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 1.25,
            py: 0.75,
            cursor: 'pointer',
            userSelect: 'none',
            bgcolor: open ? headerBgOpen : headerBg,
            borderBottom: open ? '1px solid' : 'none',
            borderColor,
            '&:hover': { bgcolor: headerBgOpen }
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                fontSize: '0.8125rem',
                lineHeight: 1.3,
                color: accent ? '#8A5A00' : 'text.primary'
              }}
            >
              {title}
            </Typography>
            {hint ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.2, fontSize: '0.68rem', lineHeight: 1.35 }}
              >
                {hint}
              </Typography>
            ) : null}
          </Box>
          <IconButton size="small" tabIndex={-1} sx={{ flexShrink: 0, p: 0.35 }} aria-label={open ? '접기' : '펼치기'}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1.25, py: 1.25 }}>
            {children}
          </Box>
        </Collapse>
      </Box>
    );
  };

  // 이미지 업로드 컴포넌트 생성
  const renderImageUpload = (field: keyof CompanyImages, label: string) => {
    // 이미지 데이터가 있는지 확인 (Base64 또는 URL)
    const hasImage = imagePreviews[field] && imagePreviews[field].length > 0;
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'medium' }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {hasImage ? (
            <Box sx={{ position: 'relative', display: 'inline-block' }}>
              <AuthMedia
                src={imagePreviews[field]}
                alt={label}
                style={{
                  width: 100,
                  height: 100,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid #e0e0e0' }}
                onError={() => {
                  setImagePreviews((prev) => ({ ...prev, [field]: '' }));
                }}
              />
              {dialogMode !== 'view' && (
                <IconButton
                  size="small"
                  onClick={() => handleImageRemove(field)}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    backgroundColor: 'error.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'error.dark'
                    }
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                width: 100,
                height: 100,
                border: '2px dashed #ccc',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f5f5f5'
              }}
            >
              <PhotoCameraIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
            </Box>
          )}
          {dialogMode !== 'view' && (
            <Box>
              <input
                accept="image/*"
                style={{ display: 'none' }}
                id={`${field}-upload`}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(field, file);
                  }
                }}
              />
              <label htmlFor={`${field}-upload`}>
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  size="small"
                >
                  이미지 업로드
                </Button>
              </label>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // 상태 칩 생성
  const getStatusChip = (status: string) => {
    const statusConfig = {
      active: { labelKey: 'companyManagement.active' as const, color: 'success' as const },
      inactive: { labelKey: 'companyManagement.inactive' as const, color: 'default' as const },
      suspended: { labelKey: 'companyManagement.suspended' as const, color: 'error' as const }
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;
    return <Chip label={t(config.labelKey)} color={config.color} size="small" sx={{ fontSize: '0.75rem' }} />;
  };

  // 회사 상세 다이얼로그
  const renderCompanyDialog = () => (
    <Dialog 
      open={openDialog} 
      onClose={() => setOpenDialog(false)} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ 
        fontSize: '1.25rem', 
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <BusinessIcon color="primary" />
        {dialogMode === 'add' ? t('companyManagement.addNewCompany') : 
         dialogMode === 'edit' ? t('companyManagement.editCompany') : t('companyManagement.viewCompany')}
      </DialogTitle>
      <DialogContent>
        {/* 오류 메시지 표시 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {/* 성공 메시지 표시 */}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {/* 좌우 분할 레이아웃 */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1 }}>
            {/* 왼쪽: 기본 정보 */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                    <span style={{ color: 'red' }}>*</span> 회사명
                  </Typography>
                  <TextField
                    fullWidth
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: formatCompanyNameWhileTyping(e.target.value),
                      })
                    }
                    onBlur={() =>
                      setFormData((prev) => ({
                        ...prev,
                        name: normalizePartnerCompanyName(prev.name),
                      }))
                    }
                    required
                    disabled={dialogMode === 'view'}
                    placeholder="회사명을 입력하세요"
                    {...textFieldStyles}
                  />
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                      <span style={{ color: 'red' }}>*</span> 사업자등록번호
                    </Typography>
                    <TextField
                      fullWidth
                      value={formData.business_number}
                      onChange={(e) => setFormData({...formData, business_number: e.target.value})}
                      required
                      disabled={dialogMode === 'view'}
                      placeholder="사업자등록번호를 입력하세요"
                      {...textFieldStyles}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                      업종
                    </Typography>
                    <TextField
                      fullWidth
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                      disabled={dialogMode === 'view'}
                      placeholder="업종을 입력하세요"
                      {...textFieldStyles}
                    />
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                    대표자명
                  </Typography>
                  <TextField
                    fullWidth
                    value={formData.ceo_name}
                    onChange={(e) => setFormData({...formData, ceo_name: e.target.value})}
                    disabled={dialogMode === 'view'}
                    placeholder="대표자명을 입력하세요"
                    {...textFieldStyles}
                  />
                </Box>
              </Box>
            </Box>

            {/* 오른쪽: 연락처 및 기타 정보 */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                      전화번호
                    </Typography>
                    <TextField
                      fullWidth
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      disabled={dialogMode === 'view'}
                      placeholder="전화번호를 입력하세요"
                      {...textFieldStyles}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                      이메일
                    </Typography>
                    <TextField
                      fullWidth
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      disabled={dialogMode === 'view'}
                      placeholder="이메일을 입력하세요"
                      {...textFieldStyles}
                    />
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                    웹사이트
                  </Typography>
                  <TextField
                    fullWidth
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    disabled={dialogMode === 'view'}
                    placeholder="웹사이트를 입력하세요"
                    {...textFieldStyles}
                  />
                </Box>
                
                <Box>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                    {t('companyManagement.status')}
                  </Typography>
                  <FormControl fullWidth disabled={dialogMode === 'view'} variant="outlined" size="small">
                    <Select
                      variant="outlined"
                      value={formData.subscription_status}
                      onChange={(e) => setFormData({...formData, subscription_status: e.target.value})}
                      sx={{
                        ...textFieldStyles.sx,
                        height: 36,
                        minHeight: 36,
                        '& .MuiSelect-select': {
                          height: 36,
                          py: 0.75,
                          display: 'flex',
                          alignItems: 'center',
                          boxSizing: 'border-box'
                        }
                      }}
                    >
                      <MenuItem value="active">{t('companyManagement.active')}</MenuItem>
                      <MenuItem value="inactive">{t('companyManagement.inactive')}</MenuItem>
                      <MenuItem value="suspended">{t('companyManagement.suspended')}</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* 주소 입력창 (전체 너비) */}
          <Box>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
              주소 <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              fullWidth
              required
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              disabled={dialogMode === 'view'}
              placeholder="주소를 입력하세요"
              error={!formData.address || formData.address.trim() === ''}
              helperText={(!formData.address || formData.address.trim() === '') ? '주소는 필수 입력 항목입니다.' : ''}
              {...textFieldStyles}
            />
          </Box>

          {/* 세금 및 등록 번호 정보 */}
          {renderCollapsibleSection(
            'tax',
            '세금 및 등록 번호',
            (
              <>
{/* GST 번호 (최대 10개) */}
            <Box>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontSize: '0.75rem' }}>
                GST 번호 (최대 10개)
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(() => {
                  // GST 번호 배열 처리 - 빈 배열이거나 없으면 빈 문자열 하나 표시
                  let gstNumbersToShow: string[] = [];
                  if (formData.gst_numbers && Array.isArray(formData.gst_numbers) && formData.gst_numbers.length > 0) {
                    // 빈 문자열이 아닌 값만 필터링
                    gstNumbersToShow = formData.gst_numbers.filter((gst: string) => gst && gst.trim() !== '');
                    // 필터링 후 비어있으면 빈 문자열 하나 추가
                    if (gstNumbersToShow.length === 0) {
                      gstNumbersToShow = [''];
                    }
                  } else {
                    gstNumbersToShow = [''];
                  }
                  
                                    
                  return gstNumbersToShow;
                })().map((gstNumber: string, index: number) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <TextField
                        fullWidth
                        value={gstNumber || ''}
                        onChange={(e) => {
                          const currentGstNumbers = formData.gst_numbers || [''];
                          const newGstNumbers = [...currentGstNumbers];
                          newGstNumbers[index] = e.target.value;
                          setFormData({...formData, gst_numbers: newGstNumbers});
                        }}
                        disabled={dialogMode === 'view'}
                        placeholder={`GST 번호 ${index + 1}`}
                        {...textFieldStyles}
                      />
                    {dialogMode !== 'view' && (
                      <>
                        {index > 0 && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              const currentGstNumbers = formData.gst_numbers || [''];
                              const newGstNumbers = currentGstNumbers.filter((_, i) => i !== index);
                              setFormData({...formData, gst_numbers: newGstNumbers.length > 0 ? newGstNumbers : ['']});
                            }}
                            sx={{ mt: 0.5 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                        {index === (formData.gst_numbers?.length || 1) - 1 && 
                         (formData.gst_numbers?.length || 1) < 10 && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              const currentGstNumbers = formData.gst_numbers || [''];
                              setFormData({...formData, gst_numbers: [...currentGstNumbers, '']});
                            }}
                            sx={{ mt: 0.5, color: 'primary.main' }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        )}
                      </>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
            
            {/* MSME, IEC, PAN */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  MSME 번호
                </Typography>
                <TextField
                  fullWidth
                  value={formData.msme_number || ''}
                  onChange={(e) => setFormData({...formData, msme_number: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="MSME 번호를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  IEC 번호
                </Typography>
                <TextField
                  fullWidth
                  value={formData.iec_number || ''}
                  onChange={(e) => setFormData({...formData, iec_number: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="IEC 번호를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  PAN 번호
                </Typography>
                <TextField
                  fullWidth
                  value={formData.pan_number || ''}
                  onChange={(e) => setFormData({...formData, pan_number: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="PAN 번호를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
            </Box>
              </>
            )
          )}

          {/* 은행 정보 */}
          {renderCollapsibleSection(
            'bank',
            '은행 정보',
            (
              <>
<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  예금주
                </Typography>
                <TextField
                  fullWidth
                  value={formData.account_holder_name || ''}
                  onChange={(e) => setFormData({...formData, account_holder_name: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="예금주를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  은행명
                </Typography>
                <TextField
                  fullWidth
                  value={formData.bank_name || ''}
                  onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="은행명을 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  계좌번호
                </Typography>
                <TextField
                  fullWidth
                  value={formData.account_number || ''}
                  onChange={(e) => setFormData({...formData, account_number: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="계좌번호를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  IFSC 코드
                </Typography>
                <TextField
                  fullWidth
                  value={formData.ifsc_code || ''}
                  onChange={(e) => setFormData({...formData, ifsc_code: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="IFSC 코드를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  SWIFT 코드
                </Typography>
                <TextField
                  fullWidth
                  value={formData.swift_code || ''}
                  onChange={(e) => setFormData({...formData, swift_code: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="SWIFT 코드를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  은행 주소
                </Typography>
                <TextField
                  fullWidth
                  value={formData.bank_address || ''}
                  onChange={(e) => setFormData({...formData, bank_address: e.target.value})}
                  disabled={dialogMode === 'view'}
                  placeholder="은행 주소를 입력하세요"
                  {...textFieldStyles}
                />
              </Box>
            </Box>
              </>
            )
          )}

          {/* 송금 API (회사별) */}
          {renderCollapsibleSection(
            'transfer',
            t('companyManagement.bankTransferApiTitle'),
            (
              <>
<Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1 }}>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  {t('companyManagement.defaultBankProvider')}
                </Typography>
                <FormControl fullWidth size="small" disabled={dialogMode === 'view'}>
                  <Select
                    value={formData.settings?.bank_transfer?.defaultProvider || ''}
                    displayEmpty
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...(formData.settings || {}),
                          bank_transfer: {
                            ...(formData.settings?.bank_transfer || {}),
                            defaultProvider: e.target.value
                          }
                        }
                      })
                    }
                  >
                    <MenuItem value="">
                      <em>{t('companyManagement.bankProviderEnvDefault')}</em>
                    </MenuItem>
                    <MenuItem value="icici">ICICI</MenuItem>
                    <MenuItem value="kotak">Kotak</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mt: 0.5 }}>
                  ICICI
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  API URL
                </Typography>
                <TextField
                  fullWidth
                  value={formData.settings?.bank_transfer?.icici?.apiUrl || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      settings: {
                        ...(formData.settings || {}),
                        bank_transfer: {
                          ...(formData.settings?.bank_transfer || {}),
                          icici: {
                            ...(formData.settings?.bank_transfer?.icici || {}),
                            apiUrl: e.target.value
                          }
                        }
                      }
                    })
                  }
                  disabled={dialogMode === 'view'}
                  placeholder="https://..."
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  Transfer Path
                </Typography>
                <TextField
                  fullWidth
                  value={formData.settings?.bank_transfer?.icici?.transferPath || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      settings: {
                        ...(formData.settings || {}),
                        bank_transfer: {
                          ...(formData.settings?.bank_transfer || {}),
                          icici: {
                            ...(formData.settings?.bank_transfer?.icici || {}),
                            transferPath: e.target.value
                          }
                        }
                      }
                    })
                  }
                  disabled={dialogMode === 'view'}
                  placeholder="/transfers"
                  {...textFieldStyles}
                />
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  API Key
                  {formData.settings?.bank_transfer?.icici?.apiKeySet
                    ? ` (${t('companyManagement.apiKeySaved', '저장됨')})`
                    : ''}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    type="password"
                    autoComplete="new-password"
                    value={
                      formData.settings?.bank_transfer?.icici?.apiKey === '********'
                        ? ''
                        : formData.settings?.bank_transfer?.icici?.apiKey || ''
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...(formData.settings || {}),
                          bank_transfer: {
                            ...(formData.settings?.bank_transfer || {}),
                            icici: {
                              ...(formData.settings?.bank_transfer?.icici || {}),
                              apiKey: e.target.value
                            }
                          }
                        }
                      })
                    }
                    disabled={dialogMode === 'view'}
                    placeholder={
                      formData.settings?.bank_transfer?.icici?.apiKeySet
                        ? t('companyManagement.apiKeyKeepPlaceholder', '변경 시에만 입력 (비우면 유지)')
                        : t('companyManagement.apiKeyPlaceholder', 'API Key')
                    }
                    {...textFieldStyles}
                  />
                  {dialogMode !== 'view' && (
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={testingBankProvider !== null}
                      onClick={() => handleTestBankConnection('icici')}
                      sx={{
                        ...mvsBodyOutlinedBtnSx,
                        flexShrink: 0,
                        height: 36,
                        whiteSpace: 'nowrap',
                        px: 1.5
                      }}
                    >
                      {testingBankProvider === 'icici' ? (
                        <CircularProgress size={16} />
                      ) : (
                        t('companyManagement.bankTransferTestConnection')
                      )}
                    </Button>
                  )}
                </Box>
              </Box>

              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mt: 0.5 }}>
                  Kotak
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  API URL
                </Typography>
                <TextField
                  fullWidth
                  value={formData.settings?.bank_transfer?.kotak?.apiUrl || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      settings: {
                        ...(formData.settings || {}),
                        bank_transfer: {
                          ...(formData.settings?.bank_transfer || {}),
                          kotak: {
                            ...(formData.settings?.bank_transfer?.kotak || {}),
                            apiUrl: e.target.value
                          }
                        }
                      }
                    })
                  }
                  disabled={dialogMode === 'view'}
                  placeholder="https://..."
                  {...textFieldStyles}
                />
              </Box>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  Transfer Path
                </Typography>
                <TextField
                  fullWidth
                  value={formData.settings?.bank_transfer?.kotak?.transferPath || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      settings: {
                        ...(formData.settings || {}),
                        bank_transfer: {
                          ...(formData.settings?.bank_transfer || {}),
                          kotak: {
                            ...(formData.settings?.bank_transfer?.kotak || {}),
                            transferPath: e.target.value
                          }
                        }
                      }
                    })
                  }
                  disabled={dialogMode === 'view'}
                  placeholder="/transfers"
                  {...textFieldStyles}
                />
              </Box>
              <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  API Key
                  {formData.settings?.bank_transfer?.kotak?.apiKeySet
                    ? ` (${t('companyManagement.apiKeySaved', '저장됨')})`
                    : ''}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    fullWidth
                    type="password"
                    autoComplete="new-password"
                    value={
                      formData.settings?.bank_transfer?.kotak?.apiKey === '********'
                        ? ''
                        : formData.settings?.bank_transfer?.kotak?.apiKey || ''
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        settings: {
                          ...(formData.settings || {}),
                          bank_transfer: {
                            ...(formData.settings?.bank_transfer || {}),
                            kotak: {
                              ...(formData.settings?.bank_transfer?.kotak || {}),
                              apiKey: e.target.value
                            }
                          }
                        }
                      })
                    }
                    disabled={dialogMode === 'view'}
                    placeholder={
                      formData.settings?.bank_transfer?.kotak?.apiKeySet
                        ? t('companyManagement.apiKeyKeepPlaceholder', '변경 시에만 입력 (비우면 유지)')
                        : t('companyManagement.apiKeyPlaceholder', 'API Key')
                    }
                    {...textFieldStyles}
                  />
                  {dialogMode !== 'view' && (
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={testingBankProvider !== null}
                      onClick={() => handleTestBankConnection('kotak')}
                      sx={{
                        ...mvsBodyOutlinedBtnSx,
                        flexShrink: 0,
                        height: 36,
                        whiteSpace: 'nowrap',
                        px: 1.5
                      }}
                    >
                      {testingBankProvider === 'kotak' ? (
                        <CircularProgress size={16} />
                      ) : (
                        t('companyManagement.bankTransferTestConnection')
                      )}
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
              </>
            ),
            t('companyManagement.bankTransferApiHint'),
            { accent: true }
          )}

          {/* MVS 사용 기간 */}
          {renderCollapsibleSection(
            'mvs',
            'MVS 사용 기간',
            (
              <>
<Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  MVS 사용 시작일
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={formData.mvs_start_date}
                  onChange={(e) => setFormData({...formData, mvs_start_date: e.target.value})}
                  disabled={dialogMode === 'view'}
                  {...textFieldStyles}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.25, color: 'text.secondary', fontSize: '0.75rem' }}>
                  MVS 사용 종료일
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  value={formData.mvs_end_date}
                  onChange={(e) => setFormData({...formData, mvs_end_date: e.target.value})}
                  disabled={dialogMode === 'view'}
                  {...textFieldStyles}
                />
              </Box>
            </Box>
              </>
            )
          )}

          {/* 하단: 이미지 정보 */}
          {renderCollapsibleSection(
            'images',
            '회사 이미지 정보',
            (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                  {renderImageUpload('company_logo', '회사 로고')}
                  {renderImageUpload('company_seal', '회사 인장')}
                  {renderImageUpload('ceo_signature', '대표자 서명')}
                </Box>
              </>
            )
          )}

        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button 
          onClick={() => setOpenDialog(false)}
          sx={{ borderRadius: 2 }}
        >
          {dialogMode === 'view' ? t('companyManagement.close') : t('companyManagement.cancel')}
        </Button>
        {dialogMode === 'view' && (user?.role === 'root' || user?.role === 'admin') && (
          <Tooltip title={t('common.menuNoEdit')} disableHoverListener={menuFlags.menusLoading || menuFlags.canEdit}>
            <span style={{ display: 'inline-flex' }}>
              <Button 
                onClick={() => {
                  setDialogMode('edit');
                }} 
                variant="contained" 
                color="primary"
                disabled={menuFlags.menusLoading || !menuFlags.canEdit}
                sx={{ borderRadius: 2 }}
              >
                수정
              </Button>
            </span>
          </Tooltip>
        )}
        {dialogMode !== 'view' && (
          <Tooltip
            title={dialogMode === 'add' ? t('common.menuNoCreate') : t('common.menuNoEdit')}
            disableHoverListener={
              menuFlags.menusLoading ||
              (dialogMode === 'add' ? menuFlags.canCreate : menuFlags.canEdit)
            }
          >
            <span style={{ display: 'inline-flex' }}>
              <Button 
                onClick={handleSave} 
                variant="contained" 
                disabled={
                  loading ||
                  menuFlags.menusLoading ||
                  (dialogMode === 'add' ? !menuFlags.canCreate : !menuFlags.canEdit)
                }
                sx={{ borderRadius: 2 }}
              >
                {loading ? t('companyManagement.saving') : t('companyManagement.save')}
              </Button>
            </span>
          </Tooltip>
        )}
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('companyManagement.pageTitle')}
        description={t('companyManagement.description')}
      />

      {/* 알림 메시지 */}
      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {user?.role === 'root' && !IS_STANDALONE ? (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 2.5,
              mb: 3 }}
          >
            {[filteredCompanies.length, companies.length].map((value, idx) => (
              <Card key={idx === 0 ? 'mvs' : 'total'} elevation={0} sx={mvsKpiCardSx}>
                <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                    {idx === 0 ? t('companyManagement.mvsUsageCompanies') : t('companyManagement.totalCompanies')}
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                    {value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Card elevation={0} sx={mvsBodyCardSx}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
                px: { xs: 2, sm: 2.5 },
                py: 1.5,
                bgcolor: '#FFFFFF' }}
            >
              {!IS_STANDALONE && selectedCompanyIds.length > 0 ? (
                <Tooltip title={t('common.menuNoDelete')} disableHoverListener={menuFlags.menusLoading || menuFlags.canDelete}>
                  <span style={{ display: 'inline-flex' }}>
                    <Button
                      variant="contained"
                      color="error"
                      disableElevation
                      size="small"
                      startIcon={<DeleteIcon fontSize="small" />}
                      disabled={menuFlags.menusLoading || !menuFlags.canDelete}
                      onClick={handleDeleteSelected}
                      sx={{
                        textTransform: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        minHeight: 36,
                        px: 2,
                        boxShadow: 'none' }}
                    >
                      {t('companyManagement.deleteSelected')} ({selectedCompanyIds.length})
                    </Button>
                  </span>
                </Tooltip>
              ) : null}
              {!IS_STANDALONE && (
              <Tooltip title={t('common.menuNoCreate')} disableHoverListener={menuFlags.menusLoading || menuFlags.canCreate}>
                <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                  <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    startIcon={<AddIcon fontSize="small" />}
                    onClick={handleAdd}
                    disabled={menuFlags.menusLoading || !menuFlags.canCreate}
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {t('companyManagement.addCompany')}
                  </Button>
                </span>
              </Tooltip>
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
                  md: 'minmax(0, 1fr) auto' },
                gap: 2,
                alignItems: 'flex-end' }}
            >
              <TextField
                fullWidth
                size="small"
                label={t('common.search')}
                {...COMPANY_FILTER_OUTLINED}
                placeholder={t('companyManagement.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={menuFlags.menusLoading || !menuFlags.canRead}
                sx={companyFilterFieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                    </InputAdornment>
                  ) }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<ResetIcon fontSize="small" />}
                onClick={handleResetFilters}
                disabled={menuFlags.menusLoading || !menuFlags.canRead}
                sx={{
                  ...mvsBodyOutlinedBtnSx,
                  height: 40,
                  whiteSpace: 'nowrap' }}
              >
                {t('companyManagement.reset')}
              </Button>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            {loading ? (
              <Box sx={listStateBoxSx}>
                <CircularProgress size={36} />
                <Typography variant="body2" color="text.secondary">
                  {t('companyManagement.empty.loading')}
                </Typography>
              </Box>
            ) : sortedCompanies.length === 0 ? (
              <Box sx={listStateBoxSx}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
                  {hasActiveFilters
                    ? t('companyManagement.empty.noResults')
                    : t('companyManagement.empty.noItems')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                  {hasActiveFilters
                    ? t('companyManagement.empty.noResultsHint')
                    : t('companyManagement.empty.noItemsHint')}
                </Typography>
                {hasActiveFilters ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ResetIcon fontSize="small" />}
                    onClick={handleResetFilters}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {t('companyManagement.reset')}
                  </Button>
                ) : !IS_STANDALONE ? (
                  <Tooltip title={t('common.menuNoCreate')} disableHoverListener={menuFlags.menusLoading || menuFlags.canCreate}>
                    <span style={{ display: 'inline-flex' }}>
                      <Button
                        variant="contained"
                        disableElevation
                        size="small"
                        startIcon={<AddIcon fontSize="small" />}
                        disabled={menuFlags.menusLoading || !menuFlags.canCreate}
                        onClick={handleAdd}
                        sx={mvsBodyPrimaryBtnSx}
                      >
                        {t('companyManagement.addCompany')}
                      </Button>
                    </span>
                  </Tooltip>
                ) : null}
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
                  {t('companyManagement.listView.viewAll')}
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
                  {t('companyManagement.listView.viewPages')}
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
                      borderTop: 'none' } }}
                >
                  <TableHead
                    sx={(theme) => {
                      const headBase =
                        typeof mvsTableHeadHighlightSx === 'function'
                          ? mvsTableHeadHighlightSx(theme)
                          : mvsTableHeadHighlightSx;
                      return {
                        ...(headBase as object),
                        '& .MuiTableCell-head': {
                          py: 0.75,
                          px: { xs: 1, sm: 1.25 } },
                        '& .MuiTableCell-head.MuiTableCell-paddingCheckbox': {
                          ...companyCheckboxColSx,
                          overflow: 'visible' } };
                    }}
                  >
                    <TableRow>
                      <TableCell padding="checkbox" align="center" sx={{ ...thSx('select'), ...companyCheckboxColSx }}>
                        <Checkbox
                          size="small"
                          disabled={menuFlags.menusLoading || !menuFlags.canDelete || displayedCompanies.length === 0}
                          indeterminate={someVisibleSelected && !allVisibleSelected}
                          checked={allVisibleSelected}
                          onChange={handleSelectAll}
                          inputProps={{ 'aria-label': t('companyManagement.selectAll') }}
                        />
                      </TableCell>
                      {renderHeadSortCell('name', t('companyManagement.companyInfo'))}
                      {renderHeadSortCell('ceo_name', t('companyManagement.representative'))}
                      {renderHeadSortCell('industry', t('companyManagement.industry'))}
                      {renderHeadSortCell('employee_count', t('companyManagement.employeeCount'))}
                      {renderHeadSortCell('mvs_start', t('companyManagement.mvsUsagePeriod'))}
                      <TableCell align={compColTableAlign('actions')} sx={thSx('actions')}>
                        <Box
                          component="span"
                          sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            width: '100%',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}
                          title={t('companyManagement.actions')}
                        >
                          {t('companyManagement.actions')}
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={companyTableBodyRowSx}>
                    {displayedCompanies.map((company) => (
                      <TableRow
                        key={company.id}
                        onClick={() => {
                          if (!menuFlags.menusLoading && menuFlags.canRead) handleView(company);
                        }}
                        sx={{
                          cursor: menuFlags.menusLoading || !menuFlags.canRead ? 'default' : 'pointer',
                          '&:hover .company-delete-btn:not(.Mui-disabled)': {
                            color: 'error.main',
                            bgcolor: alpha(theme.palette.error.main, 0.08) } }}
                      >
                        <TableCell
                          padding="checkbox"
                          align="center"
                          sx={{ ...tdSx('select'), ...companyCheckboxColSx }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            size="small"
                            disabled={menuFlags.menusLoading || !menuFlags.canDelete}
                            checked={selectedCompanyIds.includes(company.id)}
                            onChange={() => handleToggleSelectCompany(company.id)}
                            inputProps={{ 'aria-label': t('companyManagement.selectItem', { name: company.name }) }}
                          />
                        </TableCell>
                        <TableCell align={compColTableAlign('name')} sx={tdSx('name')}>
                          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                            <Avatar
                              src={
                                company.company_logo
                                  ? getUploadUrl(company.company_logo) || undefined
                                  : undefined
                              }
                              imgProps={{ style: { objectFit: 'contain' } }}
                              sx={{
                                mr: 1.25,
                                width: 32,
                                height: 32,
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                flexShrink: 0,
                                bgcolor:
                                  theme.palette.mode === 'light'
                                    ? 'rgba(15, 23, 42, 0.08)'
                                    : alpha(theme.palette.common.white, 0.12),
                                color: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.75)' : theme.palette.grey[200] }}
                            >
                              {String(company.name ?? '').charAt(0) || '?'}
                            </Avatar>
                            <Typography
                              component="span"
                              fontWeight={600}
                              noWrap
                              title={company.name}
                              sx={{
                                ...companyListTextSx,
                                minWidth: 0,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'block' }}
                            >
                              {company.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align={compColTableAlign('ceo_name')} sx={tdSx('ceo_name')}>
                          <Typography component="span" noWrap title={company.ceo_name || '-'} sx={{ ...companyListTextSx, fontWeight: 600, display: 'block' }}>
                            {company.ceo_name || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align={compColTableAlign('industry')} sx={tdSx('industry')}>
                          <Typography component="span" noWrap title={company.industry || '-'} sx={{ ...companyListTextSx, display: 'block' }}>
                            {company.industry || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align={compColTableAlign('employee_count')} sx={tdSx('employee_count')}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                            <PeopleIcon sx={{ mr: 0.5, fontSize: '0.875rem', color: 'text.secondary', opacity: 0.7 }} />
                            <Typography component="span" noWrap sx={{ ...companyListTextSx, fontVariantNumeric: 'tabular-nums', display: 'block' }}>
                              {t('companyManagement.employeesCount', { count: company.employee_count })}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align={compColTableAlign('mvs_start')} sx={tdSx('mvs_start')}>
                          <Typography
                            component="span"
                            noWrap
                            title={
                              company.mvs_start_date && company.mvs_end_date
                                ? `${company.mvs_start_date} ~ ${company.mvs_end_date}`
                                : '-'
                            }
                            sx={{ ...companyListTextSx, fontVariantNumeric: 'tabular-nums', display: 'block' }}
                          >
                            {company.mvs_start_date && company.mvs_end_date
                              ? `${company.mvs_start_date} ~ ${company.mvs_end_date}`
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align={compColTableAlign('actions')} sx={tdSx('actions')} onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                            {!IS_STANDALONE && (
                            <Tooltip
                              title={
                                menuFlags.menusLoading || !menuFlags.canDelete
                                  ? t('common.menuNoDelete')
                                  : t('companyManagement.delete')
                              }
                            >
                              <span style={{ display: 'inline-flex' }}>
                                <IconButton
                                  className="company-delete-btn"
                                  size="small"
                                  disabled={menuFlags.menusLoading || !menuFlags.canDelete}
                                  onClick={() => handleDelete(company.id)}
                                  aria-label={t('companyManagement.delete')}
                                  sx={{
                                    color: alpha(theme.palette.text.secondary, theme.palette.mode === 'light' ? 0.72 : 1),
                                    borderRadius: '10px',
                                    transition: 'color 0.15s ease, background-color 0.15s ease',
                                    '&:hover': {
                                      color: 'error.main',
                                      bgcolor: alpha(theme.palette.error.main, 0.12) } }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
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
                        fontWeight: 500 } }}
                  />
                </Box>
              ) : (
                <Box sx={{ ...mvsBodyPaginationSx, py: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {t('companyManagement.listView.showingAll', { count: sortedCompanies.length })}
                  </Typography>
                </Box>
              )}
              </>
            )}
          </Box>
        </>
      ) : loading ? (
        <Box sx={listStateBoxSx}>
          <CircularProgress size={36} />
          <Typography variant="body2" color="text.secondary">
            {t('companyManagement.empty.loading')}
          </Typography>
        </Box>
      ) : (
        ownCompany ? (
          <Card elevation={0} sx={mvsBodyCardSx}>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 4 }}>
                <Typography variant="subtitle1" sx={{ ...companyDetailViewSx.cardTitle, color: tablePrimaryFg }}>
                  {t('companyManagement.companyInfo')}
                </Typography>
                {(user?.role === 'admin' || user?.role === 'root') && (
                  <Tooltip title={t('common.menuNoEdit')} disableHoverListener={menuFlags.menusLoading || menuFlags.canEdit}>
                    <span style={{ display: 'inline-flex' }}>
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon sx={{ fontSize: 18 }} />}
                        onClick={() => handleEdit(ownCompany)}
                        disabled={menuFlags.menusLoading || !menuFlags.canEdit}
                        sx={mvsBodyOutlinedBtnSx}
                      >
                        {t('companyManagement.edit')}
                      </Button>
                    </span>
                  </Tooltip>
                )}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {ownCompany.company_logo ? (
                    <Avatar
                      src={getUploadUrl(ownCompany.company_logo)}
                      sx={{
                        width: 100,
                        height: 100,
                        fontSize: '2.5rem',
                        bgcolor:
                          theme.palette.mode === 'light'
                            ? 'rgba(15, 23, 42, 0.08)'
                            : alpha(theme.palette.common.white, 0.12),
                        color: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.75)' : theme.palette.grey[200] }}
                    >
                      {ownCompany.name.charAt(0)}
                    </Avatar>
                  ) : (
                    <Avatar
                      sx={{
                        width: 100,
                        height: 100,
                        fontSize: '2.5rem',
                        bgcolor:
                          theme.palette.mode === 'light'
                            ? 'rgba(15, 23, 42, 0.08)'
                            : alpha(theme.palette.common.white, 0.12),
                        color: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.75)' : theme.palette.grey[200] }}
                    >
                      {ownCompany.name.charAt(0)}
                    </Avatar>
                  )}
                  <Box>
                    <Typography variant="h5" sx={companyDetailViewSx.companyName}>
                      {ownCompany.name}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={companyDetailViewSx.companyMeta}>
                      사업자번호: {ownCompany.business_number}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 4 }}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>대표자</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.ceo_name || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>업종</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.industry || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>직원 수</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.employee_count}명</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>{t('companyManagement.status')}</Typography>
                    {getStatusChip(ownCompany.subscription_status)}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>{t('companyManagement.contact')}</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.phone || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>이메일</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.email || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>MVS 사용 기간</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>
                      {ownCompany.mvs_start_date && ownCompany.mvs_end_date
                        ? `${ownCompany.mvs_start_date} ~ ${ownCompany.mvs_end_date}`
                        : '-'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>웹사이트</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.website || '-'}</Typography>
                  </Box>
                </Box>
                
                {ownCompany.address && (
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>주소</Typography>
                    <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.address}</Typography>
                  </Box>
                )}

                {/* 세금 및 등록 번호 */}
                {(ownCompany.gst_numbers?.some((gst: string) => gst && gst.trim() !== '') || ownCompany.msme_number || ownCompany.iec_number || ownCompany.pan_number) && (
                  <Box>
                    <Divider sx={{ my: 3, borderWidth: 1.5, borderColor: 'divider' }} />
                    <Typography variant="subtitle1" sx={companyDetailViewSx.sectionTitle}>세금 및 등록 번호</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 4 }}>
                      {ownCompany.gst_numbers?.some((gst: string) => gst && gst.trim() !== '') && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>GST 번호</Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {ownCompany.gst_numbers.filter((gst: string) => gst && gst.trim() !== '').map((gst: string, index: number) => (
                              <Typography key={index} variant="body1" sx={companyDetailViewSx.fieldValue}>{gst}</Typography>
                            ))}
                          </Box>
                        </Box>
                      )}
                      {ownCompany.msme_number && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>MSME 번호</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.msme_number}</Typography>
                        </Box>
                      )}
                      {ownCompany.iec_number && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>IEC 번호</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.iec_number}</Typography>
                        </Box>
                      )}
                      {ownCompany.pan_number && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>PAN 번호</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.pan_number}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                {/* 은행 정보 */}
                {(ownCompany.account_holder_name || ownCompany.bank_name || ownCompany.account_number || ownCompany.ifsc_code || ownCompany.swift_code || ownCompany.bank_address) && (
                  <Box>
                    <Divider sx={{ my: 3, borderWidth: 1.5, borderColor: 'divider' }} />
                    <Typography variant="subtitle1" sx={companyDetailViewSx.sectionTitle}>은행 정보</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 4 }}>
                      {ownCompany.account_holder_name && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>예금주</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.account_holder_name}</Typography>
                        </Box>
                      )}
                      {ownCompany.bank_name && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>은행명</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.bank_name}</Typography>
                        </Box>
                      )}
                      {ownCompany.account_number && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>계좌번호</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.account_number}</Typography>
                        </Box>
                      )}
                      {ownCompany.ifsc_code && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>IFSC 코드</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.ifsc_code}</Typography>
                        </Box>
                      )}
                      {ownCompany.swift_code && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>SWIFT 코드</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.swift_code}</Typography>
                        </Box>
                      )}
                      {ownCompany.bank_address && (
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>은행 주소</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.bank_address}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}

                {/* 로그인 기간 */}
                {(ownCompany.login_period_start || ownCompany.login_period_end) && (
                  <Box>
                    <Divider sx={{ my: 3, borderWidth: 1.5, borderColor: 'divider' }} />
                    <Typography variant="subtitle1" sx={companyDetailViewSx.sectionTitle}>로그인 기간</Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 4 }}>
                      {ownCompany.login_period_start && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>로그인 시작일</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.login_period_start}</Typography>
                        </Box>
                      )}
                      {ownCompany.login_period_end && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>로그인 종료일</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.login_period_end}</Typography>
                        </Box>
                      )}
                      {ownCompany.login_time_start && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>로그인 시작 시간</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.login_time_start}</Typography>
                        </Box>
                      )}
                      {ownCompany.login_time_end && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>로그인 종료 시간</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.login_time_end}</Typography>
                        </Box>
                      )}
                      {ownCompany.timezone && (
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ ...companyDetailViewSx.fieldLabel, mb: 1.5 }}>타임존</Typography>
                          <Typography variant="body1" sx={companyDetailViewSx.fieldValue}>{ownCompany.timezone}</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Box sx={listStateBoxSx}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {t('companyManagement.empty.noItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('companyManagement.empty.noItemsHint')}
            </Typography>
          </Box>
        )
      )}

      {/* 회사 상세 다이얼로그 */}
      {renderCompanyDialog()}

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

export default CompanyManagement;