import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Avatar,
  InputAdornment,
  MenuItem,
  Menu,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Snackbar,
  Alert,
  CircularProgress,
  useMediaQuery,
  Checkbox,
  Pagination,
  TableSortLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
} from '@mui/material';
import { alpha, useTheme, type SxProps, type Theme } from '@mui/material/styles';
import {
  Handshake as HandshakeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  Email as EmailIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  RemoveCircleOutline as RemoveIcon,
  FileDownload as FileDownloadIcon,
  RestartAlt as ResetIcon,
  MoreHoriz as MoreHorizIcon,
  MergeType as MergeTypeIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { api, companyService, partnerService } from '../../services/api';
import { useStore } from '../../store';
import {
  formatBankAccountDisplay,
  formatPhoneDisplay,
  hasNonDigitInput,
  normalizeBankAccountDigits,
  normalizeEmailLower,
  normalizeIfsc,
  normalizePhoneDigits,
} from '../../utils/personalInfoFormat';
import { showErrorPopup } from '../../utils/errorHandler';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
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
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import { normalizePartnerCompanyName } from '../../utils/partnerCompanyName';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';

const PARTNER_MENU_ROUTES = ['/basic-info/partners', '/basic-info', '/customers/info', '/customers'] as const;
/** Avoid ID collisions when merging customers into the partners list UI */
const CUSTOMER_LIST_ID_OFFSET = 2_000_000_000;
const PARTNERS_PER_PAGE = 15;

type ListViewMode = 'page' | 'all';
type PartnerSortKey =
  | 'company'
  | 'type'
  | 'industry'
  | 'contact'
  | 'gst';
type SortDirection = 'asc' | 'desc';

const listViewModeBarSx = {
  mb: 1.25,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 0.75,
} as const;

const listViewModeBtnSx = {
  height: 32,
  minWidth: 0,
  px: 1.5,
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.75rem',
  borderRadius: '10px',
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const,
};

const PARTNER_FILTER_OUTLINED = mvsOutlinedLabelProps;
const PARTNER_FORM_OUTLINED = mvsOutlinedLabelProps;
const partnerFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

/** 파트너 등록/수정 폼 아코디언 — 사용자 등록과 동일 패턴 */
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

const partnerFormSectionTitleSx = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  lineHeight: 1.25,
} as const;

const PART_COL_DEFAULTS: Record<string, number> = {
  select: 48,
  company: 390,
  type: 120,
  industry: 120,
  contact: 160,
  gst: 180,
  actions: 72,
};

const PART_COL_TOTAL = Object.values(PART_COL_DEFAULTS).reduce((s, n) => s + n, 0);

const PART_COL_ALIGN: Record<string, 'left' | 'right' | 'center'> = {
  select: 'center',
  company: 'left',
  type: 'left',
  industry: 'left',
  contact: 'left',
  gst: 'left',
  actions: 'center',
};

const PART_COL_MIN_WIDTH: Record<string, number> = {
  select: 48,
  company: 200,
  type: 88,
  industry: 72,
  contact: 100,
  gst: 140,
  actions: 56,
};

function partColWidthPct(key: string): string {
  const w = PART_COL_DEFAULTS[key] ?? 80;
  return `${(w / PART_COL_TOTAL) * 100}%`;
}

function partColTableAlign(key: string): 'left' | 'right' | 'center' {
  return PART_COL_ALIGN[key] ?? 'left';
}

const partnerTableBodyRowSx: SxProps<Theme> = (theme) => {
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
      lineHeight: 1.35,
    },
    '& .MuiTableCell-body.MuiTableCell-paddingCheckbox': {
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      px: cellPaddingX,
      py: 0.75,
    },
    '& .MuiTableRow-root:nth-of-type(odd)': { bgcolor: rowBg },
    '& .MuiTableRow-root:nth-of-type(even)': { bgcolor: rowBg },
    '& .MuiTableRow-root:hover': { bgcolor: hoverBg },
  };
};

const partnerListTextSx = {
  fontSize: 'inherit',
  lineHeight: 1.35,
} as const;

const partnerCheckboxColSx = {
  width: 48,
  minWidth: 48,
  maxWidth: 48,
  px: { xs: 1, sm: 1.25 },
  py: 0.75,
  boxSizing: 'border-box' as const,
} as const;

const partnerChipSx = { fontWeight: 500, borderRadius: '8px', fontSize: '0.75rem' } as const;

const formatPartnerGstDisplay = (gstNumbers: string[] | undefined) => {
  const list = (gstNumbers || []).map((gst) => String(gst || '').trim()).filter(Boolean);
  if (list.length === 0) return '-';
  return list.join(', ');
};

/** 인도 GSTIN(15자)의 3~12자리 = PAN (예: 37AAGCK5972Q6ZG → AAGCK5972Q) */
const extractPanFromGstin = (gstin: string): string => {
  const g = String(gstin || '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (g.length < 12) return '';
  const pan = g.slice(2, 12);
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) ? pan : '';
};

const resolvePanFromGstList = (gstNumbers: string[]): string => {
  for (const gst of gstNumbers) {
    const pan = extractPanFromGstin(gst);
    if (pan) return pan;
  }
  return '';
};

interface Partner {
  id: number;
  companyName: string;
  businessNumber: string;
  panNumber?: string;
  gstNumbers: string[];
  representative: string;
  businessType: 'partner' | 'customer' | 'customer_partner' | 'other' | 'room_guest';
  industry: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountHolder: string;
  contractStartDate: string;
  contractEndDate: string;
  status: 'active' | 'inactive' | 'suspended';
  notes: string;
  avatar?: string;
  /** partner = partners table; customer/room_guest = customers API */
  recordSource?: 'partner' | 'customer' | 'room_guest';
  sourceId?: number;
}

const PartnerManagement: React.FC = () => {
  const { t } = useTranslation();
  const warnDigitsOnlyField = useCallback(
    (raw: string, fieldLabelKey: string) => {
      if (!hasNonDigitInput(raw)) return;
      showErrorPopup(
        t('errors.digitsOnlyField', { field: t(fieldLabelKey) }),
        undefined,
        'warning'
      );
    },
    [t]
  );
  const user = useStore((s) => s.user);
  const canSelectCompany = false;
  const theme = useTheme();
  const isCompactToolbar = useMediaQuery(theme.breakpoints.down('md'));
  const menuFlags = useMenuRoutePermissionFlags(PARTNER_MENU_ROUTES);
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [listViewMode, setListViewMode] = useState<ListViewMode>('page');
  const [sortKey, setSortKey] = useState<PartnerSortKey>('company');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | 'add'>('view');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [notify, setNotify] = useState<{
    message: string;
    severity: 'error' | 'success' | 'info' | 'warning';
  } | null>(null);
  const [toolbarMenuAnchor, setToolbarMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<number[]>([]);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeKeepId, setMergeKeepId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  const [page, setPage] = useState(1);
  const [companyNameError, setCompanyNameError] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>(() =>
    user?.company_id != null && Number(user.company_id) > 0 ? Number(user.company_id) : ''
  );
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: number; name: string }>>([]);

  const effectiveCompanyId = useMemo(() => {
    if (!canSelectCompany) return undefined;
    return typeof selectedCompanyId === 'number' && selectedCompanyId > 0 ? selectedCompanyId : undefined;
  }, [canSelectCompany, selectedCompanyId]);

  useEffect(() => {
    if (!canSelectCompany) {
      setCompanyOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
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

  const formatPartners = useCallback((partnersData: any[]): Partner[] => {
    const mapped = partnersData.map((p: any) => ({
      id: p.id,
      companyName: p.company_name,
      businessNumber: p.business_number,
      panNumber: p.pan_number || '',
      gstNumbers: p.gstNumbers || (Array.isArray(p.gst_numbers) ? p.gst_numbers : []),
      representative: p.representative || '',
      businessType: p.business_type,
      industry: p.industry || '',
      address: p.address || '',
      phone: normalizePhoneDigits(p.phone || ''),
      email: normalizeEmailLower(p.email || ''),
      website: p.website || '',
      bankName: p.bank_name || '',
      accountNumber: normalizeBankAccountDigits(p.account_number || ''),
      ifsc: normalizeIfsc(p.bank_ifsc || ''),
      accountHolder: p.account_holder || '',
      contractStartDate: p.contract_start_date ? p.contract_start_date.split('T')[0] : '',
      contractEndDate: p.contract_end_date ? p.contract_end_date.split('T')[0] : '',
      status: p.status,
      notes: p.notes || '',
      recordSource: 'partner' as const,
      sourceId: p.id,
    }));
    // id 중복 제거 후, 동일 회사명(정규화)은 하나만 유지
    const byId = new Map<number, Partner>();
    for (const row of mapped) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
    const byName = new Map<string, Partner>();
    for (const row of Array.from(byId.values())) {
      const nameKey = normalizePartnerCompanyName(row.companyName).toLowerCase();
      if (!nameKey) {
        byName.set(`__id_${row.id}`, row);
        continue;
      }
      const existing = byName.get(nameKey);
      if (!existing || row.id < existing.id) {
        byName.set(nameKey, row);
      }
    }
    return Array.from(byName.values());
  }, []);

  const formatCustomersAsPartners = useCallback((customersData: any[], existingPartners: Partner[]): Partner[] => {
    const partnerNameKeys = new Set(
      existingPartners.map((p) => normalizePartnerCompanyName(p.companyName).toLowerCase()).filter(Boolean)
    );
    const partnerBizKeys = new Set(
      existingPartners
        .map((p) => String(p.businessNumber || '').trim().toLowerCase())
        .filter((v) => v && !v.startsWith('tally-') && v !== '-')
    );
    const partnerEmailKeys = new Set(
      existingPartners
        .map((p) => String(p.email || '').trim().toLowerCase())
        .filter((v) => v && v !== '-')
    );

    return customersData
      .map((c: any): Partner | null => {
        const sourceType = c.source_type === 'room_guest' ? 'room_guest' : 'customer';
        const name = String(c.name || '').trim();
        const biz = String(c.business_number || '').trim();
        const nameKey = normalizePartnerCompanyName(name).toLowerCase();

        // Skip legacy customers already represented in partners (keep hotel guests)
        if (sourceType === 'customer') {
          if (nameKey && partnerNameKeys.has(nameKey)) return null;
          if (biz && partnerBizKeys.has(biz.toLowerCase())) return null;
          const emailKey = String(c.email || '').trim().toLowerCase();
          if (emailKey && partnerEmailKeys.has(emailKey)) return null;
        }

        const listId = sourceType === 'room_guest' ? Number(c.id) : CUSTOMER_LIST_ID_OFFSET + Number(c.id);
        return {
          id: listId,
          companyName: normalizePartnerCompanyName(name) || name,
          businessNumber: biz || '-',
          panNumber: '',
          gstNumbers: [],
          representative: c.ceo_name || '',
          businessType: sourceType === 'room_guest' ? 'room_guest' : 'customer',
          industry: c.industry || '',
          address: c.address || '',
          phone: c.phone || '',
          email: c.email || '',
          website: c.website || '',
          bankName: '',
          accountNumber: '',
          ifsc: '',
          accountHolder: '',
          contractStartDate: '',
          contractEndDate: '',
          status: c.status === 'inactive' ? 'inactive' : 'active',
          notes:
            sourceType === 'room_guest'
              ? `[Hotel Guest] booking=${c.source_booking_id || c.id}`
              : '[Customer Info]',
          recordSource: sourceType,
          sourceId: Number(c.id),
        };
      })
      .filter((row): row is Partner => row != null);
  }, []);

  const removePartnersFromList = useCallback((ids: number[]) => {
    const idSet = new Set(ids);
    setPartners((prev) => prev.filter((partner) => !idSet.has(partner.id)));
    setSelectedPartnerIds((prev) => prev.filter((id) => !idSet.has(id)));
  }, []);

  // 파트너 + 고객정보(레거시/숙박손님) 통합 목록
  const loadPartners = useCallback(async () => {
    if (menuFlags.menusLoading || !menuFlags.canRead) {
      setPartners([]);
      setLoading(false);
      return;
    }
    if (canSelectCompany && !effectiveCompanyId) {
      setPartners([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [partnerResponse, customerResponse] = await Promise.all([
        partnerService.getPartners(effectiveCompanyId),
        api.get('/customers', { params: effectiveCompanyId ? { company_id: effectiveCompanyId } : undefined }).catch(() => ({ data: [] })),
      ]);
      const partnersData = Array.isArray(partnerResponse?.data)
        ? partnerResponse.data
        : Array.isArray(partnerResponse)
          ? partnerResponse
          : [];
      const customersRaw = Array.isArray((customerResponse as any)?.data?.data)
        ? (customerResponse as any).data.data
        : Array.isArray((customerResponse as any)?.data)
          ? (customerResponse as any).data
          : Array.isArray(customerResponse)
            ? customerResponse
            : [];

      useReferenceDataStore.setState({
        partners: { data: partnersData, fetchedAt: Date.now(), promise: null },
      });

      const partnerRows = formatPartners(partnersData);
      const customerRows = formatCustomersAsPartners(customersRaw, partnerRows);
      const merged = [...partnerRows, ...customerRows];
      // 회사명(정규화) 기준으로 하나만 — 파트너 행을 고객보다 우선
      const byName = new Map<string, Partner>();
      const nameless: Partner[] = [];
      for (const row of merged) {
        const nameKey = normalizePartnerCompanyName(row.companyName).toLowerCase();
        if (!nameKey) {
          nameless.push(row);
          continue;
        }
        const existing = byName.get(nameKey);
        if (!existing) {
          byName.set(nameKey, row);
          continue;
        }
        if (existing.recordSource !== 'partner' && row.recordSource === 'partner') {
          byName.set(nameKey, row);
        }
      }
      setPartners([...Array.from(byName.values()), ...nameless]);
    } catch {
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [menuFlags.menusLoading, menuFlags.canRead, formatPartners, formatCustomersAsPartners, canSelectCompany, effectiveCompanyId]);

  useEffect(() => {
    void loadPartners();
  }, [loadPartners]);
  const [formData, setFormData] = useState<Omit<Partner, 'id'>>({
    companyName: '',
    businessNumber: '',
    gstNumbers: [''],
    representative: '',
    businessType: 'partner',
    industry: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    accountHolder: '',
    contractStartDate: '',
    contractEndDate: '',
    status: 'active',
    notes: ''
  });

  const handleAdd = () => {
    setSelectedPartner(null);
    setDialogMode('add');
    setCompanyNameError('');
    setFormData({
      companyName: '',
      businessNumber: '',
      panNumber: '',
      gstNumbers: [''],
      representative: '',
      businessType: 'partner',
      industry: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      bankName: '',
      accountNumber: '',
      ifsc: '',
      accountHolder: '',
      contractStartDate: '',
      contractEndDate: '',
      status: 'active',
      notes: ''
    });
    setOpenDialog(true);
  };

  const handleView = (partner: Partner) => {
    setSelectedPartner(partner);
    setDialogMode('view');
    setCompanyNameError('');
    setFormData({
      companyName: partner.companyName,
      businessNumber: partner.businessNumber,
      panNumber: partner.panNumber || '',
      gstNumbers: partner.gstNumbers && partner.gstNumbers.length > 0 ? partner.gstNumbers : [''],
      representative: partner.representative,
      businessType: partner.businessType,
      industry: partner.industry,
      address: partner.address,
      phone: partner.phone,
      email: partner.email,
      website: partner.website,
      bankName: partner.bankName,
      accountNumber: partner.accountNumber,
      ifsc: partner.ifsc,
      accountHolder: partner.accountHolder,
      contractStartDate: partner.contractStartDate,
      contractEndDate: partner.contractEndDate,
      status: partner.status,
      notes: partner.notes
    });
    setOpenDialog(true);
  };

  const findDuplicatePartnerByName = useCallback(
    (companyName: string, exclude?: Partner | null) => {
      const nameKey = normalizePartnerCompanyName(companyName).toLowerCase();
      if (!nameKey) return null;
      return (
        partners.find((p) => {
          if (p.recordSource === 'room_guest') return false;
          if (exclude) {
            if (exclude.recordSource === 'partner' && p.recordSource === 'partner' && p.id === exclude.id) {
              return false;
            }
            if (
              exclude.recordSource === 'customer' &&
              p.recordSource === 'customer' &&
              p.sourceId === exclude.sourceId
            ) {
              return false;
            }
          }
          return normalizePartnerCompanyName(p.companyName).toLowerCase() === nameKey;
        }) || null
      );
    },
    [partners]
  );

  const validateCompanyName = useCallback(
    (rawName: string, exclude?: Partner | null) => {
      const normalized = normalizePartnerCompanyName(rawName);
      if (!normalized) {
        return t('partnerManagement.companyNameRequired', {
          defaultValue: '회사명을 입력해주세요.',
        });
      }
      const dup = findDuplicatePartnerByName(normalized, exclude);
      if (dup) {
        return t('partnerManagement.duplicateCompanyName', { name: normalized });
      }
      return '';
    },
    [findDuplicatePartnerByName, t]
  );

  const handleSave = async () => {
    if (selectedPartner?.recordSource === 'room_guest') {
      setNotify({ message: t('partnerManagement.roomGuestReadOnly'), severity: 'info' });
      return;
    }

    // GST 번호: 빈 값 제거 (필수 아님 — 건물주/소상공인 등)
    const validGstNumbers = formData.gstNumbers.filter(gst => gst.trim() !== '');
    const isLegacyCustomer = selectedPartner?.recordSource === 'customer';

    const formDataWithValidGst = {
      ...formData,
      companyName: normalizePartnerCompanyName(formData.companyName),
      businessNumber: String(formData.businessNumber || '').trim(),
      gstNumbers: validGstNumbers.length > 0 ? validGstNumbers : [''],
    };

    // Reflect normalized name in the form immediately
    setFormData((prev) => ({ ...prev, companyName: formDataWithValidGst.companyName }));

    const nameError = validateCompanyName(formDataWithValidGst.companyName, selectedPartner);
    setCompanyNameError(nameError);
    if (nameError) {
      setNotify({ message: nameError, severity: 'warning' });
      return;
    }

    try {
      if (isLegacyCustomer && selectedPartner?.sourceId) {
        const payload = {
          name: formDataWithValidGst.companyName,
          business_number: formDataWithValidGst.businessNumber,
          ceo_name: formDataWithValidGst.representative,
          phone: formDataWithValidGst.phone,
          email: formDataWithValidGst.email,
          address: formDataWithValidGst.address,
          website: formDataWithValidGst.website,
          industry: formDataWithValidGst.industry,
          status: formDataWithValidGst.status === 'suspended' ? 'inactive' : formDataWithValidGst.status,
        };
        await api.put(`/customers/${selectedPartner.sourceId}`, {
          ...payload,
          ...(effectiveCompanyId ? { company_id: effectiveCompanyId } : {}),
        });
      } else if (selectedPartner && (selectedPartner.recordSource || 'partner') === 'partner') {
        await partnerService.updatePartner(selectedPartner.id, formDataWithValidGst, effectiveCompanyId);
      } else {
        await partnerService.createPartner(formDataWithValidGst, effectiveCompanyId);
      }
      setOpenDialog(false);
      setCompanyNameError('');
      loadPartners();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || t('partnerManagement.saveError');
      if (error.response?.data?.code === 'DUPLICATE_COMPANY_NAME') {
        setCompanyNameError(errorMessage);
      }
      setNotify({ message: errorMessage, severity: 'error' });
    }
  };

  const handleGstNumberChange = (index: number, value: string) => {
    const cleaned = String(value || '')
      .replace(/[\s-]/g, '')
      .toUpperCase();
    const newGstNumbers = [...formData.gstNumbers];
    newGstNumbers[index] = cleaned;
    const panFromGst = resolvePanFromGstList(newGstNumbers);
    setFormData({
      ...formData,
      gstNumbers: newGstNumbers,
      ...(panFromGst ? { panNumber: panFromGst } : {}),
    });
  };

  const handleAddGstNumber = () => {
    if (formData.gstNumbers.length >= 10) {
      setNotify({ message: t('partnerManagement.gstMaxTen'), severity: 'warning' });
      return;
    }
    setFormData({ ...formData, gstNumbers: [...formData.gstNumbers, ''] });
  };

  const handleRemoveGstNumber = (index: number) => {
    if (formData.gstNumbers.length <= 1) {
      setFormData({ ...formData, gstNumbers: [''] });
      return;
    }
    const newGstNumbers = formData.gstNumbers.filter((_, i) => i !== index);
    setFormData({ ...formData, gstNumbers: newGstNumbers });
  };

  const handleDelete = (id: number) => {
    const row = partners.find((p) => p.id === id);
    if (row?.recordSource === 'room_guest') {
      setNotify({ message: t('partnerManagement.roomGuestReadOnly'), severity: 'info' });
      return;
    }
    showConfirm(
      t('partnerManagement.confirmDelete'),
      () => {
        void (async () => {
          try {
            if (row?.recordSource === 'customer' && row.sourceId) {
              await api.delete(`/customers/${row.sourceId}`);
            } else {
              await partnerService.deletePartner(id, effectiveCompanyId);
            }
            removePartnersFromList([id]);
            setNotify({
              message: t('partnerManagement.deleteSelectedSuccess', { count: 1 }),
              severity: 'success',
            });
            await loadPartners();
          } catch (error: any) {
            setNotify({
              message: error.response?.data?.message || t('partnerManagement.deleteError'),
              severity: 'error',
            });
          }
        })();
      },
      { confirmColor: 'error' }
    );
  };

  const handleDeleteSelected = () => {
    if (!menuFlags.canDelete) return;
    if (selectedPartnerIds.length === 0) return;

    const idsToDelete = selectedPartnerIds.filter((id) => {
      const row = partners.find((p) => p.id === id);
      return row?.recordSource !== 'room_guest';
    });
    if (idsToDelete.length === 0) {
      setNotify({ message: t('partnerManagement.roomGuestReadOnly'), severity: 'info' });
      return;
    }

    showConfirm(
      t('partnerManagement.deleteSelectedConfirm', { count: idsToDelete.length }),
      () => {
        void (async () => {
          try {
            await Promise.all(
              idsToDelete.map((id) => {
                const row = partners.find((p) => p.id === id);
                if (row?.recordSource === 'customer' && row.sourceId) {
                  return api.delete(`/customers/${row.sourceId}`);
                }
                return partnerService.deletePartner(id, effectiveCompanyId);
              })
            );
            removePartnersFromList(idsToDelete);
            setNotify({
              message: t('partnerManagement.deleteSelectedSuccess', { count: idsToDelete.length }),
              severity: 'success',
            });
            await loadPartners();
          } catch (error: any) {
            setNotify({
              message: error.response?.data?.message || t('partnerManagement.deleteError'),
              severity: 'error',
            });
          }
        })();
      },
      {
        title: t('common.confirm'),
        confirmColor: 'error',
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
      }
    );
  };

  // Excel 샘플 다운로드
  const handleDownloadSample = async () => {
    try {
      await partnerService.downloadExcelSample();
    } catch (error: any) {
      setNotify({ message: t('partnerManagement.excelSampleDownloadError'), severity: 'error' });
    }
  };

  // Excel 파일 내보내기
  const handleExportExcel = async () => {
    try {
      await partnerService.exportExcel(effectiveCompanyId);
    } catch (error: any) {
      setNotify({ message: t('partnerManagement.excelExportError'), severity: 'error' });
    }
  };

  // Excel 파일 선택
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  // Excel 파일 가져오기
  const handleImportExcel = async () => {
    if (!importFile) {
      setNotify({ message: t('partnerManagement.selectExcelFilePlease'), severity: 'warning' });
      return;
    }

    setImportLoading(true);
    setImportResult(null);

    try {
      const result = await partnerService.importExcel(importFile, effectiveCompanyId);
      setImportResult(result);
      
      if (result.success && result.data) {
        const { success, failed, total } = result.data;
        const msg = t('partnerManagement.importSuccessMessage', { total, success: success.length })
          + (failed.length > 0 ? '\n' + t('partnerManagement.importFailedPart', { count: failed.length }) : '');
        setNotify({ message: msg, severity: failed.length > 0 ? 'warning' : 'success' });
        
        // 성공한 경우 목록 새로고침
        if (success.length > 0) {
          loadPartners();
        }
        
        // 다이얼로그 닫기
        setImportDialogOpen(false);
        setImportFile(null);
      }
    } catch (error: any) {
      setNotify({
        message: error.response?.data?.message || t('partnerManagement.importError'),
        severity: 'error'
      });
    } finally {
      setImportLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const typeConfig: Record<string, string> = {
      partner: t('partnerManagement.typePartner'),
      customer: t('partnerManagement.typeCustomer'),
      customer_partner: t('partnerManagement.typeCustomerPartner'),
      other: t('partnerManagement.typeOther'),
      room_guest: t('partnerManagement.typeRoomGuest'),
    };
    return typeConfig[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colorConfig: Record<string, string> = {
      partner: 'primary',
      customer: 'success',
      customer_partner: 'info',
      other: 'default',
      room_guest: 'warning',
    };
    return colorConfig[type] || 'default';
  };

  const getSortValue = (partner: Partner, key: PartnerSortKey): string => {
    switch (key) {
      case 'company':
        return String(partner.companyName || '').toLowerCase();
      case 'type':
        return String(partner.businessType || '').toLowerCase();
      case 'industry':
        return String(partner.industry || '').toLowerCase();
      case 'contact':
        return String(partner.email || partner.phone || '').toLowerCase();
      case 'gst':
        return formatPartnerGstDisplay(partner.gstNumbers).toLowerCase();
      default:
        return '';
    }
  };

  const filteredPartners = useMemo(() => {
    const filtered = partners.filter((partner) => {
      const matchesSearch =
        searchTerm === '' ||
        partner.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (partner.representative &&
          partner.representative.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (partner.industry && partner.industry.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (partner.address && partner.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
        partner.businessNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (partner.gstNumbers || []).some((gst) =>
          String(gst || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesType =
        typeFilter === 'all' ||
        partner.businessType === typeFilter ||
        (typeFilter === 'customer' &&
          (partner.recordSource === 'customer' || partner.businessType === 'customer'));
      return matchesSearch && matchesType;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return String(a.companyName || '').localeCompare(String(b.companyName || ''), undefined, {
        sensitivity: 'base',
      });
    });
    return sorted;
  }, [partners, searchTerm, typeFilter, sortKey, sortDirection]);

  const handleSort = (key: PartnerSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const partnerStats = useMemo(() => {
    const isPartnerType = (p: Partner) =>
      p.businessType === 'partner' || p.businessType === 'customer_partner';
    const isCustomerType = (p: Partner) =>
      p.businessType === 'customer' ||
      p.businessType === 'customer_partner' ||
      p.recordSource === 'customer';
    const isRoomGuest = (p: Partner) =>
      p.businessType === 'room_guest' || p.recordSource === 'room_guest';

    return {
      total: partners.length,
      active: partners.filter((p) => p.status === 'active').length,
      partners: partners.filter((p) => !isRoomGuest(p) && isPartnerType(p)).length,
      customers: partners.filter((p) => !isRoomGuest(p) && isCustomerType(p)).length,
    };
  }, [partners]);

  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / PARTNERS_PER_PAGE));

  const paginatedPartners = useMemo(() => {
    if (listViewMode === 'all') return filteredPartners;
    return filteredPartners.slice((page - 1) * PARTNERS_PER_PAGE, page * PARTNERS_PER_PAGE);
  }, [filteredPartners, page, listViewMode]);

  const visiblePartnerIds = useMemo(
    () => paginatedPartners.map((partner) => partner.id),
    [paginatedPartners]
  );

  const allVisibleSelected =
    visiblePartnerIds.length > 0 && visiblePartnerIds.every((id) => selectedPartnerIds.includes(id));
  const someVisibleSelected = visiblePartnerIds.some((id) => selectedPartnerIds.includes(id));

  useEffect(() => {
    setPage(1);
    setSelectedPartnerIds([]);
  }, [searchTerm, typeFilter, listViewMode]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!menuFlags.canDelete) return;
    if (event.target.checked) {
      setSelectedPartnerIds(visiblePartnerIds);
    } else {
      setSelectedPartnerIds([]);
    }
  };

  const handleToggleSelectPartner = (id: number) => {
    if (!menuFlags.canDelete) return;
    setSelectedPartnerIds((prev) =>
      prev.includes(id) ? prev.filter((partnerId) => partnerId !== id) : [...prev, id]
    );
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() || typeFilter !== 'all'
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
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

  const thLabelEllipsisSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: '1 1 auto',
  } as const;

  const partnerColBaseSx = (key: string) => ({
    width: partColWidthPct(key),
    minWidth: PART_COL_MIN_WIDTH[key] ?? 0,
    maxWidth: partColWidthPct(key),
    textAlign: partColTableAlign(key),
    verticalAlign: 'middle' as const,
    boxSizing: 'border-box' as const,
    px: { xs: 1, sm: 1.25 },
    py: 0.75,
    overflow: 'hidden',
  });

  const thSx = (key: string) => {
    const align = partColTableAlign(key);
    return {
      ...partnerColBaseSx(key),
      '& .MuiTableSortLabel-root': {
        color: 'inherit',
        display: 'inline-flex',
        width: '100%',
        maxWidth: '100%',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        overflow: 'hidden',
        ...(align === 'right' ? { flexDirection: 'row-reverse' as const } : {}),
      },
      '& .MuiTableSortLabel-icon': {
        flexShrink: 0,
      },
    };
  };

  const tdSx = (key: string) => ({
    ...partnerColBaseSx(key),
    textOverflow:
      key === 'industry' || key === 'contact' || key === 'gst'
        ? ('ellipsis' as const)
        : undefined,
  });

  const renderHeadCell = (key: string, label: string, sortable?: PartnerSortKey) => (
    <TableCell key={key} align={partColTableAlign(key)} sx={thSx(key)}>
      {sortable ? (
        <TableSortLabel
          active={sortKey === sortable}
          direction={sortKey === sortable ? sortDirection : 'asc'}
          onClick={() => handleSort(sortable)}
          sx={{
            '& .MuiTableSortLabel-icon': { color: 'inherit !important' },
          }}
        >
          <Box
            component="span"
            sx={{
              ...thLabelEllipsisSx,
              display: 'block',
              width: '100%',
            }}
            title={label}
          >
            {label}
          </Box>
        </TableSortLabel>
      ) : (
        <Box
          component="span"
          sx={{
            ...thLabelEllipsisSx,
            display: key === 'actions' ? 'flex' : 'block',
            justifyContent: key === 'actions' ? 'center' : undefined,
            width: '100%',
          }}
          title={label}
        >
          {label}
        </Box>
      )}
    </TableCell>
  );

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('partnerManagement.pageTitle')}
        description={t('partnerManagement.description')}
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
                setPage(1);
                setSelectedPartnerIds([]);
              }}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disableClearable={Boolean(
                typeof selectedCompanyId === 'number' &&
                  companyOptions.some((c) => c.id === selectedCompanyId)
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
                  label={t('partnerManagement.company')}
                  placeholder={t('partnerManagement.searchCompany', {
                    defaultValue: '회사명 검색',
                  })}
                  {...mvsOutlinedLabelProps}
                  sx={{ ...companySelectNowrapSx }}
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

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2.5,
          mb: 3,
        }}
      >
        {[
          { key: 'total', label: t('partnerManagement.stats.total'), value: partnerStats.total },
          { key: 'active', label: t('partnerManagement.stats.active'), value: partnerStats.active },
          { key: 'partners', label: t('partnerManagement.stats.partners'), value: partnerStats.partners },
          { key: 'customers', label: t('partnerManagement.stats.customers'), value: partnerStats.customers },
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
                <Tooltip title={t('common.menuNoView')} disableHoverListener={menuFlags.menusLoading || menuFlags.canRead}>
                  <span style={{ display: 'inline-flex' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<MoreHorizIcon fontSize="small" />}
                      disabled={menuFlags.menusLoading}
                      onClick={(e) => setToolbarMenuAnchor(e.currentTarget)}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('partnerManagement.moreTools')}
                    </Button>
                  </span>
                </Tooltip>
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
                    disabled={menuFlags.menusLoading || !menuFlags.canRead}
                    onClick={() => {
                      closeToolbarMenu();
                      handleDownloadSample();
                    }}
                  >
                    <ListItemIcon>
                      <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    {t('partnerManagement.excelSampleDownload')}
                  </MenuItem>
                  <MenuItem
                    disabled={menuFlags.menusLoading || !menuFlags.canRead}
                    onClick={() => {
                      closeToolbarMenu();
                      handleExportExcel();
                    }}
                  >
                    <ListItemIcon>
                      <FileDownloadIcon fontSize="small" />
                    </ListItemIcon>
                    {t('partnerManagement.excelExport')}
                  </MenuItem>
                  <MenuItem
                    disabled={menuFlags.menusLoading || !menuFlags.canMutate}
                    onClick={() => {
                      closeToolbarMenu();
                      setImportDialogOpen(true);
                    }}
                  >
                    <ListItemIcon>
                      <UploadIcon fontSize="small" />
                    </ListItemIcon>
                    {t('partnerManagement.excelImport')}
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Tooltip title={t('common.menuNoView')} disableHoverListener={menuFlags.menusLoading || menuFlags.canRead}>
                  <span style={{ display: 'inline-flex' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon fontSize="small" />}
                      disabled={menuFlags.menusLoading || !menuFlags.canRead}
                      onClick={handleDownloadSample}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('partnerManagement.excelSampleDownload')}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={t('common.menuNoView')} disableHoverListener={menuFlags.menusLoading || menuFlags.canRead}>
                  <span style={{ display: 'inline-flex' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadIcon fontSize="small" />}
                      disabled={menuFlags.menusLoading || !menuFlags.canRead}
                      onClick={handleExportExcel}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('partnerManagement.excelExport')}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={t('common.menuNoMutate')} disableHoverListener={menuFlags.menusLoading || menuFlags.canMutate}>
                  <span style={{ display: 'inline-flex' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<UploadIcon fontSize="small" />}
                      disabled={menuFlags.menusLoading || !menuFlags.canMutate}
                      onClick={() => setImportDialogOpen(true)}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('partnerManagement.excelImport')}
                    </Button>
                  </span>
                </Tooltip>
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
            {selectedPartnerIds.length > 0 ? (
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
                      boxShadow: 'none',
                    }}
                  >
                    {t('partnerManagement.deleteSelected')} ({selectedPartnerIds.length})
                  </Button>
                </span>
              </Tooltip>
            ) : null}
            <Tooltip title={t('common.menuNoCreate')} disableHoverListener={menuFlags.menusLoading || menuFlags.canCreate}>
              <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                <Button
                  variant="contained"
                  disableElevation
                  size="small"
                  startIcon={<AddIcon fontSize="small" />}
                  disabled={menuFlags.menusLoading || !menuFlags.canCreate}
                  onClick={handleAdd}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {t('partnerManagement.addPartner')}
                </Button>
              </span>
            </Tooltip>
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
              sm: 'minmax(0, 1fr) minmax(0, 1fr) auto',
              lg: 'minmax(0, 2fr) minmax(0, 1fr) auto',
            },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            fullWidth
            size="small"
            label={t('common.search')}
            {...PARTNER_FILTER_OUTLINED}
            placeholder={t('partnerManagement.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={menuFlags.menusLoading || !menuFlags.canRead}
            sx={partnerFilterFieldSx}
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
            label={t('partnerManagement.companyType')}
            {...PARTNER_FILTER_OUTLINED}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            disabled={menuFlags.menusLoading || !menuFlags.canRead}
            SelectProps={{ displayEmpty: true }}
            sx={partnerFilterFieldSx}
          >
            <MenuItem value="all">{t('partnerManagement.allTypes')}</MenuItem>
            <MenuItem value="partner">{t('partnerManagement.typePartner')}</MenuItem>
            <MenuItem value="customer">{t('partnerManagement.typeCustomer')}</MenuItem>
            <MenuItem value="customer_partner">{t('partnerManagement.typeCustomerPartner')}</MenuItem>
            <MenuItem value="room_guest">{t('partnerManagement.typeRoomGuest')}</MenuItem>
            <MenuItem value="other">{t('partnerManagement.typeOther')}</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ResetIcon fontSize="small" />}
            onClick={handleResetFilters}
            disabled={menuFlags.menusLoading || !menuFlags.canRead}
            sx={{
              ...mvsBodyOutlinedBtnSx,
              height: 40,
              whiteSpace: 'nowrap',
            }}
          >
            {t('partnerManagement.reset')}
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('partnerManagement.empty.loading')}
            </Typography>
          </Box>
        ) : filteredPartners.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <HandshakeIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {hasActiveFilters
                ? t('partnerManagement.empty.noResults')
                : t('partnerManagement.empty.noItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {hasActiveFilters
                ? t('partnerManagement.empty.noResultsHint')
                : t('partnerManagement.empty.noItemsHint')}
            </Typography>
            {hasActiveFilters ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ResetIcon fontSize="small" />}
                onClick={handleResetFilters}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('partnerManagement.reset')}
              </Button>
            ) : (
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
                    {t('partnerManagement.addPartner')}
                  </Button>
                </span>
              </Tooltip>
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
                {t('partnerManagement.listView.viewAll')}
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
                {t('partnerManagement.listView.viewPages')}
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
                      px: { xs: 1, sm: 1.25 },
                    },
                    '& .MuiTableCell-head.MuiTableCell-paddingCheckbox': {
                      ...partnerCheckboxColSx,
                      overflow: 'visible',
                    },
                  };
                }}
              >
                <TableRow>
                  <TableCell padding="checkbox" align="center" sx={{ ...thSx('select'), ...partnerCheckboxColSx }}>
                    <Checkbox
                      size="small"
                      disabled={menuFlags.menusLoading || !menuFlags.canDelete || paginatedPartners.length === 0}
                      indeterminate={someVisibleSelected && !allVisibleSelected}
                      checked={allVisibleSelected}
                      onChange={handleSelectAll}
                      inputProps={{ 'aria-label': t('partnerManagement.selectAll') }}
                    />
                  </TableCell>
                  {renderHeadCell('company', t('partnerManagement.companyInfo'), 'company')}
                  {renderHeadCell('type', t('partnerManagement.companyType'), 'type')}
                  {renderHeadCell('industry', t('partnerManagement.industry'), 'industry')}
                  {renderHeadCell('contact', t('partnerManagement.contact'), 'contact')}
                  {renderHeadCell('gst', t('partnerManagement.gstNumber'), 'gst')}
                  {renderHeadCell('actions', t('partnerManagement.actions'))}
                </TableRow>
              </TableHead>
              <TableBody sx={partnerTableBodyRowSx}>
                {paginatedPartners.map((partner) => (
                  <TableRow
                    key={partner.id}
                    onClick={() => {
                      if (!menuFlags.menusLoading && menuFlags.canRead) handleView(partner);
                    }}
                    sx={{
                      cursor: menuFlags.menusLoading || !menuFlags.canRead ? 'default' : 'pointer',
                      '&:hover .partner-delete-btn:not(.Mui-disabled)': {
                        color: 'error.main',
                        bgcolor: alpha(theme.palette.error.main, 0.08),
                      },
                    }}
                  >
                    <TableCell
                      padding="checkbox"
                      align="center"
                      sx={{ ...tdSx('select'), ...partnerCheckboxColSx }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        size="small"
                        disabled={menuFlags.menusLoading || !menuFlags.canDelete}
                        checked={selectedPartnerIds.includes(partner.id)}
                        onChange={() => handleToggleSelectPartner(partner.id)}
                        inputProps={{ 'aria-label': t('partnerManagement.selectItem', { name: partner.companyName }) }}
                      />
                    </TableCell>
                    <TableCell align={partColTableAlign('company')} sx={tdSx('company')}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', minWidth: 0 }}>
                        <Avatar
                          sx={{
                            mr: 1.25,
                            mt: 0.125,
                            width: 32,
                            height: 32,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            flexShrink: 0,
                            bgcolor:
                              theme.palette.mode === 'light'
                                ? 'rgba(15, 23, 42, 0.08)'
                                : alpha(theme.palette.common.white, 0.12),
                            color: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.75)' : theme.palette.grey[200],
                          }}
                        >
                          {partner.companyName.charAt(0)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            component="span"
                            fontWeight={500}
                            title={partner.companyName}
                            sx={{
                              ...partnerListTextSx,
                              display: 'block',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                            }}
                          >
                            {partner.companyName}
                          </Typography>
                          {(partner.businessNumber && partner.businessNumber !== '-') || partner.panNumber ? (
                            <Typography
                              component="span"
                              color="text.secondary"
                              sx={{
                                ...partnerListTextSx,
                                display: 'block',
                                mt: 0.25,
                                fontSize: '0.75rem',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                              }}
                            >
                              {[
                                partner.businessNumber && partner.businessNumber !== '-'
                                  ? `CIN ${partner.businessNumber}`
                                  : '',
                                partner.panNumber ? `PAN ${partner.panNumber}` : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Typography>
                          ) : null}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align={partColTableAlign('type')} sx={tdSx('type')}>
                      <Chip
                        label={getTypeLabel(partner.businessType)}
                        color={getTypeColor(partner.businessType) as any}
                        size="small"
                        sx={partnerChipSx}
                      />
                    </TableCell>
                    <TableCell align={partColTableAlign('industry')} sx={tdSx('industry')}>
                      <Typography component="span" color="text.secondary" noWrap title={partner.industry} sx={{ ...partnerListTextSx, display: 'block' }}>
                        {partner.industry}
                      </Typography>
                    </TableCell>
                    <TableCell align={partColTableAlign('contact')} sx={tdSx('contact')}>
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                        <EmailIcon sx={{ mr: 0.5, fontSize: '0.875rem', color: 'text.secondary', flexShrink: 0 }} />
                        <Typography component="span" noWrap title={partner.email || '-'} sx={{ ...partnerListTextSx, display: 'block' }}>
                          {partner.email || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align={partColTableAlign('gst')} sx={tdSx('gst')}>
                      <Typography
                        component="span"
                        color="text.secondary"
                        title={formatPartnerGstDisplay(partner.gstNumbers)}
                        sx={{
                          ...partnerListTextSx,
                          display: 'block',
                          whiteSpace: 'normal',
                          wordBreak: 'break-all',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatPartnerGstDisplay(partner.gstNumbers)}
                      </Typography>
                    </TableCell>
                    <TableCell align={partColTableAlign('actions')} sx={tdSx('actions')} onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip
                          title={
                            partner.recordSource === 'room_guest'
                              ? t('partnerManagement.roomGuestReadOnly')
                              : menuFlags.menusLoading || !menuFlags.canDelete
                                ? t('common.menuNoDelete')
                                : t('partnerManagement.delete')
                          }
                        >
                          <span style={{ display: 'inline-flex' }}>
                            <IconButton
                              className="partner-delete-btn"
                              size="small"
                              disabled={
                                menuFlags.menusLoading ||
                                !menuFlags.canDelete ||
                                partner.recordSource === 'room_guest'
                              }
                              onClick={() => handleDelete(partner.id)}
                              aria-label={t('partnerManagement.delete')}
                              sx={{
                                color: alpha(theme.palette.text.secondary, theme.palette.mode === 'light' ? 0.72 : 1),
                                borderRadius: '10px',
                                transition: 'color 0.15s ease, background-color 0.15s ease',
                                '&:hover': {
                                  color: 'error.main',
                                  bgcolor: alpha(theme.palette.error.main, 0.12),
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {listViewMode === 'page' && totalPages > 1 && (
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
          )}
          </>
        )}
      </Box>

      {/* 파트너 추가/수정/보기 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogMode === 'view' ? t('partnerManagement.viewPartner') : dialogMode === 'edit' ? t('partnerManagement.editPartner') : t('partnerManagement.addNewPartner')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, mt: 1 }}>
            <Accordion defaultExpanded sx={getAccordionFormSx(theme)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography component="h3" sx={partnerFormSectionTitleSx}>
                  {t('partnerManagement.sectionBasic')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.companyName')}
                      required
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.companyName}
                      onChange={(e) => {
                        setFormData({ ...formData, companyName: e.target.value });
                        if (companyNameError) setCompanyNameError('');
                      }}
                      onBlur={() => {
                        if (dialogMode === 'view') return;
                        const normalized = normalizePartnerCompanyName(formData.companyName);
                        if (normalized !== formData.companyName) {
                          setFormData((prev) => ({ ...prev, companyName: normalized }));
                        }
                        setCompanyNameError(
                          validateCompanyName(normalized || formData.companyName, selectedPartner)
                        );
                      }}
                      placeholder={t('partnerManagement.placeholderCompanyName')}
                      disabled={dialogMode === 'view'}
                      error={dialogMode !== 'view' && Boolean(companyNameError)}
                      helperText={dialogMode !== 'view' ? companyNameError : ''}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.businessNumber')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.businessNumber}
                      onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                      placeholder={t('partnerManagement.placeholderBusinessNumber')}
                      disabled={dialogMode === 'view'}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    label={t('partnerManagement.panNumber')}
                    {...PARTNER_FORM_OUTLINED}
                    value={formData.panNumber || ''}
                    onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                    placeholder={t('partnerManagement.placeholderPan')}
                    disabled={dialogMode === 'view'}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {t('partnerManagement.gstNumber')}
                        <Typography component="span" variant="caption" sx={{ ml: 0.75, fontWeight: 400 }}>
                          {t('partnerManagement.gstNumberMinMax')}
                        </Typography>
                      </Typography>
                      {dialogMode !== 'view' && (
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={handleAddGstNumber}
                          disabled={formData.gstNumbers.length >= 10}
                          sx={{ fontSize: '0.75rem', minWidth: 'auto', px: 1.5 }}
                        >
                          {t('partnerManagement.add')}
                        </Button>
                      )}
                    </Box>
                    {formData.gstNumbers.map((gstNumber, index) => (
                      <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <TextField
                          fullWidth
                          size="small"
                          label={t('partnerManagement.placeholderGst', { index: index + 1 })}
                          {...PARTNER_FORM_OUTLINED}
                          value={gstNumber}
                          onChange={(e) => handleGstNumberChange(index, e.target.value)}
                          placeholder={t('partnerManagement.placeholderGst', { index: index + 1 })}
                          disabled={dialogMode === 'view'}
                        />
                        {dialogMode !== 'view' && (
                          <IconButton
                            onClick={() => handleRemoveGstNumber(index)}
                            disabled={formData.gstNumbers.length <= 1}
                            color="error"
                            sx={{ mt: 0.5 }}
                          >
                            <RemoveIcon />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.representativeName')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.representative}
                      onChange={(e) => setFormData({ ...formData, representative: e.target.value })}
                      placeholder={t('partnerManagement.placeholderRepresentative')}
                      disabled={dialogMode === 'view'}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      select
                      label={t('partnerManagement.companyType')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.businessType}
                      onChange={(e) => setFormData({ ...formData, businessType: e.target.value as any })}
                      disabled={dialogMode === 'view'}
                    >
                      <MenuItem value="partner">{t('partnerManagement.typePartner')}</MenuItem>
                      <MenuItem value="customer">{t('partnerManagement.typeCustomer')}</MenuItem>
                      <MenuItem value="customer_partner">{t('partnerManagement.typeCustomerPartner')}</MenuItem>
                      <MenuItem value="other">{t('partnerManagement.typeOther')}</MenuItem>
                    </TextField>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.industry')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      placeholder={t('partnerManagement.placeholderIndustry')}
                      disabled={dialogMode === 'view'}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.website')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder={t('partnerManagement.placeholderWebsite')}
                      disabled={dialogMode === 'view'}
                    />
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion sx={getAccordionFormSx(theme)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography component="h3" sx={partnerFormSectionTitleSx}>
                  {t('partnerManagement.sectionContact')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label={t('partnerManagement.address')}
                    {...PARTNER_FORM_OUTLINED}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t('partnerManagement.placeholderAddress')}
                    disabled={dialogMode === 'view'}
                  />
                  <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.phone')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formatPhoneDisplay(formData.phone)}
                      onChange={(e) => {
                        warnDigitsOnlyField(e.target.value, 'partnerManagement.phone');
                        setFormData({ ...formData, phone: normalizePhoneDigits(e.target.value) });
                      }}
                      placeholder={t('partnerManagement.placeholderPhone')}
                      disabled={dialogMode === 'view'}
                      inputProps={{ inputMode: 'numeric', 'data-skip-proper-case': '1' }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.email')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: normalizeEmailLower(e.target.value) })
                      }
                      placeholder={t('partnerManagement.placeholderEmail')}
                      disabled={dialogMode === 'view'}
                      inputProps={{ inputMode: 'email', 'data-skip-proper-case': '1' }}
                    />
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion sx={getAccordionFormSx(theme)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography component="h3" sx={partnerFormSectionTitleSx}>
                  {t('partnerManagement.sectionBank')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.bankName')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      placeholder={t('partnerManagement.placeholderBankName')}
                      disabled={dialogMode === 'view'}
                      inputProps={{ 'data-skip-proper-case': '1', name: 'bank_name' }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.accountNumber')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formatBankAccountDisplay(formData.accountNumber)}
                      onChange={(e) => {
                        warnDigitsOnlyField(e.target.value, 'partnerManagement.accountNumber');
                        setFormData({
                          ...formData,
                          accountNumber: normalizeBankAccountDigits(e.target.value),
                        });
                      }}
                      placeholder={t('partnerManagement.placeholderAccountNumber')}
                      disabled={dialogMode === 'view'}
                      inputProps={{ inputMode: 'numeric', 'data-skip-proper-case': '1' }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.ifsc')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.ifsc}
                      onChange={(e) =>
                        setFormData({ ...formData, ifsc: normalizeIfsc(e.target.value) })
                      }
                      placeholder={t('partnerManagement.placeholderIfsc')}
                      disabled={dialogMode === 'view'}
                      inputProps={{
                        'data-skip-proper-case': '1',
                        name: 'ifsc',
                        style: { textTransform: 'uppercase' },
                      }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label={t('partnerManagement.accountHolder')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.accountHolder}
                      onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                      placeholder={t('partnerManagement.placeholderAccountHolder')}
                      disabled={dialogMode === 'view'}
                    />
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>

            <Accordion sx={getAccordionFormSx(theme)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography component="h3" sx={partnerFormSectionTitleSx}>
                  {t('partnerManagement.sectionContract')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label={t('partnerManagement.contractStartDate')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.contractStartDate}
                      onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
                      disabled={dialogMode === 'view'}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      label={t('partnerManagement.contractEndDate')}
                      {...PARTNER_FORM_OUTLINED}
                      value={formData.contractEndDate}
                      onChange={(e) => setFormData({ ...formData, contractEndDate: e.target.value })}
                      disabled={dialogMode === 'view'}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    select
                    label={t('partnerManagement.status')}
                    {...PARTNER_FORM_OUTLINED}
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    disabled={dialogMode === 'view'}
                  >
                    <MenuItem value="active">{t('partnerManagement.active')}</MenuItem>
                    <MenuItem value="inactive">{t('partnerManagement.inactive')}</MenuItem>
                    <MenuItem value="suspended">{t('partnerManagement.suspended')}</MenuItem>
                  </TextField>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    rows={3}
                    label={t('partnerManagement.notes')}
                    {...PARTNER_FORM_OUTLINED}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t('partnerManagement.placeholderNotes')}
                    disabled={dialogMode === 'view'}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        </DialogContent>
        <DialogActions>
          {dialogMode === 'view' ? (
            <>
              <Button onClick={() => setOpenDialog(false)}>{t('partnerManagement.close')}</Button>
              <Tooltip
                title={
                  selectedPartner?.recordSource === 'room_guest'
                    ? t('partnerManagement.roomGuestReadOnly')
                    : t('common.menuNoEdit')
                }
                disableHoverListener={
                  selectedPartner?.recordSource === 'room_guest'
                    ? false
                    : menuFlags.menusLoading || menuFlags.canEdit
                }
              >
                <span style={{ display: 'inline-flex' }}>
                  <Button 
                    onClick={() => {
                      setDialogMode('edit');
                    }} 
                    variant="contained"
                    startIcon={<EditIcon />}
                    disabled={
                      menuFlags.menusLoading ||
                      !menuFlags.canEdit ||
                      selectedPartner?.recordSource === 'room_guest'
                    }
                  >
                    {t('partnerManagement.edit')}
                  </Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <>
              <Button onClick={() => setOpenDialog(false)}>{t('partnerManagement.cancel')}</Button>
              <Tooltip
                title={
                  dialogMode === 'add'
                    ? t('common.menuNoCreate')
                    : t('common.menuNoEdit')
                }
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
                      menuFlags.menusLoading ||
                      (dialogMode === 'add' ? !menuFlags.canCreate : !menuFlags.canEdit)
                    }
                  >
                    {t('partnerManagement.save')}
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Excel 가져오기 다이얼로그 */}
      <Dialog 
        open={importDialogOpen} 
        onClose={() => {
          setImportDialogOpen(false);
          setImportFile(null);
          setImportResult(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('partnerManagement.importDialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('partnerManagement.importDialogDesc')}
            </Typography>
            
            <input
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              id="excel-file-input"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="excel-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadIcon />}
                fullWidth
                sx={{ mb: 2 }}
              >
                {importFile ? importFile.name : t('partnerManagement.selectExcelFile')}
              </Button>
            </label>

            {importResult && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('partnerManagement.importResult')}
                </Typography>
                <Typography variant="body2">
                  {t('partnerManagement.importResultSummary', { total: importResult.data?.total || 0, success: importResult.data?.success?.length || 0 })}
                  {importResult.data?.failed?.length > 0 && (
                    <>, {t('partnerManagement.importFailedCount', { count: importResult.data.failed.length })}</>
                  )}
                </Typography>
                
                {importResult.data?.failed && importResult.data.failed.length > 0 && (
                  <Box sx={{ mt: 2, maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="caption" color="error" sx={{ fontWeight: 'bold' }}>
                      {t('partnerManagement.importFailedItems')}
                    </Typography>
                    {importResult.data.failed.map((item: any, index: number) => (
                      <Typography key={index} variant="caption" display="block" sx={{ mt: 0.5 }}>
                        {t('partnerManagement.row')} {item.row}: {item.error}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setImportDialogOpen(false);
              setImportFile(null);
              setImportResult(null);
            }}
          >
            {t('partnerManagement.cancel')}
          </Button>
          <Button 
            onClick={handleImportExcel} 
            variant="contained" 
            disabled={menuFlags.menusLoading || !menuFlags.canMutate || !importFile || importLoading}
          >
            {importLoading ? t('partnerManagement.importLoading') : t('partnerManagement.importButton')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notify !== null}
        autoHideDuration={8000}
        onClose={() => setNotify(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotify(null)}
          severity={notify?.severity ?? 'error'}
          variant="filled"
          sx={{ width: '100%', maxWidth: 560, whiteSpace: 'pre-line' }}
        >
          {notify?.message}
        </Alert>
      </Snackbar>

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

export default PartnerManagement;
