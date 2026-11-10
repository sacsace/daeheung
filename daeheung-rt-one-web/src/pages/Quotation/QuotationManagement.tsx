import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  TextField,
  FormControl,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  Pagination,
  InputAdornment,
  Tabs,
  Tab,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete } from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsKpiGridSx,
  mvsMainTabsSx,
  mvsFilterBarInnerSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsBodyPaginationSx,
  mvsBodySectionPanelSx,
  mvsBodySectionPanelTitleSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx } from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Email as EmailIcon,
  Edit as EditIcon,
  CheckCircle as ApprovedIcon,
  Cancel as RejectedIcon
} from '@mui/icons-material';
import { useStore } from '../../store';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import AuthMedia from '../../components/Common/AuthMedia';
import { useTranslation } from 'react-i18next';
import { companyService, quotationService } from '../../services/api';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { downloadQuotationPdf, buildQuotationPdfFilename, formatAddressTwoLines, QUOTATION_SCREEN_TOTALS_MIN_WIDTH_PX } from '../../utils/quotationPdf';
import { parseEmailRecipientsList } from '../../utils/emailRecipients';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const QUOTATION_MENU_ROUTES = ['/accounting/quotation', '/work/quotation', '/quotation'] as const;

interface QuotationItem {
  id: number;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  finalPrice: number;
}

interface Quotation {
  id: number;
  quotationNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerGst: string;
  issueDate: string;
  validUntil: string;
  status: 'draft' | 'sent' | 'pending_approval' | 'approved' | 'rejected' | 'expired';
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  notes: string;
  items: QuotationItem[];
  createdBy: string;
  createdByUserId?: number;
  lastModified: string;
  approverUserId?: number;
  approverName?: string;
  /** 승인자 반려 시 사유 */
  rejectionReason?: string;
}

function normalizeItems(raw: unknown): QuotationItem[] {
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      arr = Array.isArray(p) ? p : [];
    } catch {
      arr = [];
    }
  }
  return arr.map((row, idx) => ({
    id: Number(row.id) || idx + 1,
    productName: String(row.productName ?? row.product_name ?? ''),
    description: String(row.description ?? ''),
    quantity: Number(row.quantity) || 0,
    unitPrice: Number(row.unitPrice ?? row.unit_price) || 0,
    totalPrice: Number(row.totalPrice ?? row.total_price) || 0,
    discount: Number(row.discount) || 0,
    finalPrice: Number(row.finalPrice ?? row.final_price ?? row.totalPrice ?? row.total_price) || 0
  }));
}

function mapQuotationFromApi(row: any): Quotation {
  const statusRaw = String(row.status || '').toLowerCase();
  const status: Quotation['status'] =
    statusRaw === 'accepted'
      ? 'approved'
      : statusRaw === 'pending_approval'
        ? 'pending_approval'
        : (statusRaw as Quotation['status']);

  const createdRaw = row.created_at ?? row.createdAt;
  const updatedRaw = row.updated_at ?? row.updatedAt;
  const created = formatIsoToLocalDate(createdRaw);
  const updated = updatedRaw ? String(updatedRaw).replace('T', ' ').substring(0, 19) : '';

  return {
    id: row.id,
    quotationNumber: row.quotation_number || '',
    customerName: row.customer_name || '',
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || '',
    customerAddress: row.customer_address || '',
    customerGst: row.customer_gst || '',
    issueDate: created,
    validUntil: row.valid_until ? String(row.valid_until).split('T')[0] : '',
    status,
    subtotal: Number(row.subtotal) || 0,
    taxRate: Number(row.tax_rate) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    discount: Number(row.discount) || 0,
    totalAmount: Number(row.total_amount) || 0,
    notes: row.notes || '',
    items: normalizeItems(row.items),
    createdBy: row.creator?.username || row.creator?.email || String(row.created_by ?? ''),
    createdByUserId: row.created_by,
    lastModified: updated,
    approverUserId: row.approver_user_id,
    approverName: row.approver?.username || row.approver?.email || '',
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : ''
  };
}

/** 승인 버튼 — 앱 Primary(틸) + 흰 글자로 대비 확보 (contained success 시 글자색 깨짐 방지) */
const QUOTATION_APPROVE_BUTTON_SX = {
  color: '#ffffff',
  bgcolor: 'primary.main',
  '&:hover': {
    bgcolor: 'primary.dark',
    color: '#ffffff'
  },
  '&:focus-visible': {
    outline: '2px solid',
    outlineColor: 'primary.light',
    outlineOffset: 2
  }
} as const;

const quotationFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx } as const;

/** 오늘(로컬) 기준 N일 후 YYYY-MM-DD — 견적 만료일 기본값 등 */
function addDaysLocalIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** API ISO 날짜/시간 → 로컬 YYYY-MM-DD (발행일 표시) */
function formatIsoToLocalDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).split('T')[0] || '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface PartnerCustomer {
  name: string;
  email: string;
  phone: string;
  address: string;
  /** 파트너에 등록된 GSTIN 목록 (복수 가능) */
  gstNumbers?: string[];
  status?: string;
  businessType?: string;
}

function normalizeGstList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return Array.from(
      new Set(raw.map((g) => String(g || '').trim()).filter(Boolean))
    );
  }
  const s = String(raw || '').trim();
  if (!s) return [];
  return Array.from(
    new Set(s.split(',').map((g) => g.trim()).filter(Boolean))
  );
}

/** 1개면 그 값, 2개 이상이면 첫 번째를 기본값으로 (항상 단일 GSTIN만 반환) */
function defaultCustomerGst(gstNumbers: string[] | undefined, preferred?: string): string {
  const list = gstNumbers || [];
  const preferredList = normalizeGstList(preferred);
  const pref = preferredList[0] || '';
  if (pref && list.includes(pref)) return pref;
  if (list.length >= 1) return list[0];
  return pref;
}

interface CompanyInfo {
  id?: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  business_number?: string;
  /** GSTIN 목록 (회사 등록값) */
  gst_numbers?: string[];
  /** 시스템 설정 등에서 등록한 로고(data URL 또는 URL) */
  company_logo?: string;
  /** 회사 등록 서명/직인 (PDF 서명란) */
  ceo_signature?: string;
  account_holder_name?: string;
  bank_name?: string;
  bank_address?: string;
  account_number?: string;
  ifsc_code?: string;
  swift_code?: string;
}

const QuotationManagement: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useStore();
  const menuFlags = usePageMenuPermission(QUOTATION_MENU_ROUTES);
  const createGuard = useMenuActionGuard('create', QUOTATION_MENU_ROUTES);
  const editGuard = useMenuActionGuard('edit', QUOTATION_MENU_ROUTES);
  const deleteGuard = useMenuActionGuard('delete', QUOTATION_MENU_ROUTES);
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [partners, setPartners] = useState<PartnerCustomer[]>([]);
  const [issuingCompany, setIssuingCompany] = useState<CompanyInfo | null>(null);
  const [, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  /** 승인·발송 견적: 설명/만료일/품목만 수정하는 모드 */
  const [contentEditMode, setContentEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [listTab, setListTab] = useState<'requested' | 'pending'>('requested');
  const [companyUsers, setCompanyUsers] = useState<Array<{ id: number; username: string; email: string }>>([]);
  const [pdfSaving, setPdfSaving] = useState(false);
  /** 신규 작성 시 API가 DB(숨김 건 포함) 기준으로 채번한 번호 */
  const [suggestedQuotationNumber, setSuggestedQuotationNumber] = useState<string | null>(null);
  const quotationPrintRef = useRef<HTMLDivElement | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const loadQuotationData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await quotationService.getQuotations({});
      if (response?.success) {
        const list = Array.isArray(response.data) ? response.data : [];
        setQuotations(list.map(mapQuotationFromApi));
      } else {
        setQuotations([]);
      }
    } catch {
      setError(t('quotationManagement.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadCompanyUsers = useCallback(async () => {
    try {
      if (!user?.company_id) {
        setCompanyUsers([]);
        return;
      }
      const users = await useReferenceDataStore.getState().fetchUsers({ company_id: Number(user.company_id) });
      setCompanyUsers(
        users
          .filter((u: any) => u.status === 'active')
          .map((u: any) => ({
            id: u.id,
            username: u.username || u.userid || '',
            email: u.email || ''
          }))
      );
    } catch {
      /* ignore */
    }
  }, [user?.company_id]);

  const loadPartners = useCallback(async () => {
    try {
      const data = await useReferenceDataStore.getState().fetchPartners();
      const mapped = data.map((p: any) => {
          const gstNumbers = normalizeGstList(
            Array.isArray(p.gstNumbers)
              ? p.gstNumbers
              : Array.isArray(p.gst_numbers)
                ? p.gst_numbers
                : []
          );
          return {
            name: p.company_name || p.companyName || '',
            email: p.email || '',
            phone: p.phone || '',
            address: p.address || '',
            gstNumbers,
            status: p.status,
            businessType: p.business_type || p.businessType
          };
        });
        setPartners(
          mapped.filter((p: PartnerCustomer) => p.name && p.name.toLowerCase() !== 'test industries')
        );
    } catch {
      /* ignore */
    }
  }, []);

  const loadIssuingCompany = useCallback(async () => {
    try {
      if (!user?.company_id) {
        setIssuingCompany(null);
        return;
      }
      const companyId = Number(user.company_id);
      const response = await companyService.getCompany(companyId);
      if (response?.success) {
        const data = response.data;
        let gstNumbers: string[] = [];
        if (Array.isArray(data.gst_numbers)) {
          gstNumbers = data.gst_numbers.filter((g: string) => g && String(g).trim() !== '');
        } else if (Array.isArray(data.gstNumbers)) {
          gstNumbers = data.gstNumbers.filter((g: string) => g && String(g).trim() !== '');
        } else if (data.gst_number || data.gstin) {
          gstNumbers = [String(data.gst_number || data.gstin)].filter((g) => g.trim() !== '');
        }
        if (!gstNumbers.length) {
          try {
            const gstRes = await companyService.getCompanyGstNumbers(companyId);
            const list = gstRes?.data?.gst_numbers ?? gstRes?.gst_numbers;
            if (Array.isArray(list)) {
              gstNumbers = list.filter((g: string) => g && String(g).trim() !== '');
            }
          } catch {
            /* ignore */
          }
        }
        setIssuingCompany({
          id: data.id,
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          business_number: data.business_number || '',
          gst_numbers: gstNumbers,
          company_logo: typeof data.company_logo === 'string' ? data.company_logo : '',
          ceo_signature:
            typeof data.ceo_signature === 'string'
              ? data.ceo_signature
              : typeof data.company_seal === 'string'
                ? data.company_seal
                : '',
          account_holder_name: data.account_holder_name || data.accountHolderName || '',
          bank_name: data.bank_name || data.bankName || '',
          bank_address: data.bank_address || data.bankAddress || '',
          account_number: data.account_number || data.accountNumber || '',
          ifsc_code: data.ifsc_code || data.ifscCode || '',
          swift_code: data.swift_code || data.swiftCode || ''
        });
      }
    } catch {
      /* ignore */
    }
  }, [user?.company_id]);

  const filterQuotations = useCallback(() => {
    let filtered = quotations;

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((quotation) => {
        if (quotation.quotationNumber.toLowerCase().includes(q)) return true;
        if (quotation.customerName.toLowerCase().includes(q)) return true;
        if (quotation.customerEmail.toLowerCase().includes(q)) return true;
        if ((quotation.notes || '').toLowerCase().includes(q)) return true;
        return (quotation.items || []).some((item) => {
          const name = String(item.productName || '').toLowerCase();
          const desc = String(item.description || '').toLowerCase();
          return name.includes(q) || desc.includes(q);
        });
      });
    }

    if (statusFilter) {
      filtered = filtered.filter(quotation => quotation.status === statusFilter);
    }

    if (customerFilter) {
      filtered = filtered.filter(quotation =>
        quotation.customerName.toLowerCase().includes(customerFilter.toLowerCase())
      );
    }

    setFilteredQuotations(filtered);
  }, [quotations, searchTerm, statusFilter, customerFilter]);

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    loadQuotationData();
    loadPartners();
    loadIssuingCompany();
    loadCompanyUsers();
  }, [loadCompanyUsers, loadIssuingCompany, loadPartners, loadQuotationData, menuFlags.menusLoading, menuFlags.canRead]);

  useEffect(() => {
    filterQuotations();
  }, [filterQuotations]);

  useEffect(() => {
    setPage(1);
  }, [listTab, searchTerm, statusFilter, customerFilter]);

  useEffect(() => {
    if (!isCreating || selectedQuotation) {
      setSuggestedQuotationNumber(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await quotationService.suggestNextQuotationNumber();
        const num = (res as any)?.data?.quotation_number;
        if (!cancelled && num) setSuggestedQuotationNumber(String(num));
      } catch {
        if (!cancelled) setSuggestedQuotationNumber(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreating, selectedQuotation]);

  const getNextQuotationNumber = () => {
    const year = new Date().getFullYear();
    let maxSeq = 0;
    quotations.forEach((quotation) => {
      const match = quotation.quotationNumber?.match(/QUO-(\d{4})-(\d+)/);
      if (match) {
        const seq = Number(match[2]);
        if (!Number.isNaN(seq)) {
          maxSeq = Math.max(maxSeq, seq);
        }
      }
    });
    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `QUO-${year}-${nextSeq}`;
  };

  const chipCompactSx = {
    height: 24,
    '& .MuiChip-label': {
      whiteSpace: 'nowrap',
      px: 0.75,
      fontSize: { xs: '0.7rem', sm: '0.75rem' },
      lineHeight: 1.2 } } as const;

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <Chip label={t('quotationManagement.statusDraft')} color="default" size="small" sx={chipCompactSx} />
        );
      case 'sent':
        return <Chip label={t('quotationManagement.statusSent')} color="info" size="small" sx={chipCompactSx} />;
      case 'pending_approval':
        return (
          <Chip label={t('quotationManagement.statusPendingApproval')} color="warning" size="small" sx={chipCompactSx} />
        );
      case 'approved':
        return (
          <Chip label={t('quotationManagement.statusApproved')} color="success" size="small" sx={chipCompactSx} />
        );
      case 'rejected':
        return <Chip label={t('quotationManagement.statusRejected')} color="error" size="small" sx={chipCompactSx} />;
      case 'expired':
        return <Chip label={t('quotationManagement.statusExpired')} color="warning" size="small" sx={chipCompactSx} />;
      default:
        return <Chip label={t('quotationManagement.statusUnknown')} color="default" size="small" sx={chipCompactSx} />;
    }
  };

  /** 승인(accepted)·발송(sent)만 PDF 저장·브라우저 인쇄·메일 — draft·승인대기·반려 등은 불가 */
  const canShareApprovedQuotation = (q: Quotation | null | undefined) =>
    !!q && (q.status === 'approved' || q.status === 'sent');

  const handleAddQuotation = () => {
    if (!createGuard.guard()) return;
    setSelectedQuotation(null);
    setIsCreating(true);
    setIsEditing(false);
    setContentEditMode(false);
  };

  /** 목록 행 클릭 → 상세(보기). 수정 가능한 상태는 폼에서 편집 후 하단 저장 */
  const handleOpenQuotationDetail = (quotation: Quotation) => {
    setSelectedQuotation(quotation);
    setIsEditing(true);
    setIsCreating(false);
    setContentEditMode(false);
  };

  const handleDeleteQuotation = async (id: number) => {
    if (!deleteGuard.guard()) return;
    showConfirm(
      t('quotationManagement.confirmDelete'),
      async () => {
        try {
          const res = await quotationService.deleteQuotation(id);
          if ((res as any)?.success) {
            await loadQuotationData();
            setSuccess(t('quotationManagement.deleted'));
          } else {
            setError(t('quotationManagement.deleteFailed'));
          }
        } catch {
          setError(t('quotationManagement.deleteFailed'));
        }
      },
      { confirmColor: 'error' }
    );
  };

  const handleSaveQuotation = async (
    quotationData: Partial<Quotation> & { quotationNumber?: string; approverUserId?: number }
  ) => {
    if (selectedQuotation ? !editGuard.guard() : !createGuard.guard()) return;
    try {
      const isPartialContentSave =
        !!selectedQuotation &&
        contentEditMode &&
        ['approved', 'sent'].includes(selectedQuotation.status);

      if (
        selectedQuotation &&
        ['approved', 'sent', 'rejected', 'expired'].includes(selectedQuotation.status) &&
        !isPartialContentSave
      ) {
        setError(t('quotationManagement.editLocked'));
        return;
      }
      setLoading(true);

      if (isPartialContentSave && selectedQuotation) {
        const res = await quotationService.updateQuotation(selectedQuotation.id, {
          items: quotationData.items,
          subtotal: quotationData.subtotal,
          tax_rate: quotationData.taxRate,
          tax_amount: quotationData.taxAmount,
          discount: quotationData.discount,
          total_amount: quotationData.totalAmount,
          valid_until: quotationData.validUntil,
          notes: quotationData.notes,
          approver_user_id: quotationData.approverUserId
        });
        if ((res as any)?.success) {
          setSuccess(t('quotationManagement.updatedNeedsReapproval'));
          setContentEditMode(false);
          await loadQuotationData();
          // 수정 직후 상세에 승인/반려가 뜨지 않도록 목록으로 복귀
          setIsCreating(false);
          setIsEditing(false);
          setSelectedQuotation(null);
        } else {
          setError(t('quotationManagement.saveFailed'));
        }
        return;
      }

      const payload = {
        customer_name: quotationData.customerName,
        customer_email: quotationData.customerEmail,
        customer_phone: quotationData.customerPhone,
        customer_address: quotationData.customerAddress,
        customer_gst: quotationData.customerGst,
        items: quotationData.items,
        subtotal: quotationData.subtotal,
        tax_rate: quotationData.taxRate,
        tax_amount: quotationData.taxAmount,
        discount: quotationData.discount,
        total_amount: quotationData.totalAmount,
        currency: 'INR',
        valid_until: quotationData.validUntil,
        notes: quotationData.notes,
        approver_user_id: quotationData.approverUserId,
        status: 'pending_approval' as const
      };

      if (selectedQuotation) {
        const res = await quotationService.updateQuotation(selectedQuotation.id, {
          customer_name: payload.customer_name,
          customer_email: payload.customer_email,
          customer_phone: payload.customer_phone,
          customer_address: payload.customer_address,
          customer_gst: payload.customer_gst,
          items: payload.items,
          subtotal: payload.subtotal,
          tax_rate: payload.tax_rate,
          tax_amount: payload.tax_amount,
          discount: payload.discount,
          total_amount: payload.total_amount,
          currency: payload.currency,
          valid_until: payload.valid_until,
          notes: payload.notes,
          approver_user_id: payload.approver_user_id,
          status: payload.status
        });
        if ((res as any)?.success) {
          setSuccess(t('quotationManagement.updated'));
        } else {
          setError(t('quotationManagement.saveFailed'));
          return;
        }
      } else {
        const year = new Date().getFullYear();
        const fresh = await quotationService.suggestNextQuotationNumber({ year });
        let qn =
          (fresh as any)?.data?.quotation_number ||
          quotationData.quotationNumber ||
          suggestedQuotationNumber ||
          getNextQuotationNumber();

        const createOnce = async (num: string) =>
          quotationService.createQuotation({
            ...payload,
            quotation_number: num
          });

        try {
          const res = await createOnce(qn);
          if ((res as any)?.success) {
            setSuccess(t('quotationManagement.created'));
          } else {
            setError((res as any)?.message || t('quotationManagement.saveFailed'));
            return;
          }
        } catch (firstErr: any) {
          const msg = firstErr?.response?.data?.message;
          const dup =
            String(msg || '').includes('이미 존재') ||
            firstErr?.response?.status === 400;
          if (!dup) {
            setError(msg || t('quotationManagement.saveFailed'));
            return;
          }
          const fresh2 = await quotationService.suggestNextQuotationNumber({ year });
          const qn2 = (fresh2 as any)?.data?.quotation_number;
          if (!qn2 || qn2 === qn) {
            setError(msg || t('quotationManagement.saveFailed'));
            return;
          }
          setSuggestedQuotationNumber(qn2);
          try {
            const res2 = await createOnce(qn2);
            if ((res2 as any)?.success) {
              setSuccess(t('quotationManagement.created'));
            } else {
              setError((res2 as any)?.message || t('quotationManagement.saveFailed'));
              return;
            }
          } catch (e2: any) {
            setError(e2?.response?.data?.message || t('quotationManagement.saveFailed'));
            return;
          }
        }
      }
      await loadQuotationData();
      setIsCreating(false);
      setIsEditing(false);
      setSelectedQuotation(null);
    } catch (error: any) {
      setError(error?.response?.data?.message || t('quotationManagement.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQuotation = async (id: number) => {
    try {
      const res = await quotationService.approveQuotation(id);
      if ((res as any)?.success) {
        setSuccess(t('quotationManagement.approveSuccess'));
        await loadQuotationData();
        if (selectedQuotation?.id === id) {
          handleCancelForm();
        }
      } else {
        setError(t('quotationManagement.saveFailed'));
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || t('quotationManagement.saveFailed'));
    }
  };

  const openRejectDialog = (id: number) => {
    setRejectTargetId(id);
    setRejectReasonInput('');
    setRejectDialogOpen(true);
  };

  const closeRejectDialog = () => {
    setRejectDialogOpen(false);
    setRejectTargetId(null);
    setRejectReasonInput('');
  };

  const handleConfirmReject = async () => {
    const reason = rejectReasonInput.trim();
    if (!reason) {
      setError(t('quotationManagement.rejectionReasonRequired'));
      return;
    }
    if (rejectTargetId == null) return;
    const rejectedId = rejectTargetId;
    try {
      setRejectSubmitting(true);
      const res = await quotationService.rejectQuotation(rejectedId, { reason });
      if ((res as any)?.success) {
        setSuccess(t('quotationManagement.rejectSuccess'));
        closeRejectDialog();
        await loadQuotationData();
        if (selectedQuotation?.id === rejectedId) {
          handleCancelForm();
        }
      } else {
        setError(t('quotationManagement.saveFailed'));
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || t('quotationManagement.saveFailed'));
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setIsEditing(false);
    setSelectedQuotation(null);
    setContentEditMode(false);
  };

  const canPartialContentEdit = (q: Quotation | null | undefined) =>
    !!q && (q.status === 'approved' || q.status === 'sent');

  const quotationCustomerLocked =
    !!selectedQuotation &&
    ['approved', 'sent', 'rejected', 'expired'].includes(selectedQuotation.status);

  const quotationContentLocked =
    !!selectedQuotation &&
    (['rejected', 'expired'].includes(selectedQuotation.status) ||
      (canPartialContentEdit(selectedQuotation) && !contentEditMode));

  /** 전체 보기 전용(저장 버튼 숨김 등) — 부분 수정 모드면 false */
  const quotationFormReadOnly =
    quotationCustomerLocked && quotationContentLocked;

  const handlePrintQuotation = (quotation: Quotation) => {
    if (!canShareApprovedQuotation(quotation)) {
      setError(t('quotationManagement.exportAfterApproval'));
      return;
    }
    window.print();
    setSuccess(t('quotationManagement.printed'));
  };

  const handleSaveQuotationPdf = async (quotation: Quotation) => {
    if (!canShareApprovedQuotation(quotation)) {
      setError(t('quotationManagement.exportAfterApproval'));
      return;
    }
    const el = quotationPrintRef.current;
    if (!el) {
      setError(t('quotationManagement.pdfSaveFailed'));
      return;
    }
    try {
      setPdfSaving(true);
      const filename = buildQuotationPdfFilename({
        companyName: quotation.customerName,
        items: quotation.items,
        quotationNumber: quotation.quotationNumber,
      });
      await downloadQuotationPdf(el, filename);
      setSuccess(t('quotationManagement.pdfSaved'));
    } catch {
      setError(t('quotationManagement.pdfSaveFailed'));
    } finally {
      setPdfSaving(false);
    }
  };

  const sendQuotationEmailNow = async (quotation: Quotation) => {
    const el = quotationPrintRef.current;
    if (!el) {
      setError(t('quotationManagement.emailPdfNeedDetail'));
      return;
    }
    try {
      setPdfSaving(true);
      const { quotationPdfToBase64 } = await import('../../utils/quotationPdf');
      const pdfBase64 = await quotationPdfToBase64(el);
      const res = await quotationService.sendQuotation(quotation.id, { pdfBase64 });
      if ((res as any)?.success) {
        setSuccess(t('quotationManagement.emailed'));
        await loadQuotationData();
        handleCancelForm();
      } else {
        setError(t('quotationManagement.saveFailed'));
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || t('quotationManagement.pdfSaveFailed'));
    } finally {
      setPdfSaving(false);
    }
  };

  const handleEmailQuotation = async (quotation: Quotation) => {
    if (!canShareApprovedQuotation(quotation)) {
      setError(t('quotationManagement.emailAfterApproval'));
      return;
    }
    if (quotation.status === 'sent') {
      showConfirm(t('quotationManagement.confirmResendEmail'), () => {
        void sendQuotationEmailNow(quotation);
      });
      return;
    }
    await sendQuotationEmailNow(quotation);
  };

  /**
   * 통계 카드
   * - 승인됨: API `accepted` → UI `approved`, 발송 후 `sent`도 승인 플로우를 통과한 건으로 동일 취급
   * - 총액: 반려·만료는 집계에서 제외 (반려 금액이 합산되지 않도록)
   */
  const { totalAmountActive, approvedQuotations, myPendingApprovals } = useMemo(() => {
    const pending = quotations.filter(
      (q) => q.status === 'pending_approval' && Number(q.approverUserId) === Number(user?.id)
    ).length;
    const approvedOrSent = quotations.filter(
      (q) => q.status === 'approved' || q.status === 'sent'
    ).length;
    const sumExcludingRejectedExpired = quotations
      .filter((q) => q.status !== 'rejected' && q.status !== 'expired')
      .reduce((sum, q) => sum + q.totalAmount, 0);
    return {
      totalAmountActive: sumExcludingRejectedExpired,
      approvedQuotations: approvedOrSent,
      myPendingApprovals: pending
    };
  }, [quotations, user?.id]);

  const tabFilteredQuotations = useMemo(() => {
    const uid = Number(user?.id);
    if (listTab === 'pending') {
      return filteredQuotations.filter(
        (q) => q.status === 'pending_approval' && Number(q.approverUserId) === uid
      );
    }
    return filteredQuotations.filter((q) => Number(q.createdByUserId) === uid);
  }, [filteredQuotations, listTab, user?.id]);

  const paginatedQuotations = tabFilteredQuotations.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  /** 상세 하단 승인/반려: 승인 대기 + 지정 승인자(또는 root/admin). 요청자 본인에게는 미표시 */
  const showDetailApproverToolbar = useMemo(() => {
    if (!selectedQuotation || selectedQuotation.status !== 'pending_approval') return false;
    const uid = Number(user?.id);
    const creatorId = Number(selectedQuotation.createdByUserId);
    if (creatorId === uid) return false;
    const approverId = Number(selectedQuotation.approverUserId);
    const role = user?.role;
    return approverId === uid || role === 'root' || role === 'admin';
  }, [selectedQuotation, user?.id, user?.role]);

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('quotationManagement.title')}
        description={t('quotationManagement.description')}
        mb={2}
        actions={
          isCreating || isEditing ? (
            <Button
              variant="outlined"
              onClick={handleCancelForm}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('common.back')}
            </Button>
          ) : (
            <Tooltip title={createGuard.tooltipTitle} disableHoverListener={!createGuard.tooltipTitle}>
              <span style={{ display: 'inline-flex' }}>
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={handleAddQuotation}
                  disabled={createGuard.disabled}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {t('quotationManagement.create')}
                </Button>
              </span>
            </Tooltip>
          )
        }
      />

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      {isCreating || isEditing ? (
        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
          <CardContent sx={{ px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
              {selectedQuotation ? t('quotationManagement.detailTitle') : t('quotationManagement.create')}
            </Typography>
            <QuotationForm
              key={
                selectedQuotation
                  ? `q-${selectedQuotation.id}-${contentEditMode ? 'edit' : 'view'}`
                  : suggestedQuotationNumber
                    ? `new-${suggestedQuotationNumber}`
                    : 'new'
              }
              quotation={selectedQuotation}
              readOnly={quotationFormReadOnly}
              customerLocked={quotationCustomerLocked}
              contentLocked={quotationContentLocked}
              formId={selectedQuotation ? 'quotation-detail-form' : undefined}
              hideFooterButtons={!!selectedQuotation}
              onSave={handleSaveQuotation}
              onCancel={handleCancelForm}
              companyUsers={companyUsers}
              customers={
                partners.length
                  ? partners.filter(p => !p.status || p.status === 'active')
                  : Array.from(
                      new Map(
                        quotations.map(quotation => [
                          quotation.customerName,
                          {
                            name: quotation.customerName,
                            email: quotation.customerEmail,
                            phone: quotation.customerPhone,
                            address: quotation.customerAddress,
                            gstNumbers: normalizeGstList(quotation.customerGst),
                          },
                        ])
                      ).values()
                    )
              }
              issuingCompany={issuingCompany}
              nextQuotationNumber={suggestedQuotationNumber ?? getNextQuotationNumber()}
              printAreaRef={selectedQuotation ? quotationPrintRef : undefined}
              onValidationMessage={setError}
            />
            {selectedQuotation && (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  mt: 2,
                  pt: 2,
                  borderTop: 1,
                  borderColor: 'divider'
                }}
              >
                <Button
                  variant="outlined"
                  onClick={handleCancelForm}
                  sx={{
                    ...mvsBodyOutlinedBtnSx,
                    bgcolor: '#F1F5F9',
                    borderColor: '#64748B',
                    color: '#0F172A',
                    '&:hover': {
                      bgcolor: '#E2E8F0',
                      borderColor: '#475569',
                      color: '#020617'
                    }
                  }}
                >
                  {t('quotationManagement.backToList')}
                </Button>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
                  {showDetailApproverToolbar && (
                    <>
                      <Button
                        variant="contained"
                        disableElevation
                        onClick={() => void handleApproveQuotation(selectedQuotation.id)}
                        sx={{ ...mvsBodyPrimaryBtnSx, ...QUOTATION_APPROVE_BUTTON_SX }}
                      >
                        {t('quotationManagement.approve')}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={() => openRejectDialog(selectedQuotation.id)}
                        sx={mvsBodyOutlinedBtnSx}
                      >
                        {t('quotationManagement.reject')}
                      </Button>
                    </>
                  )}
                  {canShareApprovedQuotation(selectedQuotation) && !contentEditMode && (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={pdfSaving ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}
                        disabled={pdfSaving}
                        onClick={() => void handleEmailQuotation(selectedQuotation)}
                        sx={mvsBodyOutlinedBtnSx}
                      >
                        {t('quotationManagement.sendEmail')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        onClick={() => handlePrintQuotation(selectedQuotation)}
                        sx={mvsBodyOutlinedBtnSx}
                      >
                        {t('quotationManagement.print')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={pdfSaving ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                        disabled={pdfSaving}
                        onClick={() => void handleSaveQuotationPdf(selectedQuotation)}
                        sx={mvsBodyOutlinedBtnSx}
                      >
                        {t('quotationManagement.savePdf')}
                      </Button>
                    </>
                  )}
                  {canPartialContentEdit(selectedQuotation) && !contentEditMode && (
                    <Button
                      variant="contained"
                      disableElevation
                      startIcon={<EditIcon />}
                      onClick={() => setContentEditMode(true)}
                      sx={mvsBodyPrimaryBtnSx}
                    >
                      {t('quotationManagement.edit')}
                    </Button>
                  )}
                  {contentEditMode && canPartialContentEdit(selectedQuotation) && (
                    <>
                      <Button
                        variant="outlined"
                        onClick={() => setContentEditMode(false)}
                        sx={mvsBodyOutlinedBtnSx}
                      >
                        {t('quotationManagement.cancel')}
                      </Button>
                      <Button
                        type="submit"
                        form="quotation-detail-form"
                        variant="contained"
                        color="primary"
                        disableElevation
                        sx={mvsBodyPrimaryBtnSx}
                      >
                        {t('quotationManagement.save')}
                      </Button>
                    </>
                  )}
                  {!quotationFormReadOnly && !canPartialContentEdit(selectedQuotation) && (
                    <Button type="submit" form="quotation-detail-form" variant="contained" color="primary" disableElevation sx={mvsBodyPrimaryBtnSx}>
                      {t('quotationManagement.save')}
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
            <Tabs
              value={listTab}
              onChange={(_, v) => setListTab(v)}
              sx={mvsMainTabsSx}
            >
              <Tab value="requested" label={t('quotationManagement.tabRequested')} />
              <Tab value="pending" label={t('quotationManagement.tabPendingApproval')} />
            </Tabs>
          </Card>

          <Box sx={mvsKpiGridSx}>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                  {t('quotationManagement.totalQuotations')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                  {quotations.length}
                </Typography>
              </CardContent>
            </Card>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                  {t('quotationManagement.totalAmount')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                  Rs. {totalAmountActive.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                  {t('quotationManagement.approvedQuotations')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'success.main' }}>
                  {approvedQuotations}
                </Typography>
              </CardContent>
            </Card>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                  {t('quotationManagement.pendingQuotations')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'warning.main' }}>
                  {myPendingApprovals}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
            <Box
              sx={{
                ...mvsFilterBarInnerSx,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'minmax(180px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) auto',
                },
              }}
            >
              <TextField
                fullWidth
                size="small"
                label={t('common.search')}
                placeholder={t('quotationManagement.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={quotationFilterFieldSx}
              />
              <TextField
                fullWidth
                size="small"
                select
                label={t('quotationManagement.status')}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ displayEmpty: true }}
                sx={quotationFilterFieldSx}
              >
                <MenuItem value="">{t('menuPermissionManagement.all')}</MenuItem>
                <MenuItem value="draft">{t('quotationManagement.statusDraft')}</MenuItem>
                <MenuItem value="pending_approval">{t('quotationManagement.statusPendingApproval')}</MenuItem>
                <MenuItem value="sent">{t('quotationManagement.statusSent')}</MenuItem>
                <MenuItem value="approved">{t('quotationManagement.statusApproved')}</MenuItem>
                <MenuItem value="rejected">{t('quotationManagement.statusRejected')}</MenuItem>
                <MenuItem value="expired">{t('quotationManagement.statusExpired')}</MenuItem>
              </TextField>
              <TextField
                fullWidth
                size="small"
                label={t('quotationManagement.customerName')}
                placeholder={t('quotationManagement.customerSearchPlaceholder')}
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={quotationFilterFieldSx}
              />
              <Button
                variant="outlined"
                startIcon={<FilterIcon sx={{ fontSize: 18 }} />}
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setCustomerFilter('');
                }}
                sx={{
                  ...mvsBodyOutlinedBtnSx,
                  height: 40,
                  whiteSpace: 'nowrap',
                  alignSelf: { xs: 'stretch', sm: 'flex-end' },
                }}
              >
                {t('common.reset')}
              </Button>
            </Box>
          </Card>

          <Box sx={mvsBodyListZoneSx}>
            <TableContainer sx={mvsBodyListTableSx}>
              <Table
                size="small"
                sx={{
                  tableLayout: 'auto',
                  width: '100%',
                  borderCollapse: 'collapse',
                  bgcolor: 'transparent',
                  '& .MuiTableCell-root': {
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none' } }}
              >
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('quotationManagement.status')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('quotationManagement.quotationNumber')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 140 }}>{t('quotationManagement.customerName')}</TableCell>
                    <TableCell sx={{ width: '100%', minWidth: 160 }}>{t('quotationManagement.itemColumn')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('quotationManagement.issueDate')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('quotationManagement.totalAmount')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('common.create')}</TableCell>
                    <TableCell align="center" sx={{ width: 56, px: 0.5, whiteSpace: 'nowrap' }}>
                      {t('quotationManagement.actions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  {paginatedQuotations.map((quotation) => (
                    <TableRow
                      key={quotation.id}
                      onClick={() => handleOpenQuotationDetail(quotation)}
                      sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                    >
                      <TableCell sx={{ py: 0.75, px: { xs: 0.5, sm: 1 }, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {getStatusChip(quotation.status)}
                      </TableCell>
                      <TableCell
                        sx={{
                          py: 0.75,
                          px: { xs: 0.5, sm: 1 },
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap' }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: { xs: '0.75rem', sm: '0.8125rem' } }}>
                          {quotation.quotationNumber}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          py: 0.75,
                          px: { xs: 0.5, sm: 1 },
                          verticalAlign: 'middle',
                          minWidth: 140,
                          maxWidth: 280,
                          overflow: 'hidden'
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 400,
                            fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}
                        >
                          {quotation.customerName}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          py: 0.75,
                          px: { xs: 0.5, sm: 1 },
                          verticalAlign: 'middle',
                          minWidth: 160,
                          maxWidth: 360,
                          overflow: 'hidden'
                        }}
                      >
                        <Typography
                          variant="body2"
                          color={quotation.notes?.trim() ? 'text.primary' : 'text.secondary'}
                          sx={{
                            fontWeight: 400,
                            fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}
                          title={quotation.notes?.trim() || undefined}
                        >
                          {quotation.notes?.trim() || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          py: 0.75,
                          px: { xs: 0.5, sm: 1 },
                          fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap' }}
                      >
                        {quotation.issueDate}
                      </TableCell>
                      <TableCell sx={{ py: 0.75, px: { xs: 0.5, sm: 1 }, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            fontSize: { xs: '0.7rem', sm: '0.8125rem' } }}
                        >
                          Rs. {quotation.totalAmount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell
                        sx={{
                          py: 0.75,
                          px: { xs: 0.5, sm: 1 },
                          fontSize: { xs: '0.7rem', sm: '0.8125rem' },
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap' }}
                      >
                        {quotation.createdBy}
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        align="center"
                        sx={{
                          py: 0.5,
                          px: 0.25,
                          verticalAlign: 'middle',
                          width: 56,
                          whiteSpace: 'nowrap' }}
                      >
                        <Box
                          sx={{
                            display: 'inline-flex',
                            flexWrap: 'nowrap',
                            gap: 0.25,
                            justifyContent: 'center',
                            alignItems: 'center' }}
                        >
                          {listTab === 'pending' && quotation.status === 'pending_approval' && (
                            <>
                              <Tooltip title={t('quotationManagement.approve')}>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => void handleApproveQuotation(quotation.id)}
                                  sx={{
                                    color: '#ffffff',
                                    bgcolor: 'primary.main',
                                    '&:hover': { bgcolor: 'primary.dark', color: '#ffffff' }
                                  }}
                                >
                                  <ApprovedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('quotationManagement.reject')}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => openRejectDialog(quotation.id)}
                                >
                                  <RejectedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title={deleteGuard.tooltipTitle || t('quotationManagement.delete')}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteQuotation(quotation.id)}
                                disabled={deleteGuard.disabled}
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

            <Box sx={mvsBodyPaginationSx}>
              <Pagination
                count={Math.max(1, Math.ceil(tabFilteredQuotations.length / itemsPerPage))}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          </Box>
        </>
      )}

      {/* 스낵바 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Dialog
        open={rejectDialogOpen}
        onClose={() => {
          if (!rejectSubmitting) closeRejectDialog();
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t('quotationManagement.rejectDialogTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('quotationManagement.rejectionReason')}
            placeholder={t('quotationManagement.rejectionReasonPlaceholder')}
            fullWidth
            multiline
            minRows={3}
            value={rejectReasonInput}
            onChange={(e) => setRejectReasonInput(e.target.value)}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRejectDialog} disabled={rejectSubmitting} sx={mvsBodyOutlinedBtnSx}>
            {t('quotationManagement.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={() => void handleConfirmReject()}
            disabled={rejectSubmitting || !rejectReasonInput.trim()}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('quotationManagement.reject')}
          </Button>
        </DialogActions>
      </Dialog>

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

/** ITEMIZED 행 — QTY·Unit price·DESCRIPTION Outlined 입력 높이 통일 */
const ITEM_ROW_QTY_UNIT_SX = {
  display: 'block',
  '& .MuiOutlinedInput-root': {
    minHeight: 36,
    maxHeight: 36,
    boxSizing: 'border-box'
  },
  '& .MuiOutlinedInput-input': {
    py: '6px',
    px: '10px',
    boxSizing: 'border-box'
  }
} as const;

const ITEM_ROW_DESCRIPTION_SX = {
  display: 'block',
  '& .MuiOutlinedInput-root': {
    minHeight: 36,
    boxSizing: 'border-box'
  },
  '& .MuiOutlinedInput-root.MuiInputBase-multiline': {
    minHeight: 36,
    padding: '6px 10px'
  },
  '& textarea.MuiOutlinedInput-input': {
    resize: 'vertical',
    minHeight: '22px',
    lineHeight: '22px',
    padding: 0,
    overflow: 'auto',
    boxSizing: 'border-box'
  }
} as const;

// 견적서 폼 컴포넌트
interface QuotationFormProps {
  quotation: Quotation | null;
  /** 전체 잠금(반려·만료 또는 승인·발송 보기 모드) */
  readOnly?: boolean;
  /** 받는 회사(고객) 필드 잠금 */
  customerLocked?: boolean;
  /** 설명·만료일·품목 잠금 */
  contentLocked?: boolean;
  /** 목록에서 연 상세에서 하단 툴바로 저장 시 외부 submit 버튼과 연결 */
  formId?: string;
  /** true면 폼 하단 취소/저장 버튼 숨김(상세 툴바 사용) */
  hideFooterButtons?: boolean;
  /** PDF 저장 시 캡처할 영역(견적 본문) */
  printAreaRef?: React.RefObject<HTMLDivElement | null>;
  onSave: (data: Partial<Quotation> & { quotationNumber?: string; approverUserId?: number }) => void;
  onCancel: () => void;
  companyUsers: Array<{ id: number; username: string; email: string }>;
  customers: Array<{
    name: string;
    email: string;
    phone: string;
    address: string;
    gstNumbers?: string[];
  }>;
  issuingCompany: CompanyInfo | null;
  nextQuotationNumber: string;
  /** 폼 검증 메시지 — 상단 Snackbar(`error`)와 동일 스타일 */
  onValidationMessage?: (message: string) => void;
}

const QuotationForm: React.FC<QuotationFormProps> = ({ 
  quotation, 
  readOnly = false,
  customerLocked = false,
  contentLocked = false,
  formId,
  hideFooterButtons = false,
  printAreaRef,
  onSave, 
  onCancel,
  companyUsers,
  customers,
  issuingCompany,
  nextQuotationNumber,
  onValidationMessage
}) => {
  const { t } = useTranslation();
  const lockCustomer = readOnly || customerLocked;
  const lockContent = readOnly || contentLocked;
  const lockTax = lockCustomer; // 승인·발송 후에는 세율/할인 UI도 잠금
  const isPartialContentEdit = lockCustomer && !lockContent;
  const productNameRefs = useRef<Array<HTMLInputElement | null>>([]);
  const qtyRefs = useRef<Array<HTMLInputElement | null>>([]);
  const unitPriceRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState(() => {
    const matched = quotation?.customerName
      ? customers.find((c) => c.name === quotation.customerName)
      : undefined;
    return {
    customerName: quotation?.customerName || '',
    customerEmail: quotation?.customerEmail || '',
    customerPhone: quotation?.customerPhone || '',
    customerAddress: quotation?.customerAddress || '',
    customerGst: defaultCustomerGst(matched?.gstNumbers, quotation?.customerGst),
    validUntil: quotation?.validUntil || addDaysLocalIso(15),
    notes: quotation?.notes || '',
    taxType: 'cgst_sgst',
    cgstRate: 9,
    sgstRate: 9,
    igstRate: 0,
    discount: quotation?.discount || 0,
    approverUserId: quotation?.approverUserId != null ? quotation.approverUserId : ('' as const)
    };
  });
  const [approverSubmitAttempted, setApproverSubmitAttempted] = useState(false);

  const [items, setItems] = useState<QuotationItem[]>(
    quotation?.items || [
      {
        id: 1,
        productName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        discount: 0,
        finalPrice: 0
      }
    ]
  );

  const handleItemChange = (index: number, field: keyof QuotationItem, value: any) => {
    if (lockContent) return;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // 가격 자동 계산
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
      const quantity = field === 'quantity' ? value : newItems[index].quantity;
      const unitPrice = field === 'unitPrice' ? value : newItems[index].unitPrice;
      
      const totalPrice = quantity * unitPrice;
      newItems[index].totalPrice = totalPrice;
      newItems[index].finalPrice = totalPrice;
      newItems[index].discount = 0;
    }
    
    setItems(newItems);
  };

  /** DESCRIPTION 단일 입력: 본문은 productName에 두고, 구버전 description은 표시만 병합 후 비움 */
  const handleItemDescriptionCombinedChange = (index: number, value: string) => {
    if (lockContent) return;
    setItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], productName: value, description: '' };
      return newItems;
    });
  };

  const addItem = () => {
    if (lockContent) return;
    const nextId = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const newItem: QuotationItem = {
      id: nextId,
      productName: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      discount: 0,
      finalPrice: 0
    };
    setItems([...items, newItem]);
  };

  const addItemAndFocus = () => {
    if (lockContent) return;
    setItems(prev => {
      const nextId = prev.length ? Math.max(...prev.map(i => i.id)) + 1 : 1;
      const newItem: QuotationItem = {
        id: nextId,
        productName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        discount: 0,
        finalPrice: 0
      };
      setPendingFocusIndex(prev.length);
      return [...prev, newItem];
    });
  };

  const removeItem = (index: number) => {
    if (lockContent) return;
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  useEffect(() => {
    if (pendingFocusIndex === null) return;
    const index = pendingFocusIndex;
    setPendingFocusIndex(null);
    const focusNewRow = () => {
      const target = productNameRefs.current[index];
      if (target) {
        target.focus();
        target.select?.();
      }
    };
    requestAnimationFrame(() => {
      focusNewRow();
      // 렌더 직후 ref가 아직 비어 있을 수 있음
      setTimeout(focusNewRow, 0);
    });
  }, [items.length, pendingFocusIndex]);

  const focusItemField = (
    refs: React.MutableRefObject<Array<HTMLInputElement | null>>,
    index: number
  ) => {
    const el = refs.current[index];
    if (!el) return;
    el.focus();
    if (typeof el.select === 'function') el.select();
  };

  const getItemDescriptionText = (item: QuotationItem) =>
    [item.productName, item.description].filter((s) => String(s).trim()).join('\n').trim();

  const parsePositiveInt = (raw: string, fallback: number) => {
    if (raw === '') return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.finalPrice, 0);
    const cgstRate = formData.taxType === 'cgst_sgst' ? formData.cgstRate : 0;
    const sgstRate = formData.taxType === 'cgst_sgst' ? formData.sgstRate : 0;
    const igstRate = formData.taxType === 'igst' ? formData.igstRate : 0;
    const taxAmount = (subtotal * (cgstRate + sgstRate + igstRate)) / 100;
    const totalAmount = subtotal + taxAmount - formData.discount;
    
    return { subtotal, taxAmount, totalAmount, cgstRate, sgstRate, igstRate };
  };

  const selectedCustomer = customers.find(customer => customer.name === formData.customerName);
  const quoteNumber = quotation?.quotationNumber || nextQuotationNumber;
  const quoteIssueDate = quotation?.issueDate || addDaysLocalIso(0);
  const metaGridColumns = 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)';

  /** 승인·발송 보기 모드에서는 승인자 숨김. 수정 모드에서는 재선택 가능 */
  const hideApproverForCustomerView =
    !!quotation &&
    lockCustomer &&
    lockContent &&
    ['approved', 'sent'].includes(quotation.status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockContent) return;
    if (formData.approverUserId === '') {
      setApproverSubmitAttempted(true);
      onValidationMessage?.(t('quotationManagement.selectApprover'));
      return;
    }
    const effectiveEmail = (formData.customerEmail || selectedCustomer?.email || '').trim();
    if (effectiveEmail) {
      const pr = parseEmailRecipientsList(effectiveEmail);
      if (!pr.ok) {
        onValidationMessage?.(t('quotationManagement.invalidEmailInList', { part: pr.message }));
        return;
      }
    }
    const invalidLine = items.find((it) => {
      const qty = Number(it.quantity);
      const price = Number(it.unitPrice);
      return (
        !Number.isFinite(qty) ||
        qty < 1 ||
        !Number.isFinite(price) ||
        price <= 0
      );
    });
    if (invalidLine) {
      onValidationMessage?.(t('quotationManagement.itemQtyUnitRequired'));
      return;
    }
    const { subtotal, taxAmount, totalAmount, cgstRate, sgstRate, igstRate } = calculateTotals();
    const fallbackValidUntil = addDaysLocalIso(15);
    
    onSave({
      ...formData,
      customerName: formData.customerName || selectedCustomer?.name || '',
      customerEmail: formData.customerEmail || selectedCustomer?.email || '',
      customerPhone: formData.customerPhone || selectedCustomer?.phone || '',
      customerAddress: formData.customerAddress || selectedCustomer?.address || '',
      customerGst: formData.customerGst || defaultCustomerGst(selectedCustomer?.gstNumbers),
      validUntil: formData.validUntil || fallbackValidUntil,
      notes: formData.notes || '견적 기본 사항 자동 입력',
      subtotal,
      taxAmount,
      taxRate: cgstRate + sgstRate + igstRate,
      totalAmount,
      items,
      issueDate: quoteIssueDate,
      quotationNumber: quoteNumber,
      approverUserId: Number(formData.approverUserId)
    });
  };

  const { subtotal, totalAmount, cgstRate, sgstRate, igstRate } = calculateTotals();

  const handleCustomerSelect = (name: string) => {
    if (lockCustomer) return;
    const selected = customers.find(customer => customer.name === name);
    if (!selected) {
      setFormData(prev => ({
        ...prev,
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        customerAddress: '',
        customerGst: '' }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      customerName: selected.name,
      customerEmail: selected.email,
      customerPhone: selected.phone,
      customerAddress: selected.address,
      customerGst: defaultCustomerGst(selected.gstNumbers) }));
  };

  const customerGstOptions = selectedCustomer?.gstNumbers?.length
    ? selectedCustomer.gstNumbers
    : normalizeGstList(formData.customerGst);
  const showCustomerGstSelect = !lockCustomer && customerGstOptions.length > 1;

  return (
    <Box component="form" id={formId} onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Box
        ref={printAreaRef}
        className="quotation-print-area"
        sx={{ bgcolor: '#fff', borderRadius: 2 }}
      >
      <Box
        component="fieldset"
        disabled={lockCustomer && lockContent}
        sx={{
          border: '1px solid #cfcfcf',
          borderRadius: 2,
          bgcolor: '#fff',
          p: { xs: 2, md: 3 },
          m: 0,
          minWidth: 0
        }}
      >
        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: 3, mb: 3 }}
          className="quotation-pdf-header"
        >
          <Box
            sx={{
              minWidth: 220,
              flex: '1 1 auto',
              '& .MuiTypography-caption': { fontSize: '0.825rem', lineHeight: 1.4 },
              '& .MuiTypography-subtitle2': { fontSize: '1.0125rem', lineHeight: 1.35 }
            }}
            className="quotation-pdf-company"
          >
            {issuingCompany?.company_logo ? (
              <AuthMedia
                src={issuingCompany.company_logo}
                alt={issuingCompany.name || ''}
                sx={{
                  display: 'block',
                  maxHeight: 64,
                  maxWidth: 260,
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  mb: 1 }}
              />
            ) : null}
            <Typography variant="caption" color="text.secondary" className="quotation-pdf-hide">
              Company name
            </Typography>
            <Typography variant="subtitle2" className="quotation-pdf-company-name" sx={{ mt: 0.5, mb: 1, fontSize: '1.0625rem', fontWeight: 700 }}>
              {issuingCompany?.name || '-'}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              className="quotation-pdf-company-address"
              sx={{ whiteSpace: 'pre-line', maxWidth: 360 }}
            >
              {formatAddressTwoLines(issuingCompany?.address || '-')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              className="quotation-pdf-company-contact"
              sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
            >
              {[
                `Phone: ${issuingCompany?.phone || '-'}`,
                `Email: ${issuingCompany?.email || '-'}`,
                ...(issuingCompany?.gst_numbers && issuingCompany.gst_numbers.length > 0
                  ? [`GST: ${issuingCompany.gst_numbers.join(', ')}`]
                  : []),
              ].join(' | ')}
            </Typography>
          </Box>
          <Box
            className="quotation-pdf-header-right"
            sx={{
              textAlign: 'right',
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              alignSelf: 'stretch',
              minHeight: '100%',
            }}
          >
            <Typography className="quotation-pdf-title" sx={{ letterSpacing: 0.3, fontWeight: 700, fontSize: '22px' }}>
              Quotation
            </Typography>
            <Box className="quotation-pdf-header-spacer" sx={{ flex: 1, minHeight: 14 }} />
            <Box
              className="quotation-pdf-meta"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #cfcfcf',
                borderRadius: 0,
                overflow: 'hidden',
                minWidth: 340,
                textAlign: 'center',
                '--quotation-meta-cols': metaGridColumns,
                '& > .MuiBox-root': {
                  display: 'grid',
                  gridTemplateColumns: 'var(--quotation-meta-cols)',
                  minWidth: 0,
                },
                '& > .MuiBox-root > .MuiBox-root': {
                  minWidth: 0,
                  py: 0.9,
                  px: 0.75,
                  minHeight: 43,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                '& .MuiTypography-root': { textAlign: 'center', width: '100%' },
                '& .MuiTypography-body2': {
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: '0.8125rem',
                  lineHeight: 1.1,
                },
                '& .MuiTypography-caption': {
                  lineHeight: 1.1,
                },
              }}
            >
              <Box sx={{ bgcolor: '#f5f5f5' }}>
                <Box sx={{ borderRight: '1px solid #cfcfcf' }}><Typography variant="caption">Quote #</Typography></Box>
                <Box sx={{ borderRight: '1px solid #cfcfcf' }}><Typography variant="caption">Date</Typography></Box>
                <Box className="quotation-pdf-meta-valid-label"><Typography variant="caption">Valid until</Typography></Box>
              </Box>
              <Box sx={{ borderTop: '1px solid #cfcfcf' }}>
                <Box sx={{ borderRight: '1px solid #cfcfcf' }}>
                  <Typography variant="body2">{quoteNumber}</Typography>
                </Box>
                <Box sx={{ borderRight: '1px solid #cfcfcf' }}>
                  <Typography variant="body2">{quoteIssueDate}</Typography>
                </Box>
                <Box className="quotation-pdf-meta-valid-value" sx={{ minWidth: 0 }}>
                  {lockContent ? (
                    <Typography variant="body2">{formData.validUntil || '-'}</Typography>
                  ) : (
                    <TextField
                      type="date"
                      size="small"
                      variant="standard"
                      fullWidth
                      required
                      value={formData.validUntil}
                      onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                      inputProps={{ style: { textAlign: 'center', fontSize: '0.8125rem' } }}
                      sx={{
                        minWidth: 0,
                        '& .MuiInput-root:before, & .MuiInput-root:after': { display: 'none' },
                        '& .MuiInputBase-input': { py: 0.5, px: 0.5, textAlign: 'center' },
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box className="quotation-pdf-section quotation-pdf-section-customer" sx={mvsBodySectionPanelSx}>
          <Box sx={mvsBodySectionPanelTitleSx} className="quotation-pdf-section-title">
            <Typography variant="subtitle2">Customer info</Typography>
          </Box>
          <Box
            sx={{
              px: 1.5,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              '& .MuiFormHelperText-root': { mt: 0.25, mb: 0, lineHeight: 1.3 },
              '& .MuiTypography-caption': { display: 'block', mb: 0.25, lineHeight: 1.2 }
            }}
            className="quotation-pdf-section-body"
          >
            <Box
              className="quotation-pdf-customer-line quotation-pdf-customer-line-1"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                columnGap: 1,
                alignItems: 'start',
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">Name *</Typography>
                <Autocomplete
                  options={customers}
                  size="small"
                  fullWidth
                  disabled={lockCustomer}
                  autoHighlight
                  clearOnBlur={false}
                  isOptionEqualToValue={(option, value) => option.name === value.name}
                  getOptionLabel={(option) => option.name || ''}
                  filterOptions={(options, { inputValue }) => {
                    const q = inputValue.trim().toLowerCase();
                    if (!q) return options;
                    return options.filter((c) => {
                      const name = String(c.name || '').toLowerCase();
                      const email = String(c.email || '').toLowerCase();
                      const phone = String(c.phone || '').toLowerCase();
                      return name.includes(q) || email.includes(q) || phone.includes(q);
                    });
                  }}
                  value={
                    customers.find((c) => c.name === formData.customerName) ||
                    (formData.customerName
                      ? {
                          name: formData.customerName,
                          email: formData.customerEmail || '',
                          phone: formData.customerPhone || '',
                          address: formData.customerAddress || '',
                          gstNumbers: normalizeGstList(formData.customerGst),
                        }
                      : null)
                  }
                  onChange={(_event, newValue) => {
                    handleCustomerSelect(newValue?.name || '');
                  }}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.name}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {option.name}
                        </Typography>
                        {(option.email || option.phone) && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {[option.email, option.phone].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      disabled={lockCustomer}
                      placeholder={t('quotationManagement.customerSearchPlaceholder')}
                    />
                  )}
                  noOptionsText={t('common.noResults', { defaultValue: '검색 결과가 없습니다.' })}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">GST</Typography>
                {showCustomerGstSelect ? (
                  <FormControl fullWidth size="small" disabled={lockCustomer}>
                    <Select
                      displayEmpty
                      value={formData.customerGst || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, customerGst: String(e.target.value || '') })
                      }
                      renderValue={(selected) =>
                        selected ? String(selected) : 'GSTIN 선택'
                      }
                    >
                      {customerGstOptions.map((gst) => (
                        <MenuItem key={gst} value={gst}>
                          {gst}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    disabled={lockCustomer}
                    value={formData.customerGst}
                    onChange={(e) => setFormData({ ...formData, customerGst: e.target.value })}
                    placeholder="GSTIN"
                  />
                )}
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Email *</Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="email"
                  disabled={lockCustomer}
                  inputProps={{ multiple: true }}
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  required
                  helperText={lockCustomer ? undefined : t('quotationManagement.customerEmailMultipleHint')}
                />
              </Box>
            </Box>
            <Box
              className="quotation-pdf-customer-line quotation-pdf-customer-line-2"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                columnGap: 1,
                alignItems: 'start',
              }}
            >
              <Box className="quotation-pdf-customer-phone">
                <Typography variant="caption" color="text.secondary">Phone</Typography>
                <TextField
                  fullWidth
                  size="small"
                  disabled={lockCustomer}
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                />
              </Box>
              <Box className="quotation-pdf-customer-address" sx={{ gridColumn: { xs: '1 / -1', md: 'span 2' } }}>
                <Typography variant="caption" color="text.secondary">Address</Typography>
                <TextField
                  fullWidth
                  size="small"
                  disabled={lockCustomer}
                  value={formData.customerAddress}
                  onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                />
              </Box>
            </Box>
            {!hideApproverForCustomerView && (
              <Box className="quotation-pdf-hide">
                <Typography variant="caption" color="text.secondary">{t('quotationManagement.approver')} *</Typography>
                <Autocomplete
                  options={companyUsers}
                  size="small"
                  fullWidth
                  disabled={lockContent}
                  autoHighlight
                  clearOnBlur={false}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) =>
                    option.email ? `${option.username} (${option.email})` : option.username
                  }
                  filterOptions={(options, { inputValue }) => {
                    const q = inputValue.trim().toLowerCase();
                    if (!q) return options;
                    return options.filter((u) => {
                      const name = String(u.username || '').toLowerCase();
                      const email = String(u.email || '').toLowerCase();
                      return name.includes(q) || email.includes(q);
                    });
                  }}
                  value={
                    formData.approverUserId === ''
                      ? null
                      : companyUsers.find((u) => u.id === formData.approverUserId) || null
                  }
                  onChange={(_event, newValue) => {
                    if (lockContent) return;
                    setApproverSubmitAttempted(false);
                    setFormData({
                      ...formData,
                      approverUserId: newValue?.id ?? '' });
                  }}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {option.username}
                        </Typography>
                        {option.email ? (
                          <Typography variant="caption" color="text.secondary">
                            {option.email}
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      disabled={lockContent}
                      placeholder={t('quotationManagement.selectApprover')}
                      error={approverSubmitAttempted && formData.approverUserId === ''}
                    />
                  )}
                  noOptionsText={t('common.noResults', { defaultValue: '검색 결과가 없습니다.' })}
                />
              </Box>
            )}
          </Box>
        </Box>

        {lockCustomer && lockContent && ['approved', 'sent'].includes(quotation?.status || '') && (
          <Alert severity="info" className="quotation-pdf-hide" sx={{ mb: 2 }}>
            {t('quotationManagement.editLocked')}
          </Alert>
        )}
        {isPartialContentEdit && (
          <Alert severity="info" className="quotation-pdf-hide" sx={{ mb: 2 }}>
            {t('quotationManagement.partialEditHint')}
          </Alert>
        )}

        {lockCustomer && lockContent && quotation?.status === 'rejected' && !!quotation.rejectionReason?.trim() && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t('quotationManagement.rejectionReason')}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {quotation.rejectionReason}
            </Typography>
          </Alert>
        )}

        <Box className="quotation-pdf-section quotation-pdf-section-notes" sx={mvsBodySectionPanelSx}>
          <Box sx={mvsBodySectionPanelTitleSx} className="quotation-pdf-section-title">
            <Typography variant="subtitle2">Description of work</Typography>
          </Box>
          <Box sx={{ p: 1.5 }} className="quotation-pdf-section-body quotation-pdf-notes-body">
            <TextField
              fullWidth
              multiline
              rows={3}
              disabled={lockContent}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              sx={{ '& textarea': { resize: lockContent ? 'none' : 'vertical' } }}
            />
          </Box>
        </Box>

        <Box
          className="quotation-pdf-section quotation-pdf-section-items"
          sx={{ ...mvsBodySectionPanelSx, border: '1px solid #000' }}
        >
          <Box
            sx={{
              ...mvsBodySectionPanelTitleSx,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 0.5,
              borderBottom: '1px solid #000',
            }}
            className="quotation-pdf-section-title quotation-pdf-hide"
          >
            <Typography variant="subtitle2">Itemized costs</Typography>
            {!lockContent && (
              <Button
                size="small"
                variant="contained"
                disableElevation
                startIcon={<AddIcon />}
                onClick={addItem}
                sx={{
                  ...mvsBodyPrimaryBtnSx,
                  minHeight: 32,
                  px: 1.5,
                  bgcolor: '#0F766E',
                  color: '#FFFFFF',
                  '& .MuiButton-startIcon': { mr: '4px', color: '#FFFFFF' },
                  '&:hover': {
                    bgcolor: '#0D9488',
                  },
                }}
              >
                상품 추가
              </Button>
            )}
          </Box>
          <Box sx={{ overflow: 'auto', width: '100%', px: 1, pb: 1, pt: 0.5 }}>
          <Table
            className="quotation-itemized-costs-table"
            size="small"
            sx={{
              tableLayout: 'fixed',
              width: '100%',
              minWidth: 560,
              borderCollapse: 'collapse',
              borderSpacing: 0,
              '& .MuiTableRow-root': {
                height: 'auto',
              },
              '& .MuiTableCell-head': {
                py: 0.5,
              },
              '& .MuiTableCell-body': {
                borderBottom: 'none',
                py: 0.65,
                px: 0.5,
                lineHeight: 1.25,
              },
            }}
          >
            <TableHead
              sx={{
                bgcolor: 'background.paper',
                '& .MuiTableCell-head': {
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  borderBottom: 'none',
                  borderColor: 'transparent',
                  py: 0.5
                },
                '& .MuiTableCell-head:last-of-type': {
                  textAlign: 'center'
                }
              }}
            >
              <TableRow>
                <TableCell sx={{ width: '60%' }}>Description</TableCell>
                <TableCell align="right" sx={{ width: '13%' }}>
                  Qty
                </TableCell>
                <TableCell align="right" sx={{ width: '13%' }}>
                  Unit price
                </TableCell>
                <TableCell align="right" sx={{ width: '10%' }}>
                  Amount
                </TableCell>
                {!lockContent && (
                  <TableCell align="center" sx={{ width: '4%', minWidth: 44 }}>
                    -
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell
                    sx={{
                      verticalAlign: 'middle',
                      overflow: 'visible',
                      width: '60%',
                      minWidth: 0
                    }}
                  >
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={1}
                      disabled={lockContent}
                      placeholder="품목 및 설명"
                      value={[item.productName, item.description].filter((s) => String(s).trim()).join('\n')}
                      onChange={(e) => handleItemDescriptionCombinedChange(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (lockContent) return;
                        if (e.key !== 'Enter') return;
                        // Shift+Enter: 설명 줄바꿈 유지
                        if (e.shiftKey) return;
                        e.preventDefault();
                        if (!getItemDescriptionText(item)) {
                          onValidationMessage?.(t('quotationManagement.itemDescriptionRequired'));
                          return;
                        }
                        focusItemField(qtyRefs, index);
                      }}
                      inputRef={(el) => {
                        productNameRefs.current[index] = el;
                      }}
                      required
                      sx={ITEM_ROW_DESCRIPTION_SX}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: '13%', verticalAlign: 'middle' }}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      disabled={lockContent}
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(index, 'quantity', parsePositiveInt(e.target.value, 0))
                      }
                      onBlur={() => {
                        if (lockContent) return;
                        if (Number(item.quantity) < 1) {
                          handleItemChange(index, 'quantity', 1);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (lockContent) return;
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        if (Number(item.quantity) < 1) {
                          onValidationMessage?.(t('quotationManagement.itemQtyUnitRequired'));
                          return;
                        }
                        focusItemField(unitPriceRefs, index);
                      }}
                      inputRef={(el) => {
                        qtyRefs.current[index] = el;
                      }}
                      inputProps={{ min: 1 }}
                      sx={ITEM_ROW_QTY_UNIT_SX}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: '13%', verticalAlign: 'middle' }}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      disabled={lockContent}
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(index, 'unitPrice', parsePositiveInt(e.target.value, 0))
                      }
                      onBlur={() => {
                        if (lockContent) return;
                        if (Number(item.unitPrice) <= 0) {
                          onValidationMessage?.(t('quotationManagement.itemQtyUnitRequired'));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (lockContent) return;
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        if (!getItemDescriptionText(item)) {
                          onValidationMessage?.(t('quotationManagement.itemDescriptionRequired'));
                          focusItemField(productNameRefs, index);
                          return;
                        }
                        if (Number(item.quantity) < 1 || Number(item.unitPrice) <= 0) {
                          onValidationMessage?.(t('quotationManagement.itemQtyUnitRequired'));
                          return;
                        }
                        addItemAndFocus();
                      }}
                      inputRef={(el) => {
                        unitPriceRefs.current[index] = el;
                      }}
                      inputProps={{ min: 1 }}
                      sx={ITEM_ROW_QTY_UNIT_SX}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: '10%', verticalAlign: 'middle' }}>
                    <Typography
                      variant="body2"
                      sx={{ minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', lineHeight: 1 }}
                    >
                      Rs. {item.finalPrice.toLocaleString()}
                    </Typography>
                  </TableCell>
                  {!lockContent && (
                    <TableCell align="center" sx={{ width: '4%', minWidth: 44, verticalAlign: 'middle' }}>
                      {items.length > 1 && (
                        <IconButton onClick={() => removeItem(index)} color="error" size="small">
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Box>
        </Box>

        <Box
          className="quotation-pdf-hide"
          sx={{ ...mvsBodySectionPanelSx, p: 2 }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' }, gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Tax type</Typography>
              <FormControl fullWidth size="small" sx={{ mt: 0.5 }} disabled={lockTax}>
                <Select
                  disabled={lockTax}
                  value={formData.taxType}
                  onChange={(e) => {
                    if (lockTax) return;
                    const nextType = e.target.value;
                    if (nextType === 'igst') {
                      setFormData(prev => ({
                        ...prev,
                        taxType: 'igst',
                        cgstRate: 0,
                        sgstRate: 0,
                        igstRate: 18
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        taxType: 'cgst_sgst',
                        igstRate: 0,
                        cgstRate: prev.cgstRate || 9,
                        sgstRate: prev.sgstRate || 9 }));
                    }
                  }}
                >
                  <MenuItem value="cgst_sgst">CGST + SGST</MenuItem>
                  <MenuItem value="igst">IGST</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">CGST (%)</Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={formData.cgstRate}
                disabled={lockTax || formData.taxType === 'igst'}
                onChange={(e) => setFormData({
                  ...formData,
                  cgstRate: parseInt(e.target.value) || 0,
                  igstRate: 0
                })}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">SGST (%)</Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={formData.sgstRate}
                disabled={lockTax || formData.taxType === 'igst'}
                onChange={(e) => setFormData({
                  ...formData,
                  sgstRate: parseInt(e.target.value) || 0,
                  igstRate: 0
                })}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">IGST (%)</Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                value={formData.igstRate}
                disabled={lockTax || formData.taxType !== 'igst'}
                onChange={(e) => setFormData({
                  ...formData,
                  igstRate: parseInt(e.target.value) || 0,
                  cgstRate: 0,
                  sgstRate: 0
                })}
              />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Discount</Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                disabled={lockTax}
                value={formData.discount}
                onChange={(e) => setFormData({ ...formData, discount: parseInt(e.target.value) || 0 })}
              />
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) max-content',
            gap: 1.5,
            alignItems: 'stretch',
            mb: 2,
            width: '100%',
          }}
          className="quotation-pdf-totals-wrap"
        >
          <Box
            className="quotation-pdf-bank"
            sx={{
              width: '100%',
              maxWidth: '100%',
              justifySelf: 'stretch',
              height: '100%',
              alignSelf: 'stretch',
              minWidth: 0,
              boxSizing: 'border-box',
              border: '1px solid #000',
              borderRadius: '4px',
              overflow: 'hidden',
              px: 1.5,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              textAlign: 'left',
              visibility:
                issuingCompany?.bank_name ||
                issuingCompany?.account_number ||
                issuingCompany?.ifsc_code ||
                issuingCompany?.account_holder_name
                  ? 'visible'
                  : 'hidden'
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
              Bank details
            </Typography>
            {issuingCompany?.account_holder_name ? (
              <Typography variant="caption" color="text.secondary" display="block">
                Account holder: {issuingCompany.account_holder_name}
              </Typography>
            ) : null}
            {issuingCompany?.bank_name ? (
              <Typography variant="caption" color="text.secondary" display="block">
                Bank name: {issuingCompany.bank_name}
              </Typography>
            ) : null}
            {issuingCompany?.account_number ? (
              <Typography variant="caption" color="text.secondary" display="block">
                Account number: {issuingCompany.account_number}
              </Typography>
            ) : null}
            {issuingCompany?.ifsc_code ? (
              <Typography variant="caption" color="text.secondary" display="block">
                IFSC: {issuingCompany.ifsc_code}
              </Typography>
            ) : null}
          </Box>
          <Box
            sx={{
              width: 'max-content',
              minWidth: QUOTATION_SCREEN_TOTALS_MIN_WIDTH_PX,
              justifySelf: 'end',
              height: '100%',
              alignSelf: 'stretch',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #000',
              borderRadius: '4px',
              overflow: 'hidden',
              '& .MuiTypography-body2': { fontSize: '0.825rem', lineHeight: 1.35 },
              '& .MuiTypography-subtitle2': { fontSize: '0.88rem', lineHeight: 1.35, fontWeight: 700 }
            }}
            className="quotation-pdf-totals"
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="body2" sx={{ flexShrink: 0 }}>Subtotal</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Rs. {subtotal.toLocaleString()}</Typography>
            </Box>
            {subtotal * (cgstRate / 100) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="body2" sx={{ flexShrink: 0 }}>CGST ({cgstRate}%)</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Rs. {(subtotal * (cgstRate / 100)).toLocaleString()}</Typography>
              </Box>
            )}
            {subtotal * (sgstRate / 100) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="body2" sx={{ flexShrink: 0 }}>SGST ({sgstRate}%)</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Rs. {(subtotal * (sgstRate / 100)).toLocaleString()}</Typography>
              </Box>
            )}
            {subtotal * (igstRate / 100) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="body2" sx={{ flexShrink: 0 }}>IGST ({igstRate}%)</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Rs. {(subtotal * (igstRate / 100)).toLocaleString()}</Typography>
              </Box>
            )}
            {!!formData.discount && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="body2" sx={{ flexShrink: 0 }}>Discount</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>-Rs. {formData.discount.toLocaleString()}</Typography>
              </Box>
            )}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1,
                mt: 'auto',
                borderTop: '1px solid #000',
                bgcolor: '#f0f0f0'
              }}
            >
              <Typography variant="subtitle2" sx={{ flexShrink: 0 }}>Total quote</Typography>
              <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Rs. {totalAmount.toLocaleString()}</Typography>
            </Box>
          </Box>
        </Box>

        <Box
          className="quotation-pdf-signature"
          sx={{
            mt: 3,
            pt: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 3,
            borderTop: '1px solid #e0e0e0'
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600 }}>
              For {issuingCompany?.name || 'Company'}
            </Typography>
            {issuingCompany?.ceo_signature ? (
              <AuthMedia
                src={issuingCompany.ceo_signature}
                alt="Authorized signature"
                className="quotation-pdf-stamp"
                sx={{
                  display: 'block',
                  mt: 1,
                  mb: 0.5,
                  width: '3.5cm',
                  maxWidth: '3.5cm',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <Box
                className="quotation-pdf-sign-line"
                sx={{ mt: 4, mb: 0.5, width: 180, height: 36, borderBottom: '1px solid #999' }}
              />
            )}
            <Typography variant="caption" display="block" color="text.secondary">
              Authorized signatory
            </Typography>
          </Box>
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600 }}>
              Received by
            </Typography>
            <Box
              className="quotation-pdf-sign-line"
              sx={{
                mt: 4,
                mb: 0.5,
                width: 180,
                height: 36,
                borderBottom: '1px solid #999',
                ml: { xs: 0, sm: 'auto' }
              }}
            />
            <Typography variant="caption" display="block" color="text.secondary">
              Name & date
            </Typography>
          </Box>
        </Box>

      </Box>
      </Box>
        {!hideFooterButtons && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={onCancel} variant="outlined">
              {lockCustomer && lockContent ? t('common.close') : t('quotationManagement.cancel')}
            </Button>
            {!lockContent && (
              <Button type="submit" variant="contained">
                {t('common.save')}
              </Button>
            )}
          </Box>
        )}
    </Box>
  );
};

export default QuotationManagement;